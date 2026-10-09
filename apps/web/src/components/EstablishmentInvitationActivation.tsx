"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function EstablishmentInvitationActivation() {
  const params = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("Définissez votre mot de passe pour activer votre accès nominatif.");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmation) { setMessage("Les deux mots de passe doivent être identiques."); return; }
    const csrf = await primeCsrf();
    const token = readCsrfToken();
    const response = await fetch(`${API}/api/v1/establishments/invitations/accept/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": token }, body: JSON.stringify({ token: params.get("token") ?? "", password }) });
    const payload = await response.json();
    if (!csrf.ok || !response.ok) { setMessage(payload.message ?? "Cette invitation ne peut pas être activée."); return; }
    setMessage("Accès activé. Vous pouvez maintenant vous connecter.");
    setTimeout(() => router.push("/connexion"), 600);
  }

  return <main className="auth-shell"><form className="card auth-form" onSubmit={submit}><span className="eyebrow">Invitation établissement</span><h1>Activer votre accès</h1><p className="muted">Le lien est personnel, à usage unique et valable 48 heures. Aucun mot de passe temporaire n’a été envoyé.</p><label className="field"><span>Nouveau mot de passe</span><input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="field"><span>Confirmer le mot de passe</span><input type="password" required minLength={8} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><button className="button primary" type="submit">Activer mon compte</button><p className="status" role="status">{message}</p></form></main>;
}
