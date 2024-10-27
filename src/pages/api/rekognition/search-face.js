import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: process.env.PB_ACCESS_KEY_ID,
  secretAccessKey: process.env.PB_SECRET_ACCESS_KEY,
  region: process.env.PB_REGION,
});

const rekognition = new AWS.Rekognition();

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { image } = req.body;

    // Remover o prefixo "data:image/jpeg;base64," da imagem
    const base64Data = image.replace(/^data:image\/jpeg;base64,/, '');

    const params = {
      CollectionId: 'controle-acesso',
      Image: {
        Bytes: Buffer.from(base64Data, 'base64'),
      },
      MaxFaces: 1,
    };

    try {
      const data = await rekognition.searchFacesByImage(params).promise();
      return res.status(200).json({ matchedFaces: data.FaceMatches }); // Retorno no caso de sucesso
    } catch (error) {
      console.error('Erro ao buscar rosto:', error);
      return res.status(500).json({ error: 'Erro ao buscar rosto' }); // Retorno no caso de erro
    }
  } else {
    return res.status(405).json({ error: 'Método não permitido' }); // Retorno para métodos não suportados
  }
}
