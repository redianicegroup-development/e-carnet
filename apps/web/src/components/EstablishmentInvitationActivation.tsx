"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiGet, apiPost } from "../infrastructure/api/client";

type Preview = { establishment_name: string; email_hint: string; account_exists: boolean; needs_names: boolean };
type Accepted = { establishment_id: string; email: string; account_created: boolean; profile_required: boolean };
type Load = { status: "loading" } | { status: "invalid"; message: string } | { status: "ready"; preview: Preview };

/* Page ouverte depuis le lien reçu par e‑mail. Le jeton n'est jamais conservé ni affiché. Un compte existant n'est jamais
   modifié par ce lien : la personne se connecte d'abord avec son compte, puis active l'accès depuis cette même page. */
export function EstablishmentInvitationActivation() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [values, setValues] = useState({ firstName: "", lastName: "", password: "", confirmation: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const query = token ? apiGet<Preview>(`/api/v1/establishments/invitations/preview/?token=${encodeURIComponent(token)}`) : Promise.reject(new Error("Ce lien d’invitation est incomplet."));
    query
      .then((preview) => { if (active) setLoad({ status: "ready", preview }); })
      .catch((error) => { if (active) setLoad({ status: "invalid", message: error instanceof Error ? error.message : "Cette invitation est invalide, expirée ou déjà utilisée." }); });
    return () => { active = false; };
  }, [token]);

  async function accept(body: Record<string, string>, nextAfter: (result: Accepted) => string) {
    setBusy(true);
    setMessage("");
    try {
      const result = await apiPost<Accepted>("/api/v1/establishments/invitations/accept/", { token, ...body });
      setMessage("Accès activé. Redirection…");
      router.push(nextAfter(result));
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Cette invitation ne peut pas être activée.");
      setBusy(false);
    }
  }

  function createAccount(event: FormEvent) {
    event.preventDefault();
    if (values.password !== values.confirmation) { setMessage("Les deux mots de passe doivent être identiques."); return; }
    const names: Record<string, string> = load.status === "ready" && load.preview.needs_names ? { first_name: values.firstName.trim(), last_name: values.lastName.trim() } : {};
    // Pas de session ouverte après l'activation : on passe par la connexion, qui ramène ensuite sur la fiche à compléter.
    void accept({ password: values.password, ...names }, () => "/connexion?next=%2Fetablissement%2Ffiche");
  }

  const here = typeof window === "undefined" ? "" : `${window.location.pathname}${window.location.search}`;

  return (
    <main className="auth-shell">
      <section className="card auth-form" aria-labelledby="activation-title">
        <span className="eyebrow">Invitation établissement</span>
        <h1 id="activation-title">Activer votre accès</h1>
        {load.status === "loading" && <p className="muted" role="status">Vérification de l’invitation…</p>}
        {load.status === "invalid" && (
          <>
            <p className="notice error" role="alert">{load.message}</p>
            <p className="muted">Demandez à l’équipe Mon E‑Carnet de vous renvoyer une invitation.</p>
          </>
        )}
        {load.status === "ready" && (
          <>
            <p className="muted">Vous êtes invité(e) à administrer <strong>{load.preview.establishment_name}</strong> ({load.preview.email_hint}). Vous compléterez ensuite la fiche de l’établissement.</p>
            {load.preview.account_exists ? (
              <div className="grid">
                <p className="notice" role="note">Un compte Mon E‑Carnet existe déjà avec cette adresse. Par sécurité, ce lien ne le modifie pas : connectez‑vous avec ce compte, puis revenez sur cette page pour activer l’accès.</p>
                <Link className="button" href={`/connexion?next=${encodeURIComponent(here)}`}>Me connecter avec ce compte</Link>
                <button className="button primary" type="button" disabled={busy} onClick={() => void accept({}, (result) => (result.profile_required ? "/etablissement/fiche" : "/etablissement"))}>J’ai activé ma session : activer l’accès</button>
              </div>
            ) : (
              <form className="grid" onSubmit={createAccount}>
                {load.preview.needs_names && (
                  <div className="field-row">
                    <label className="field"><span>Prénom</span><input required maxLength={120} autoComplete="given-name" value={values.firstName} onChange={(event) => setValues({ ...values, firstName: event.target.value })} /></label>
                    <label className="field"><span>Nom</span><input required maxLength={120} autoComplete="family-name" value={values.lastName} onChange={(event) => setValues({ ...values, lastName: event.target.value })} /></label>
                  </div>
                )}
                <label className="field"><span>Nouveau mot de passe (12 caractères minimum)</span><input type="password" required minLength={12} autoComplete="new-password" value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })} /></label>
                <label className="field"><span>Confirmer le mot de passe</span><input type="password" required minLength={12} autoComplete="new-password" value={values.confirmation} onChange={(event) => setValues({ ...values, confirmation: event.target.value })} /></label>
                <button className="button primary" type="submit" disabled={busy}>Activer mon compte</button>
              </form>
            )}
          </>
        )}
        <p className="status" role="status" aria-live="polite" hidden={!message}>{message}</p>
      </section>
    </main>
  );
}
