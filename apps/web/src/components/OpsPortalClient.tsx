"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError } from "../infrastructure/api/client";
import { opsLogin, opsLogout, opsSession } from "../infrastructure/api/ops";
import { AdminOperationsClient } from "./AdminOperationsClient";
import { BrandMark } from "./ui/BrandMark";
import { ScreenLoader } from "./ui/ScreenLoader";

type Phase = "checking" | "login" | "open";

/* Portail de surveillance technique. L'accès ne passe PAS par un compte Mon E-Carnet : on saisit l'identifiant et le secret que l'hébergeur a
   posés dans les variables d'environnement du serveur (ECARNET_OPS_PORTAL_ID et ECARNET_OPS_PORTAL_SECRET). Rien n'est mémorisé dans le navigateur
   à part un cookie de session de 30 minutes que la page ne peut pas lire. */
export function OpsPortalClient() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [identifier, setIdentifier] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    opsSession()
      .then((valid) => { if (alive) setPhase(valid ? "open" : "login"); })
      .catch(() => { if (alive) { setMessage("Connexion impossible. Vérifiez votre réseau puis réessayez."); setPhase("login"); } });
    return () => { alive = false; };
  }, []);

  const expired = useCallback(() => {
    setSecret("");
    setMessage("Votre session du portail a expiré. Reconnectez-vous.");
    setPhase("login");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await opsLogin(identifier.trim(), secret);
      setSecret("");
      setPhase("open");
    } catch (error) {
      setMessage(error instanceof ApiError || error instanceof Error ? error.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    await opsLogout();
    setIdentifier("");
    setSecret("");
    setMessage("Vous êtes déconnecté du portail.");
    setPhase("login");
  }

  if (phase === "checking") return <main className="admin-loader"><ScreenLoader label="Vérification de la session du portail…" /></main>;

  if (phase === "login") return <main className="shell admin-shell">
    <section className="admin-login card ops-portal" aria-labelledby="ops-title">
      <BrandMark />
      <span className="eyebrow">Accès exploitation</span>
      <h1 id="ops-title">Portail de surveillance</h1>
      <p className="muted">Réservé à l’exploitation technique. Saisissez votre adresse e-mail autorisée et le secret posés dans les variables d’environnement du serveur.</p>
      <form className="stack" onSubmit={(event) => void submit(event)} autoComplete="off">
        <label className="field"><span>Adresse e-mail</span><input type="email" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={busy} /></label>
        <label className="field"><span>Secret</span>
          <span className="ops-portal__secret">
            <input type={showSecret ? "text" : "password"} value={secret} onChange={(event) => setSecret(event.target.value)} required autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={busy} />
            <button className="button small" type="button" onClick={() => setShowSecret((value) => !value)} aria-pressed={showSecret}>{showSecret ? "Masquer" : "Afficher"}</button>
          </span>
        </label>
        {message && <p className="notice" role="alert">{message}</p>}
        <button className="button primary" type="submit" disabled={busy || !identifier.trim() || !secret}>{busy ? "Vérification…" : "Ouvrir le portail"}</button>
      </form>
      <p className="muted ops-portal__hint">Pas de compte Mon E-Carnet nécessaire. La session dure 30 minutes.</p>
    </section>
  </main>;

  return <main className="shell admin-shell ops-portal-open">
    <header className="ops-portal__bar">
      <div><span className="eyebrow">Mon E-Carnet · exploitation</span><strong>Portail de surveillance</strong></div>
      <button className="button small" type="button" onClick={() => void leave()}>Se déconnecter</button>
    </header>
    <AdminOperationsClient onSessionExpired={expired} />
  </main>;
}
