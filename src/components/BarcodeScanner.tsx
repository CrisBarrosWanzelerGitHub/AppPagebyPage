import { useEffect, useRef, useState } from 'react';
import styles from './BarcodeScanner.module.css';

interface Props {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef   = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function start() {
      // Camera access
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch {
        setError('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
        return;
      }

      if (doneRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;

      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      // BarcodeDetector (nativo)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const BarcodeDetectorAPI = (window as any).BarcodeDetector;
      if (!BarcodeDetectorAPI) {
        setError('Seu navegador não suporta leitura de código de barras.\nUse Chrome (Android) ou Safari 17+ (iOS).');
        return;
      }

      const detector = new BarcodeDetectorAPI({ formats: ['ean_13', 'ean_8', 'code_128'] });

      timerRef.current = setInterval(async () => {
        if (doneRef.current || !videoRef.current) return;
        try {
          const results = await detector.detect(videoRef.current);
          if (results.length > 0 && !doneRef.current) {
            const code: string = results[0].rawValue;
            // Aceita ISBN-13 (978/979 + 10 dígitos) ou ISBN-10
            if (/^97[89]\d{10}$/.test(code) || /^\d{9}[\dX]$/i.test(code)) {
              doneRef.current = true;
              onDetected(code);
            }
          }
        } catch { /* frame não pronto ainda */ }
      }, 300);
    }

    start();

    return () => {
      doneRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [onDetected]);

  return (
    <div className={styles.overlay}>
      <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar scanner">×</button>

      {error ? (
        <p className={styles.errorMsg}>{error}</p>
      ) : (
        <>
          <video ref={videoRef} className={styles.video} playsInline muted />
          <div className={styles.guide}>
            <span className={`${styles.corner} ${styles.tl}`} />
            <span className={`${styles.corner} ${styles.tr}`} />
            <span className={`${styles.corner} ${styles.bl}`} />
            <span className={`${styles.corner} ${styles.br}`} />
            <span className={styles.scanLine} />
          </div>
          <p className={styles.hint}>Aponte para o código de barras do livro</p>
        </>
      )}
    </div>
  );
}
