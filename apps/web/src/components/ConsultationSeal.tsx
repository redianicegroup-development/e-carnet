"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet, apiUploadPatch } from "../infrastructure/api/client";
import { InkCapture } from "./InkCapture";
import { useSealImage, type SealKind } from "./useSealImage";
import "./ink-capture.css";

type Credentials = { stamp_uploaded: boolean; signature_uploaded: boolean };

/** Une consultation ne se valide qu'avec une signature OU un cachet enregistrés (le serveur le refuse sinon). */
export function hasSeal(credentials: Credentials | null | undefined): boolean {
  return Boolean(credentials && (credentials.signature_uploaded || credentials.stamp_uploaded));
}

const ADD_LABEL: Record<SealKind, string> = { signature: "Signer (dessin ou photo)", stamp: "Ajouter mon cachet" };

/* Barrière de la validation : « Terminer et signer » reste fermé tant que le professionnel n'a ni signature ni cachet.
   Il les crée ici, sans quitter la consultation : il dessine sa signature au doigt ou à la souris, ou photographie sa signature ou son cachet
   (InkCapture détoure l'encre en image transparente). L'image est enregistrée tout de suite dans son profil : elle servira à toutes ses
   consultations et ordonnances, et chaque consultation validée en garde sa propre copie pour toujours, même s'il la remplace plus tard. */
export function ConsultationSeal({ onReadyChange }: { onReadyChange?: (ready: boolean) => void }) {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [capturing, setCapturing] = useState<SealKind | null>(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    apiGet<Credentials>("/api/v1/professionals/credentials/")
      .then((loaded) => { if (active) { setCredentials(loaded); setLoadError(false); } })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [attempt]);

  const ready = hasSeal(credentials);
  useEffect(() => { onReadyChange?.(ready); }, [ready, onReadyChange]);

  const stamp = useSealImage("stamp", Boolean(credentials?.stamp_uploaded), version);
  const signature = useSealImage("signature", Boolean(credentials?.signature_uploaded), version);

  async function save(kind: SealKind, file: File) {
    setSaving(true);
    setMessage("");
    try {
      const form = new FormData();
      form.append(kind, file);
      const saved = await apiUploadPatch<Credentials>("/api/v1/professionals/credentials/", form);
      setCredentials(saved);
      setVersion((value) => value + 1);
      setCapturing(null);
      setMessage(kind === "signature" ? "Signature enregistrée." : "Cachet enregistré.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  if (loadError && !credentials) {
    return <div className="seal-recap seal-recap--required" role="alert">
      <p>Impossible de vérifier votre signature ou votre cachet. Sans eux, la consultation ne peut pas être validée.</p>
      <button type="button" className="button" onClick={() => setAttempt((value) => value + 1)}>Réessayer</button>
    </div>;
  }
  if (!credentials) return <p className="muted" role="status">Vérification de votre signature et de votre cachet…</p>;

  const picker = capturing && <InkCapture kind={capturing} onCancel={() => { if (!saving) setCapturing(null); }} onUse={(file) => void save(capturing, file)} />;

  if (!ready) {
    return <div className="seal-recap seal-recap--required" role="group" aria-label="Signature ou cachet requis">
      <strong>Signature ou cachet requis pour valider</strong>
      <p>Signez ci-dessous au doigt, à la souris ou en photo, ou ajoutez votre cachet. Il est enregistré dans votre profil, apposé sur chaque consultation et ordonnance, et conservé pour toujours avec chaque consultation validée.</p>
      {!capturing && <div className="seal-field__actions">
        {(["signature", "stamp"] as const).map((kind) => <button key={kind} type="button" className="button" onClick={() => { setMessage(""); setCapturing(kind); }} disabled={saving}>{ADD_LABEL[kind]}</button>)}
      </div>}
      {picker}
      {saving && <p className="muted" role="status">Enregistrement…</p>}
      {message && <p className="status" role="alert">{message}</p>}
    </div>;
  }

  return <div className="seal-recap" aria-label="Signature et cachet de la consultation">
    <div className="seal-recap__items">
      {credentials.signature_uploaded && <div className="seal-preview seal-preview--paper">{signature ? <img src={signature} alt="Votre signature" /> : <span>Signature…</span>}</div>}
      {credentials.stamp_uploaded && <div className="seal-preview seal-preview--paper">{stamp ? <img src={stamp} alt="Votre cachet" /> : <span>Cachet…</span>}</div>}
    </div>
    <p>{credentials.signature_uploaded && credentials.stamp_uploaded ? "Votre signature et votre cachet" : credentials.signature_uploaded ? "Votre signature" : "Votre cachet"} seront apposés sur la consultation et l’ordonnance, avec la mention « Signé électroniquement dans Mon E‑Carnet ». Ils restent attachés à cette consultation pour toujours.</p>
    {!capturing && <div className="seal-field__actions">
      {(["signature", "stamp"] as const).filter((kind) => !(kind === "signature" ? credentials.signature_uploaded : credentials.stamp_uploaded)).map((kind) => <button key={kind} type="button" className="button small" onClick={() => { setMessage(""); setCapturing(kind); }} disabled={saving}>{kind === "signature" ? "Ajouter aussi ma signature" : "Ajouter aussi mon cachet"}</button>)}
      <Link className="text-link" href="/professionnel/parametres">Modifier dans mes paramètres</Link>
    </div>}
    {picker}
    {saving && <p className="muted" role="status">Enregistrement…</p>}
    {message && <p className="status" role="status">{message}</p>}
  </div>;
}
