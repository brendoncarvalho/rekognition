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
      Image: {
        Bytes: Buffer.from(base64Data, 'base64'),
      },
      Attributes: ['ALL'], // Retornar todas as características do rosto
    };

    rekognition.detectFaces(params, function (err, data) {
      if (err) {
        console.error('Erro ao detectar rostos:', err);
        return res.status(500).json({ error: 'Erro ao detectar rostos' });
      } else {
        return res.status(200).json(data);
      }
    });
  } else {
    res.status(405).json({ error: 'Método não permitido' });
  }
}
