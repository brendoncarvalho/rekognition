import * as faceapi from 'face-api.js';
import { useEffect, useRef, useState } from 'react';

export default function WebcamCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [lastFaceDetected, setLastFaceDetected] = useState<string | null>(null); // Armazenar a última face processada
  const [lastTimestamp, setLastTimestamp] = useState<number>(0); // Armazenar o timestamp da última captura

  useEffect(() => {
    const loadModels = async () => {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
    };

    const startCamera = async () => {
      if (videoRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        videoRef.current.srcObject = stream;
      }
    };

    loadModels().then(() => {
      startCamera();
    });
  }, []);

  useEffect(() => {
    const detectFace = async () => {
      const intervalId = setInterval(async () => {
        if (videoRef.current) {
          const detections = await faceapi.detectAllFaces(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions()
          );
          if (detections.length > 0) {
            console.log('Rosto detectado!');
            setIsFaceDetected(true);
            const currentTime = Date.now();

            // Definir intervalo de tempo entre capturas
            if (currentTime - lastTimestamp > 30000) {
              // Esperar 30 segundos antes de capturar novamente
              captureAndCompareFace(); // Captura e compara a face antes de enviar
              setLastTimestamp(currentTime);
            }
          } else {
            setIsFaceDetected(false);
          }
        }
      }, 500);
      return () => clearInterval(intervalId);
    };
    detectFace();
  }, [videoRef, lastTimestamp]);

  const captureAndCompareFace = async () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      compareWithLastFace(dataUrl); // Comparar a imagem com a última face processada
    }
  };

  const compareWithLastFace = async (imageSrc: string) => {
    // Enviar a imagem para verificar se o rosto já foi processado
    const response = await fetch('/api/rekognition/search-face', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageSrc }),
    });

    const data = await response.json();
    const { matchedFaces } = data;

    if (matchedFaces && matchedFaces.length > 0) {
      // Se o rosto já foi detectado recentemente, não faça nada
      console.log('Rosto já foi processado.');
      setLastFaceDetected(matchedFaces[0].FaceId); // Atualiza a última face detectada
    } else {
      // Se não houver rostos correspondentes, prossiga com a lógica de indexação
      console.log('Nenhum rosto correspondido.');
    }
  };

  const sendToRekognition = async (imageSrc: string) => {
    await fetch('/api/rekognition/index-face', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageSrc }),
    });

    console.log('Rosto enviado para o AWS Rekognition.');
  };

  return (
    <div>
      <video
        ref={videoRef}
        autoPlay
        style={{ width: '100%', borderRadius: '10px' }}
      />
      <div className="text-center mt-4">
        {isFaceDetected ? (
          <span className="text-green-500">Rosto Detectado!</span>
        ) : (
          <span className="text-red-500">Nenhum rosto detectado</span>
        )}
      </div>
    </div>
  );
}
