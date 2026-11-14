"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiGet, apiPost } from "../../infrastructure/api/client";
import { isSessionMissing } from "../../lib/session";
import { PasswordField } from "./PasswordField";

type Account = {
  email: string;
  first_name: string;
  last_name: string;
  must_change_password?: boolean;
  contexts?: { role: string; is_active: boolean; onboarding_completed: boolean }[];
};
type Load = { status: "loading" } | { status: "ready"; account: Account } | { status: "error"; message: string };

const MIN_LENGTH = 12;

/* Où aller une fois le mot de passe choisi : un responsable d'établissement termine sa fiche, les autres comptes retrouvent leur espace. */
export function destinationAfterPasswordChange(account: Pick<Account, "contexts">): string {
  const context = account.contexts?.find((item) => item.is_active) ?? account.contexts?.[0];
  if (context?.role === "establishment") return context.onboarding_completed ? "/etablissement" : "/etablissement/fiche";
  if (context?.role === "professional") return context.onboarding_completed ? "/professionnel" : "/professionnel/onboarding";
  return "/patient";
}

/* Écran imposé à la première connexion avec un mot de passe temporaire remis par l'équipe Mon E‑Carnet. Le serveur ferme tout le reste
   de l'API tant que ce changement n'est pas fait : cet écran n'est que la façon de le faire. */
export function PasswordChangeRequired() {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [values, setValues] = useState({ current: "", next: "", confirmation: "", firstName: "", lastName: "" });
  const [needsCurrent, setNeedsCurrent] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    apiGet<Account>("/api/v1/identity/me/")
      .then((account) => {
        if (!active) return;
        if (!account.must_change_password) { router.replace(destinationAfterPasswordChange(account)); return; }
        setLoad({ status: "ready", account });
      })
      .catch((reason) => {
        if (!active) return;
        if (isSessionMissing(reason)) { router.replace("/connexion"); return; }
        setLoad({ status: "error", message: reason instanceof Error ? reason.message : "Service momentanément indisponible." });
      });
    return () => { active = false; };
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (load.status !== "ready") return;
    const needsNames = !load.account.first_name || !load.account.last_name;
    if (values.next.length < MIN_LENGTH) { setMessage(`Le nouveau mot de passe doit contenir au moins ${MIN_LENGTH} caractères.`); return; }
    if (values.next !== values.confirmation) { setMessage("Les deux mots de passe doivent être identiques."); return; }
    if (needsCurrent && values.next === values.current) { setMessage("Choisissez un mot de passe différent du mot de passe temporaire."); return; }
    if (needsNames && (!values.firstName.trim() || !values.lastName.trim())) { setMessage("Renseignez votre prénom et votre nom."); return; }
    setBusy(true);
    setMessage("");
    try {
      const account = await apiPost<Account>("/api/v1/identity/me/password/", {
        ...(needsCurrent ? { current_password: values.current } : {}),
        new_password: values.next,
        ...(needsNames ? { first_name: values.firstName.trim(), last_name: values.lastName.trim() } : {}),
      });
      setMessage("Mot de passe enregistré. Ouverture de votre espace…");
      router.replace(destinationAfterPasswordChange(account));
    } catch (reason) {
      const code = reason instanceof ApiError && reason.details && typeof reason.details === "object" ? (reason.details as { code?: string }).code : undefined;
      if (code === "current_password_required") setNeedsCurrent(true);
      setMessage(reason instanceof ApiError ? reason.message : "Le mot de passe n’a pas pu être enregistré. Réessayez.");
      setBusy(false);
    }
  }

  const needsNames = load.status === "ready" && (!load.account.first_name || !load.account.last_name);

  return (
    <main className="auth-shell">
      <section className="card auth-form" aria-labelledby="new-password-title">
        <span className="eyebrow">Première connexion</span>
        <h1 id="new-password-title">Choisissez votre mot de passe</h1>
        {load.status === "loading" && <p className="muted" role="status">Vérification de votre session…</p>}
        {load.status === "error" && <p className="notice error" role="alert">{load.message}</p>}
        {load.status === "ready" && (
          <form className="grid" onSubmit={submit} aria-busy={busy}>
            <p className="muted">Vous vous êtes connecté(e) avec un mot de passe temporaire. Pour protéger votre compte, choisissez maintenant votre mot de passe : le temporaire ne pourra plus servir ensuite.</p>
            {needsNames && (
              <div className="field-row">
                <label className="field"><span>Prénom</span><input required autoComplete="given-name" maxLength={80} value={values.firstName} onChange={(event) => setValues({ ...values, firstName: event.target.value })} /></label>
                <label className="field"><span>Nom</span><input required autoComplete="family-name" maxLength={80} value={values.lastName} onChange={(event) => setValues({ ...values, lastName: event.target.value })} /></label>
              </div>
            )}
            {needsCurrent && <PasswordField id="current-password" label="Mot de passe temporaire" required autoComplete="current-password" value={values.current} onChange={(event) => setValues({ ...values, current: event.target.value })} />}
            <PasswordField id="new-password" label="Nouveau mot de passe" required minLength={MIN_LENGTH} autoComplete="new-password" aria-describedby="new-password-hint" value={values.next} onChange={(event) => setValues({ ...values, next: event.target.value })} hint={<small id="new-password-hint" className="muted">{MIN_LENGTH} caractères minimum. Choisissez un mot de passe que vous n’utilisez pas ailleurs.</small>} />
            <PasswordField id="confirm-password" label="Confirmer le nouveau mot de passe" required minLength={MIN_LENGTH} autoComplete="new-password" value={values.confirmation} onChange={(event) => setValues({ ...values, confirmation: event.target.value })} />
            <button className="button primary" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer mon mot de passe"}</button>
            <p className="status" role="status" aria-live="polite">{message}</p>
          </form>
        )}
      </section>
    </main>
  );
}
