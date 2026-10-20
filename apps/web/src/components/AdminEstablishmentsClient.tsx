"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, apiGet, apiPost } from "../infrastructure/api/client";
import { useConfirm } from "./modal/ConfirmProvider";
import "./admin-establishments.css";

type AccessState = "temporary_password" | "expired" | "activated" | "revoked";
type Stage = "awaiting_activation" | "awaiting_profile" | "ready";
type Item = {
  id: string;
  name: string;
  internal_code: string | null;
  created_at: string;
  profile_completed_at: string | null;
  /* Mises à jour faites par l'établissement lui‑même (fiche, nom, logo) : l'équipe les voit sans rien demander. */
  updated_at: string | null;
  name_updated_at: string | null;
  original_name: string;
  logo: string;
  stage: Stage;
  administrator: { name: string; email: string } | null;
  access: { email: string; state: AccessState; expires_at: string | null } | null;
};
type Listing = { items: Item[]; total: number; truncated: boolean };
/* Réponse de création / renouvellement : le mot de passe temporaire n'y figure qu'une fois, il n'est ni stocké ni listé. */
type Created = {
  email: string;
  account_created: boolean;
  must_change_password: boolean;
  login_url: string;
  expires_at: string | null;
  temporary_password?: string;
  establishment?: { internal_code: string | null };
};
type Credentials = { structure: string; email: string; password: string; loginUrl: string; expiresAt: string | null };

const BLANK = { name: "", email: "", firstName: "", lastName: "", verified: false };

/* Libellé et couleur de badge du suivi : une seule étiquette par structure, de la remise du mot de passe jusqu'à « Prête ». */
function followUp(item: Item): { label: string; tone: string } {
  if (item.stage === "ready") return { label: "Prête", tone: "active" };
  if (item.stage === "awaiting_profile") return { label: "Fiche à compléter", tone: "pending" };
  switch (item.access?.state) {
    case "temporary_password": return { label: "Mot de passe temporaire remis", tone: "pending" };
    case "expired": return { label: "Mot de passe expiré", tone: "expired" };
    case "revoked": return { label: "Accès révoqué", tone: "revoked" };
    default: return { label: "Sans responsable", tone: "expired" };
  }
}

const errorCode = (reason: unknown) => (reason instanceof ApiError && reason.details && typeof reason.details === "object" ? (reason.details as { code?: string }).code : undefined);

