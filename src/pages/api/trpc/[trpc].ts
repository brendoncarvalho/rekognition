import * as trpc from '@trpc/server';
import { TRPCError } from '@trpc/server';
import * as trpcNext from '@trpc/server/adapters/next';
import * as AWS from 'aws-sdk';
import Rekognition from 'aws-sdk/clients/rekognition';
import S3 from 'aws-sdk/clients/s3';
import { z } from 'zod';
import { uuid } from '../../../utils/uuid';

// configure aws global credentials
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
      // console.log(res.Faces);
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
      } catch (e) {
        console.error(e);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to index face',
        });
      }
      const base64Img = input.image.replace('data:image/jpeg;base64,', '');
      const imgBuffer = Buffer.from(base64Img, 'base64');
      // create a unique id for the image
      const imageId = uuid();
      // Add face to rekognition collection
      await rekog
        .indexFaces({
          CollectionId: 'controle-acesso',
          ExternalImageId: imageId,
          Image: {
            Bytes: imgBuffer,
          },
        })
        .promise();
      // Add face to s3 bucket
      await s3
        .putObject({
          Bucket: 'controle-acesso',
          Key: 'faces/' + imageId + '.jpg',
          Body: imgBuffer,
        })
        .promise();
      return true;
    },
  })
  .mutation('searchFaceByImage', {
    input: z.object({
      image: z.string(),
    }),
    async resolve({ input }) {
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

      const images = [];
      // loop faces
      for (const face of res.FaceMatches ?? []) {
        // get the image from s3
        const s3Res = await s3
          .getObject({
            Bucket: 'controle-acesso',
            Key: 'faces/' + face.Face?.ExternalImageId + '.jpg',
          })
          .promise();
        // convert to base64
        const base64 = s3Res.Body?.toString('base64');
        images.push(base64);
      }
      return { matchedFaces: res.FaceMatches, images };
    },
  });

// export type definition of API
export type AppRouter = typeof appRouter;

// export API handler
export default trpcNext.createNextApiHandler({
  router: appRouter,
  createContext: () => null,
});
