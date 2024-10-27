import * as trpc from '@trpc/server';
import { TRPCError } from '@trpc/server';
import * as trpcNext from '@trpc/server/adapters/next';
import * as AWS from 'aws-sdk';
import Rekognition from 'aws-sdk/clients/rekognition';
import S3 from 'aws-sdk/clients/s3';
import { z } from 'zod';
import { uuid } from '../../../utils/uuid';

// Configure AWS global credentials
if (process.env.PB_ACCESS_KEY_ID) {
  AWS.config.update({
    accessKeyId: process.env.PB_ACCESS_KEY_ID,
    secretAccessKey: process.env.PB_SECRET_ACCESS_KEY,
    region: process.env.PB_REGION,
  });
}

const rekog = new Rekognition();
const s3 = new S3();

export const appRouter = trpc
  .router()
  .query('hello', {
    input: z
      .object({
        text: z.string().nullish(),
      })
      .nullish(),
    async resolve({ input }) {
      const res = await rekog
        .listFaces({ CollectionId: 'controle-acesso' })
        .promise();
      return {
        greeting: `hello ${input?.text ?? 'world'}`,
      };
    },
  })
  .mutation('indexFace', {
    input: z.object({
      image: z.string(),
    }),
    async resolve({ input }) {
      try {
        const base64Img = input.image.replace('data:image/jpeg;base64,', '');
        const imgBuffer = Buffer.from(base64Img, 'base64');
        const imageId = uuid();

        // Indexar face no Rekognition
        await rekog
          .indexFaces({
            CollectionId: 'controle-acesso',
            ExternalImageId: imageId,
            Image: {
              Bytes: imgBuffer,
            },
          })
          .promise();

        // Adicionar face ao S3
        await s3
          .putObject({
            Bucket: 'controle-acesso',
            Key: 'faces/' + imageId + '.jpg',
            Body: imgBuffer,
            ContentType: 'image/jpeg', // Definir tipo de conteúdo
          })
          .promise();
        return true;
      } catch (e) {
        console.error(e);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Falha ao indexar rosto',
        });
      }
    },
  })
  .mutation('searchFaceByImage', {
    input: z.object({
      image: z.string(),
    }),
    async resolve({ input }) {
      try {
        const base64Img = input.image.replace('data:image/jpeg;base64,', '');
        const imgBuffer = Buffer.from(base64Img, 'base64');
        const res = await rekog
          .searchFacesByImage({
            CollectionId: 'controle-acesso',
            Image: {
              Bytes: imgBuffer,
            },
          })
          .promise();

        // Buscar imagens no S3 de forma otimizada com Promise.all
        const images = await Promise.all(
          res.FaceMatches?.map(async (face) => {
            const s3Res = await s3
              .getObject({
                Bucket: 'controle-acesso',
                Key: 'faces/' + face.Face?.ExternalImageId + '.jpg',
              })
              .promise();
            return s3Res.Body?.toString('base64');
          }) ?? []
        );

        return { matchedFaces: res.FaceMatches, images };
      } catch (e) {
        console.error('Erro ao buscar rosto:', e);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro ao buscar rosto no AWS Rekognition',
        });
      }
    },
  });

export type AppRouter = typeof appRouter;

export default trpcNext.createNextApiHandler({
  router: appRouter,
  createContext: () => null,
});