const when = (value: string | null) => (value ? new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");
const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

/* L'équipe Mon E‑Carnet saisit le nom vérifié de la structure et l'e‑mail de son responsable. Le serveur mémorise l'e‑mail, crée le
   compte avec un mot de passe temporaire et le révèle ici une seule fois : l'équipe le transmet hors application. Le responsable se
   connecte avec son e‑mail et ce mot de passe, doit le remplacer, puis complète lui‑même la fiche de son établissement. */
export function AdminEstablishmentsClient({ aside }: { aside?: ReactNode }) {
  const confirm = useConfirm();
  const [form, setForm] = useState(BLANK);
  const [listing, setListing] = useState<Listing | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    let active = true;
    apiGet<Listing>("/api/v1/establishments/startup/establishments/")
      .then((data) => { if (active) { setListing(data); setError(""); } })
      .catch((reason) => { if (active) setError(errorText(reason, "Liste indisponible.")); });
    return () => { active = false; };
  }, [tick]);

  const refresh = () => setTick((value) => value + 1);

  function resetFeedback() {
    setMessage("");
    setError("");
    setCredentials(null);
    setCopyStatus("");
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    resetFeedback();
    try {
      await action();
      setMessage(success);
      refresh();
    } catch (reason) {
      setError(errorText(reason, "Action impossible."));
    } finally {
      setBusy(false);
    }
  }

  async function create(options: { allowDuplicate?: boolean; useExistingAccount?: boolean } = {}) {
    const body = {
      name: form.name,
      responsible_email: form.email,
      responsible_first_name: form.firstName,
      responsible_last_name: form.lastName,
      verification_confirmed: form.verified,
      allow_duplicate: options.allowDuplicate || undefined,
      use_existing_account: options.useExistingAccount || undefined,
    };
    setBusy(true);
    resetFeedback();
    try {
      const created = await apiPost<Created>("/api/v1/establishments/startup/establishments/", body);
      const code = created.establishment?.internal_code ? ` (code ${created.establishment.internal_code})` : "";
      if (created.temporary_password) {
        setCredentials({ structure: form.name.trim(), email: created.email, password: created.temporary_password, loginUrl: created.login_url, expiresAt: created.expires_at });
        setMessage(`Accès créé${code}. Transmettez ses identifiants au responsable : le mot de passe temporaire ne sera plus affiché.`);
      } else {
        setMessage(`Accès créé${code}. Le compte de ${created.email} existait déjà : il est rattaché à la structure et garde son mot de passe. Prévenez le responsable de se connecter avec son mot de passe habituel.`);
      }
      setForm(BLANK);
      refresh();
    } catch (reason) {
      const code = errorCode(reason);
      if (reason instanceof ApiError && reason.status === 409 && code === "duplicate_name" && !options.allowDuplicate) {
        setBusy(false);
        const again = await confirm({ title: "Une structure porte déjà ce nom", message: reason.message, note: "Ne continuez que s’il s’agit bien d’un autre établissement homonyme.", confirmLabel: "Créer quand même", tone: "danger" });
        if (again) await create({ ...options, allowDuplicate: true });
        return;
      }
      if (reason instanceof ApiError && reason.status === 409 && code === "account_exists" && !options.useExistingAccount) {
        setBusy(false);
        const link = await confirm({ title: "Un compte existe déjà avec cet e‑mail", message: reason.message, note: "Son mot de passe ne sera pas modifié : le responsable se connectera avec celui qu’il utilise déjà.", confirmLabel: "Rattacher ce compte", cancelLabel: "Revoir l’e‑mail", tone: "danger" });
        if (link) await create({ ...options, useExistingAccount: true });
        return;
      }
      setError(errorText(reason, "Création impossible."));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const accepted = await confirm({
      title: `Créer l’accès de « ${name} » ?`,
      message: `Le compte de ${email} sera créé avec un mot de passe temporaire, affiché une seule fois ici pour que vous le transmettiez. À sa première connexion, le responsable devra le remplacer, puis il complétera la fiche de l’établissement.`,
      note: "Le nom saisi ici est celui que vous avez vérifié : l’établissement ne pourra plus le modifier.",
      confirmLabel: "Créer l’accès",
      cancelLabel: "Revoir",
    });
    if (accepted) await create();
  }

  async function reissue(item: Item) {
    const email = item.access?.email;
    if (!email) return;
    const accepted = await confirm({
      title: item.access?.state === "revoked" ? "Rouvrir l’accès ?" : "Nouveau mot de passe temporaire ?",
      message: `Un nouveau mot de passe temporaire sera créé pour ${email}. Le précédent cessera de fonctionner.`,
      confirmLabel: "Générer le mot de passe",
    });
    if (!accepted) return;
    setBusy(true);
    resetFeedback();
    try {
      const created = await apiPost<Created>(`/api/v1/establishments/startup/${item.id}/administrator-invitation/`, {});
      if (created.temporary_password) {
        setCredentials({ structure: item.name, email: created.email, password: created.temporary_password, loginUrl: created.login_url, expiresAt: created.expires_at });
        setMessage(`Nouveau mot de passe temporaire créé pour ${email}. Le précédent est invalidé ; transmettez celui-ci, il ne sera plus affiché.`);
      }
      refresh();
    } catch (reason) {
      setError(errorText(reason, "Renouvellement impossible."));
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, done: string, fieldId: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard indisponible");
      await navigator.clipboard.writeText(text);
      setCopyStatus(done);
    } catch {
      const input = document.getElementById(fieldId) as HTMLInputElement | null;
      input?.focus();
      input?.select();
      setCopyStatus("Copie automatique indisponible : le champ est sélectionné, copiez-le manuellement.");
    }
  }

  function transmissionMessage(value: Credentials) {
    return [
      `Mon E‑Carnet — accès administrateur de « ${value.structure} »`,
      `Connexion : ${value.loginUrl}`,
      `Identifiant (e‑mail) : ${value.email}`,
      `Mot de passe temporaire : ${value.password}`,
      "",
      `À votre première connexion, vous devrez choisir un nouveau mot de passe${value.expiresAt ? ` (mot de passe temporaire valable jusqu’au ${when(value.expiresAt)})` : ""}, puis compléter la fiche de votre établissement.`,
    ].join("\n");
  }

  async function revoke(item: Item) {
    const email = item.access?.email;
    if (!email) return;
    const accepted = await confirm({
      title: "Révoquer cet accès ?",
      message: `Le mot de passe temporaire de ${email} ne pourra plus être utilisé.`,
      note: "Vous pourrez toujours générer un nouveau mot de passe temporaire ensuite.",
      confirmLabel: "Révoquer l’accès",
      tone: "danger",
    });
    if (accepted) await run(() => apiPost(`/api/v1/establishments/startup/${item.id}/administrator-invitation/revoke/`, {}), "Accès révoqué.");
  }

  const canSubmit = form.name.trim() !== "" && form.email.trim() !== "" && form.verified && !busy;

  return (
    <>
      <article className="card">
        <span className="eyebrow">Création après validation</span>
        <h2>Créer un établissement et ouvrir l’accès de son responsable</h2>
        <p className="muted">L’établissement transmet ses justificatifs par le canal officiel. Après vérification hors application, saisissez seulement son nom et l’e‑mail de son responsable : le compte est créé avec un mot de passe temporaire, et l’établissement complète le reste lui‑même.</p>
        <form className="grid" onSubmit={submit}>
          <label className="field"><span>Nom de l’établissement (vérifié)</span><input required maxLength={180} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="off" /></label>
          <label className="field"><span>E‑mail du responsable (son identifiant de connexion)</span><input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="off" /></label>
          <div className="field-row">
            <label className="field"><span>Prénom du responsable (facultatif)</span><input maxLength={120} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} autoComplete="off" /></label>
            <label className="field"><span>Nom du responsable (facultatif)</span><input maxLength={120} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} autoComplete="off" /></label>
          </div>
          <label className="check-row"><input type="checkbox" checked={form.verified} onChange={(event) => setForm({ ...form, verified: event.target.checked })} /><span>J’ai vérifié les pièces de la structure et l’identité de son responsable, hors application.</span></label>
          <p className="muted">Sans prénom ni nom, le responsable les renseigne en choisissant son mot de passe. Aucun e‑mail n’est envoyé : le mot de passe temporaire s’affiche ci-dessous, une seule fois, pour que vous le lui transmettiez par un canal sûr.</p>
          <button className="button primary" type="submit" disabled={!canSubmit}>Créer l’accès</button>
        </form>
        <p className="notice" role="status" aria-live="polite" hidden={!message}>{message}</p>
        <p className="notice error" role="alert" hidden={!error}>{error}</p>
        {credentials && (
          <div className="notice" role="group" aria-label="Identifiants à transmettre">
            <p><strong>Identifiants de « {credentials.structure} » — à transmettre au responsable.</strong> Le mot de passe temporaire ne sera plus affichable après fermeture de ce bloc{credentials.expiresAt ? `, et expire le ${when(credentials.expiresAt)}` : ""}. Le responsable devra le remplacer dès sa première connexion.</p>
            <label className="field"><span>Adresse de connexion</span><input id="admin-establishment-login-url" type="url" value={credentials.loginUrl} readOnly autoComplete="off" spellCheck={false} onFocus={(event) => event.currentTarget.select()} /></label>
            <label className="field"><span>Identifiant (e‑mail)</span><input id="admin-establishment-login-email" type="text" value={credentials.email} readOnly autoComplete="off" spellCheck={false} onFocus={(event) => event.currentTarget.select()} /></label>
            <label className="field"><span>Mot de passe temporaire</span><input id="admin-establishment-temporary-password" type="text" value={credentials.password} readOnly autoComplete="off" spellCheck={false} onFocus={(event) => event.currentTarget.select()} style={{ fontFamily: "var(--font-mono, monospace)", letterSpacing: ".04em" }} /></label>
            <div className="admin-inline-actions">
              <button type="button" className="button small primary" onClick={() => void copy(transmissionMessage(credentials), "Message copié. Transmettez-le uniquement au responsable concerné.", "admin-establishment-temporary-password")}>Copier le message à transmettre</button>
              <button type="button" className="button small" onClick={() => void copy(credentials.password, "Mot de passe copié.", "admin-establishment-temporary-password")}>Copier le mot de passe</button>
              <button type="button" className="button small" onClick={() => { setCredentials(null); setCopyStatus(""); }}>J’ai transmis, masquer</button>
            </div>
            <p className="muted" role="status" aria-live="polite">{copyStatus}</p>
          </div>
        )}
      </article>

      {aside}

      <article className="card admin-table-card">
        <div className="admin-table-title">
          <div><span className="eyebrow">Suivi</span><h2>Établissements créés{listing ? ` (${listing.total})` : ""}</h2></div>
          <button type="button" className="button small" onClick={refresh} disabled={busy}>Actualiser</button>
        </div>
        {!listing && !error && <p className="muted">Chargement…</p>}
        {listing && listing.items.length === 0 && <p className="muted">Aucun établissement créé pour l’instant.</p>}
        {listing && listing.items.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--stack">
              <thead><tr><th scope="col">Établissement</th><th scope="col">Responsable</th><th scope="col">Suivi</th><th scope="col">Mot de passe temporaire</th><th scope="col">Dernière mise à jour</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {listing.items.map((item) => {
                  const status = followUp(item);
                  const state = item.access?.state;
                  const pendingActivation = item.stage === "awaiting_activation";
                  const renamed = Boolean(item.name_updated_at && item.original_name);
                  return (
                    <tr key={item.id}>
                      <th scope="row">
                        <span className="admin-structure">
                          <span className="admin-structure__logo" aria-hidden="true">{item.logo ? <img src={item.logo} alt="" loading="lazy" /> : item.name.slice(0, 2).toUpperCase()}</span>
                          <span className="admin-structure__text"><strong>{item.name}</strong><span className="muted">{item.internal_code ?? "sans code"}</span></span>
                        </span>
                        {renamed && <small className="admin-renamed">Renommé par l’établissement le {when(item.name_updated_at)} · nom vérifié : {item.original_name}</small>}
                      </th>
                      <td data-label="Responsable">{item.administrator ? <>{item.administrator.name || "—"}<br /><span className="muted admin-break">{item.administrator.email}</span></> : <span className="muted admin-break">{item.access?.email ?? "—"}</span>}</td>
                      <td data-label="Suivi"><span className={`badge ${status.tone}`}>{status.label}</span></td>
                      <td data-label="Mot de passe temporaire">{state === "temporary_password" && item.access?.expires_at ? <>Expire le {when(item.access.expires_at)}</> : state === "expired" ? <>Expiré</> : <span className="muted">—</span>}</td>
                      <td data-label="Dernière mise à jour">{item.profile_completed_at ? when(item.updated_at) : <span className="muted">Fiche non remplie</span>}</td>
                      <td className="admin-table__actions">
                        {pendingActivation && item.access && (
                          <span className="admin-inline-actions">
                            <button type="button" className="button small" disabled={busy} onClick={() => void reissue(item)}>{state === "revoked" ? "Rouvrir l’accès" : "Nouveau mot de passe"}</button>
                            {(state === "temporary_password" || state === "expired") && <button type="button" className="button small danger" disabled={busy} onClick={() => void revoke(item)}>Révoquer</button>}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {listing?.truncated && <p className="muted">Seuls les {listing.items.length} établissements les plus récents sont affichés.</p>}
      </article>
    </>
  );
}
