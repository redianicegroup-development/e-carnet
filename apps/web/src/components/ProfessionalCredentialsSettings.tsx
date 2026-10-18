"use client";

import { useState } from "react";
import { apiUploadPatch } from "../infrastructure/api/client";

type Credentials = {
  professional_identifier: string;
  stamp_uploaded: boolean;
  signature_uploaded: boolean;
};

export function ProfessionalCredentialsSettings({ profile, onSaved }: { profile: Credentials; onSaved: (profile: Credentials) => void }) {
  const [identifier, setIdentifier] = useState(profile.professional_identifier ?? "");
  const [stamp, setStamp] = useState<File | null>(null);
  const [signature, setSignature] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.append("professional_identifier", identifier.trim());
      if (stamp) form.append("stamp", stamp);
      if (signature) form.append("signature", signature);
      const saved = await apiUploadPatch<Credentials>("/api/v1/professionals/credentials/", form);
      onSaved(saved);
      setStamp(null);
      setSignature(null);
      setMessage("Informations d’ordonnance enregistrées.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="settings-modal-section" onSubmit={submit}>
    <span className="eyebrow">Ordonnance</span>
    <h3>Coordonnées du prescripteur</h3>
    <p className="muted">Le numéro d’ordre est imprimé sur vos ordonnances. Le cachet et la signature sont facultatifs et ne sont affichés que si vous avez déposé vos propres fichiers PNG.</p>
    <label className="field"><span>Numéro d’ordre professionnel déclaré</span><input maxLength={120} value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Votre numéro professionnel déclaré" /></label>
    <label className="field"><span>Cachet personnel (PNG)</span><input type="file" accept="image/png" onChange={(event) => setStamp(event.target.files?.[0] ?? null)} /><small className="muted">PNG réel, 2 Mo maximum, dimensions 32 à 2048 px. {profile.stamp_uploaded ? "Un cachet est déjà déposé." : "Aucun cachet déposé."}</small></label>
    <label className="field"><span>Signature personnelle (PNG)</span><input type="file" accept="image/png" onChange={(event) => setSignature(event.target.files?.[0] ?? null)} /><small className="muted">PNG réel, 2 Mo maximum, dimensions 32 à 2048 px. {profile.signature_uploaded ? "Une signature est déjà déposée." : "Aucune signature déposée."}</small></label>
    <div className="actions"><button className="button primary" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button></div>
    <p className="status" role="status" aria-live="polite">{message}</p>
  </form>;
}
