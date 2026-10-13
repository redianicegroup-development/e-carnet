"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiGet, apiPost } from "../infrastructure/api/client";

export function RepresentationTransferRequest() {
  const [session, setSession] = useState<"checking" | "authenticated" | "anonymous" | "error">("checking");
  const [patientId, setPatientId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiGet("/api/v1/identity/me/")
      .then(() => setSession("authenticated"))
      .catch((error: unknown) => {
        setSession(error instanceof ApiError && error.status === 401 ? "anonymous" : "error");
      });
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("Vérification de la demande…");
    try {
      await apiPost("/api/v1/patient/representations/transfers/", { patient_id: patientId.trim() });
      setMessage("Demande reçue. Le dossier ne sera transféré qu’après vérification manuelle de l’âge légal. Aucun carnet ne sera fusionné ou supprimé.");
      setPatientId("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "La demande n’a pas pu être envoyée.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card auth-form" onSubmit={(event) => void submit(event)}>
      <span className="eyebrow">Transfert de dossier représenté</span>
      <h1>Demander mon autonomie.</h1>
      <p className="muted">Connectez-vous d’abord avec votre propre compte et le moyen de connexion que vous souhaitez conserver. Le transfert est soumis à une vérification manuelle de l’âge légal; il ne copie ni ne supprime les données du dossier existant.</p>
      {session === "checking" && <p role="status">Vérification de votre connexion…</p>}
      {session === "anonymous" && <div className="stack"><p>Connectez-vous ou créez votre compte, puis revenez ici avec l’identifiant communiqué par votre représentant. Ne créez pas encore de dossier patient.</p><div className="actions"><Link className="button primary" href="/connexion?next=%2Fpatient%2Ftransfert">Me connecter</Link><Link className="button" href="/connexion?mode=register&amp;next=%2Fpatient%2Ftransfert">Créer mon compte</Link></div></div>}
      {session === "error" && <p className="notice" role="alert">Impossible de vérifier la connexion. Réessayez lorsque le service est disponible.</p>}
      {session === "authenticated" && <>
      <label className="field"><span>Identifiant du dossier communiqué par votre représentant</span><input required type="text" inputMode="text" autoComplete="off" value={patientId} onChange={(event) => setPatientId(event.target.value)} disabled={busy} /></label>
      <p className="notice" role="note">Après validation, le dossier existant sera rattaché à votre compte. Le représentant perdra son accès; l’historique clinique et les identifiants du dossier seront conservés.</p>
      <button className="button primary" type="submit" disabled={busy}>{busy ? "Envoi…" : "Envoyer ma demande"}</button>
      </>}
      <p className="status" role="status" aria-live="polite">{message}</p>
    </form>
  );
}
