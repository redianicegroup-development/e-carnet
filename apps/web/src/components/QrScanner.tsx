"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { CAMERA_MESSAGES, classifyCameraError, cleanScannedToken, hasCameraSupport, type CameraProblem } from "../lib/qr-scan";
import "./qr-scanner.css";

/* Lecteur de QR par la caméra. La vidéo est toujours dans la page dès l'ouverture du lecteur : c'est ce qui permet à la caméra de démarrer
   (avant, la vidéo n'existait qu'après le clic, donc rien ne se passait). La caméra est arrêtée dès qu'un QR est lu, qu'on ferme le lecteur
   ou qu'on quitte la page. Si la caméra est impossible, on propose de photographier le QR à la place. */
export function QrScanner({ onResult, onClose }: { onResult: (token: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onResultRef = useRef(onResult);
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [problem, setProblem] = useState<CameraProblem>("unknown");
  const [photoMessage, setPhotoMessage] = useState("");

  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let controls: IScannerControls | null = null;
    if (!hasCameraSupport(navigator)) {
      void Promise.resolve().then(() => {
        if (cancelled) return;
        setProblem(window.isSecureContext ? "unsupported" : "insecure");
        setStatus("error");
      });
      return () => { cancelled = true; };
    }
    const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 200 });
    reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: "environment" } } }, video, (result, _error, current) => {
      if (cancelled || !result) return;
      const token = cleanScannedToken(result.getText());
      if (!token) return;
      cancelled = true;
      current.stop();
      onResultRef.current(token);
    }).then((started) => {
      if (cancelled) { started.stop(); return; }
      controls = started;
      setStatus("scanning");
    }).catch((error: unknown) => {
      if (cancelled) return;
      setProblem(classifyCameraError(error, window.isSecureContext));
      setStatus("error");
    });
    return () => { cancelled = true; controls?.stop(); };
  }, []);

  async function readPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoMessage("Lecture de la photo…");
    const url = URL.createObjectURL(file);
    try {
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(url);
      const token = cleanScannedToken(result.getText());
      if (token) onResultRef.current(token); else setPhotoMessage("Aucun QR lisible sur cette photo. Rapprochez-vous et réessayez.");
    } catch {
      setPhotoMessage("Aucun QR lisible sur cette photo. Rapprochez-vous et réessayez.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return <div className="qr-scanner" role="group" aria-label="Lecteur de QR du patient">
    <div className="qr-scanner__frame" hidden={status === "error"}>
      <video ref={videoRef} className="qr-scanner__video" autoPlay muted playsInline aria-label="Caméra de lecture du QR" />
      <span className="qr-scanner__target" aria-hidden="true" />
    </div>
    <p className="qr-scanner__status" role="status" aria-live="polite">
      {status === "starting" && "Démarrage de la caméra… Autorisez-la si le navigateur le demande."}
      {status === "scanning" && "Placez le QR du patient dans le cadre. La lecture est automatique."}
      {status === "error" && CAMERA_MESSAGES[problem]}
    </p>
    {status === "error" && <label className="button qr-scanner__photo">Photographier le QR<input type="file" accept="image/*" capture="environment" onChange={(event) => { void readPhoto(event.target.files?.[0]); event.target.value = ""; }} /></label>}
    {photoMessage && <p className="status" role="status" aria-live="polite">{photoMessage}</p>}
    <div className="actions"><button type="button" className="button" onClick={onClose}>Annuler</button></div>
  </div>;
}
