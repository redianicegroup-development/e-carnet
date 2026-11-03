"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, apiGet, apiPatch, apiPost } from "../infrastructure/api/client";
import "./admin-recovery.css";

type RecoveryEvent = { id: string; event_type: string; label: string; email: string; name: string; failures: number | null; by_team?: boolean; created_at: string };
type LockedAccount = { id: number; email: string; name: string; failures: number; locked_until: string };
type HelpRequest = { id: string; name: string; contact_kind: "email" | "phone"; contact_value: string; message: string; status: "new" | "in_progress" | "resolved"; submitted_at: string };
type RecoveryData = {
  generated_at: string;
  summary: { failed_24h: number; blocked_24h: number; locked_now: number; verified_24h: number; resets_24h: number; help_open: number };
  events: RecoveryEvent[];
  locked_accounts: LockedAccount[];
  help_requests: HelpRequest[];
};
/** Ce que l'équipe voit d'un compte pour l'aider : des repères de vérification, jamais la réponse secrète ni un mot de passe. */
type AccountSummary = {
  id: number; name: string; email: string; joined_at: string; last_login: string | null; roles: string[];
  has_recovery_question: boolean; recovery_question: string; failures: number; locked_until: string | null;
  temporary_password_pending: boolean; temporary_password_expires_at: string | null; protected: boolean; active: boolean;
};
type TemporaryPassword = { temporary_password: string; expires_at: string; account: AccountSummary };

const STATUS: { value: HelpRequest["status"]; label: string }[] = [
  { value: "new", label: "Nouvelle" },
  { value: "in_progress", label: "En cours" },
  { value: "resolved", label: "Traitée" },
];
const ROLE_LABELS: Record<string, string> = { patient: "Patient", professional: "Professionnel", establishment: "Établissement" };
/** Gravité visuelle d'un événement : de l'information (acceptée, réinitialisée) à l'alerte (blocage). */
const TONE: Record<string, string> = {
  "account.recovery_answer_failed": "warn",
  "account.recovery_attempt_blocked": "warn",
  "account.recovery_locked": "danger",
  "account.recovery_answer_verified": "ok",
  "account.password_reset_by_recovery": "ok",
  "account.recovery_method_configured": "info",
  "account.recovery_unlocked_by_admin": "ok",
  "account.temporary_password_issued_by_admin": "ok",
};
const formatDate = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const errorText = (error: unknown, fallback: string) => (error instanceof ApiError || error instanceof Error ? error.message : fallback);

/** Récupérations de compte : ce qui s'est passé (réponses fausses, blocages, réponses acceptées, réinitialisations),
    les comptes bloqués maintenant, les demandes « Écrire à l'équipe » — et de quoi aider la personne.

    L'équipe n'a pas besoin de lire un secret : la réponse n'existe qu'en hachage à sens unique, et la lire reviendrait à pouvoir entrer
    dans n'importe quel compte. Pour aider, elle retrouve le compte, compare les repères que la personne doit connaître (question choisie,
    inscription, dernier accès), puis lève le blocage ou remet un mot de passe temporaire (affiché une seule fois, à changer à la connexion). */
export function AdminRecoveryClient() {
  const [data, setData] = useState<RecoveryData | null>(null);
  const [message, setMessage] = useState("Chargement…");
  const [busyId, setBusyId] = useState("");

  const [assistEmail, setAssistEmail] = useState("");
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [assistMessage, setAssistMessage] = useState("");
  const [assistBusy, setAssistBusy] = useState(false);
  const [identityChecked, setIdentityChecked] = useState(false);
  const [issued, setIssued] = useState<TemporaryPassword | null>(null);
  const [copied, setCopied] = useState(false);
  const [helpRequestId, setHelpRequestId] = useState("");
  const assistRef = useRef<HTMLElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => apiGet<RecoveryData>("/api/v1/identity/admin/recovery/"), []);
  const refresh = useCallback(async () => {
    try {
      setData(await load());
      setMessage("");
    } catch (error) {
      setMessage(error instanceof ApiError && error.status === 403 ? "Accès réservé aux administrateurs autorisés." : "Impossible de charger les récupérations de compte.");
    }
  }, [load]);
  useEffect(() => {
    let cancelled = false;
    void load().then((result) => {
      if (cancelled) return;
      setData(result);
      setMessage("");
    }).catch((error: unknown) => {
      if (cancelled) return;
      setMessage(error instanceof ApiError && error.status === 403 ? "Accès réservé aux administrateurs autorisés." : "Impossible de charger les récupérations de compte.");
    });
    return () => { cancelled = true; };
  }, [load]);

  async function setStatus(item: HelpRequest, status: HelpRequest["status"]) {
    setBusyId(item.id);
    try {
      await apiPatch(`/api/v1/identity/admin/contact-messages/${item.id}/`, { status });
      setData((current) => current ? { ...current, help_requests: current.help_requests.map((entry) => entry.id === item.id ? { ...entry, status } : entry), summary: { ...current.summary, help_open: current.help_requests.filter((entry) => (entry.id === item.id ? status : entry.status) !== "resolved").length } } : current);
    } catch {
      setMessage("Le statut n’a pas pu être enregistré.");
    } finally {
      setBusyId("");
    }
  }

  /* ---------- aide à une personne ---------- */
  async function findAccount(email: string) {
    setAssistBusy(true);
    setAssistMessage("");
    setIssued(null);
    setIdentityChecked(false);
    try {
      setAccount(await apiGet<AccountSummary>(`/api/v1/identity/admin/recovery/account/?email=${encodeURIComponent(email.trim())}`));
    } catch (error) {
      setAccount(null);
      setAssistMessage(errorText(error, "Recherche impossible pour le moment."));
    } finally {
      setAssistBusy(false);
    }
  }
  function search(event: FormEvent) {
    event.preventDefault();
    setHelpRequestId("");
    void findAccount(assistEmail);
  }
  /** Depuis une demande « Écrire à l'équipe » : une adresse e-mail lance la recherche ; un téléphone demande l'adresse du compte. */
  function helpPerson(item: HelpRequest) {
    setHelpRequestId(item.id);
    assistRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (item.contact_kind === "email") {
      setAssistEmail(item.contact_value);
      void findAccount(item.contact_value);
    } else {
      setAssistEmail("");
      setAccount(null);
      setIssued(null);
      setAssistMessage(`Contact par téléphone (${item.contact_value}) : demandez à ${item.name || "la personne"} l’adresse e-mail de son compte, puis saisissez-la ici.`);
      emailRef.current?.focus();
    }
  }
  async function unlock(id: number) {
    setAssistBusy(true);
    setAssistMessage("");
    try {
      const updated = await apiPost<AccountSummary>(`/api/v1/identity/admin/recovery/accounts/${id}/unlock/`);
      setAccount((current) => (current && current.id === id ? updated : current));
      setAssistMessage("Blocage levé : la personne peut retenter sa réponse secrète.");
      await refresh();
    } catch (error) {
      setAssistMessage(errorText(error, "Le blocage n’a pas pu être levé."));
    } finally {
      setAssistBusy(false);
    }
  }
  async function issuePassword() {
    if (!account || !identityChecked) return;
    setAssistBusy(true);
    setAssistMessage("");
    try {
      const result = await apiPost<TemporaryPassword>(`/api/v1/identity/admin/recovery/accounts/${account.id}/temporary-password/`, { identity_checked: true, ...(helpRequestId ? { help_request_id: helpRequestId } : {}) });
      setIssued(result);
      setAccount(result.account);
      setIdentityChecked(false);
      setCopied(false);
      await refresh();
    } catch (error) {
      setAssistMessage(errorText(error, "Le mot de passe temporaire n’a pas pu être créé."));
    } finally {
      setAssistBusy(false);
    }
  }
  async function copyPassword() {
    if (!issued) return;
    try { await navigator.clipboard.writeText(issued.temporary_password); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { setAssistMessage("Copie impossible : sélectionnez le mot de passe et copiez-le à la main."); }
  }

  if (!data) return <section className="card admin-recovery"><p className="status" role="status">{message}</p></section>;
  const { summary } = data;
  const cards: { label: string; value: number; tone: string }[] = [
    { label: "Réponses fausses (24 h)", value: summary.failed_24h, tone: summary.failed_24h ? "warn" : "" },
    { label: "Comptes bloqués maintenant", value: summary.locked_now, tone: summary.locked_now ? "danger" : "" },
    { label: "Tentatives bloquées (24 h)", value: summary.blocked_24h, tone: summary.blocked_24h ? "warn" : "" },
    { label: "Réponses acceptées (24 h)", value: summary.verified_24h, tone: "" },
    { label: "Mots de passe réinitialisés (24 h)", value: summary.resets_24h, tone: "" },
    { label: "Demandes d’aide à traiter", value: summary.help_open, tone: summary.help_open ? "warn" : "" },
  ];
  const locked = Boolean(account?.locked_until);

  return <div className="stack-lg admin-recovery">
    <section className="card">
      <div className="admin-recovery__head"><div><span className="eyebrow">Sécurité des comptes</span><h2>Récupérations de compte</h2><p className="muted">Chaque tentative sur un compte réel laisse une trace datée. Les réponses secrètes et les mots de passe ne sont jamais affichés : ils n’existent qu’en version chiffrée à sens unique. Les adresses sans compte ne sont pas journalisées.</p></div><button type="button" className="button" onClick={() => void refresh()}>Actualiser</button></div>
      <div className="admin-recovery__cards">{cards.map((card) => <div key={card.label} className={`admin-recovery__card${card.tone ? ` is-${card.tone}` : ""}`}><strong>{card.value}</strong><span>{card.label}</span></div>)}</div>
      {message && <p className="status" role="status">{message}</p>}
    </section>

    <section className="card admin-recovery__assist" ref={assistRef} aria-labelledby="recovery-assist">
      <span className="eyebrow">Aider une personne</span>
      <h3 id="recovery-assist">Retrouver son compte</h3>
      <p className="muted">Pas besoin de lire son secret. Retrouvez le compte, vérifiez que la personne connaît les repères ci-dessous, puis levez le blocage ou remettez-lui un mot de passe temporaire.</p>
      <form className="admin-recovery__search" onSubmit={search}>
        <label className="field"><span>Adresse e-mail du compte</span><input ref={emailRef} type="email" inputMode="email" autoComplete="off" required value={assistEmail} onChange={(event) => setAssistEmail(event.target.value)} placeholder="prenom@exemple.com" /></label>
        <button className="button primary" type="submit" disabled={assistBusy || !assistEmail.trim()}>{assistBusy && !account ? "Recherche…" : "Rechercher"}</button>
      </form>
      {assistMessage && <p className="status" role="status" aria-live="polite">{assistMessage}</p>}

      {account && <article className="admin-recovery__account" aria-label={`Compte de ${account.name || account.email}`}>
        <div className="admin-recovery__account-head"><div><strong>{account.name || "Sans nom"}</strong><p className="muted">{account.email}</p></div>{account.protected ? <span className="badge refused">Compte d’équipe</span> : locked ? <span className="badge refused">Bloqué</span> : <span className="badge verified">Compte actif</span>}</div>
        <dl className="admin-recovery__facts">
          <div><dt>Question secrète choisie</dt><dd>{account.has_recovery_question ? account.recovery_question : "Aucune enregistrée"}</dd></div>
          <div><dt>Inscrit le</dt><dd>{formatDate(account.joined_at)}</dd></div>
          <div><dt>Dernier accès</dt><dd>{account.last_login ? formatDate(account.last_login) : "Jamais connecté"}</dd></div>
          <div><dt>Espaces</dt><dd>{account.roles.length ? account.roles.map((role) => ROLE_LABELS[role] ?? role).join(", ") : "Aucun"}</dd></div>
          <div><dt>Réponses fausses</dt><dd>{account.failures}{account.locked_until ? ` · bloqué jusqu’au ${formatDate(account.locked_until)}` : ""}</dd></div>
          {account.temporary_password_pending && <div><dt>Mot de passe temporaire</dt><dd>En attente de changement{account.temporary_password_expires_at ? ` · expire le ${formatDate(account.temporary_password_expires_at)}` : ""}</dd></div>}
        </dl>
        {account.protected ? <p className="notice" role="note">Les comptes de l’équipe ne se récupèrent pas par cette voie.</p> : !account.active ? <p className="notice" role="note">Ce compte est désactivé : il n’y a rien à récupérer.</p> : <>
          <p className="muted admin-recovery__tip">Demandez-lui la question qu’il avait choisie (il doit s’en souvenir, même sans la réponse), son espace et à peu près quand il s’est inscrit ou s’est connecté. Si cela ne correspond pas, ne remettez rien.</p>
          <div className="actions">
            <button type="button" className="button" disabled={assistBusy || (account.failures === 0 && !locked)} onClick={() => void unlock(account.id)}>Lever le blocage</button>
          </div>
          <div className="admin-recovery__temp">
            <label className="admin-recovery__check"><input type="checkbox" checked={identityChecked} onChange={(event) => setIdentityChecked(event.target.checked)} disabled={assistBusy} /><span>J’ai vérifié l’identité de la personne avec les repères ci-dessus.</span></label>
            <button type="button" className="button primary" disabled={assistBusy || !identityChecked} onClick={() => void issuePassword()}>{assistBusy && identityChecked ? "Création…" : "Remettre un mot de passe temporaire"}</button>
          </div>
        </>}
      </article>}

      {issued && <div className="admin-recovery__issued" role="status" aria-live="polite">
        <strong>Mot de passe temporaire — affiché une seule fois</strong>
        <p className="admin-recovery__secret"><code>{issued.temporary_password}</code></p>
        <div className="actions"><button type="button" className="button small" onClick={() => void copyPassword()}>{copied ? "Copié" : "Copier"}</button><button type="button" className="button small" onClick={() => setIssued(null)}>Je l’ai transmis, fermer</button></div>
        <p className="muted">Valable jusqu’au {formatDate(issued.expires_at)}. Transmettez-le par appel ou message direct, jamais par e-mail. La personne devra le remplacer dès sa connexion ; ses autres appareils sont déconnectés et elle est prévenue par e-mail.</p>
      </div>}
    </section>

    <section className="card" aria-labelledby="recovery-locked">
      <h3 id="recovery-locked">Comptes bloqués maintenant</h3>
      {data.locked_accounts.length === 0 ? <p className="empty">Aucun compte bloqué.</p> : <div className="admin-recovery__list">{data.locked_accounts.map((item) => <article key={item.email} className="record"><div><strong>{item.name || item.email}</strong><p className="muted">{item.email}</p><p className="muted">{item.failures} réponses fausses · bloqué jusqu’au {formatDate(item.locked_until)}</p></div><div className="admin-recovery__row-actions"><span className="badge refused">Bloqué</span><button type="button" className="button small" disabled={assistBusy} onClick={() => { setAssistEmail(item.email); setHelpRequestId(""); assistRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); void findAccount(item.email); }}>Aider</button></div></article>)}</div>}
    </section>

    <section className="card" aria-labelledby="recovery-help">
      <h3 id="recovery-help">Demandes « Écrire à l’équipe »</h3>
      <p className="muted">Personnes qui ne se souviennent plus de leur réponse. Vérifiez leur identité avant tout accès.</p>
      {data.help_requests.length === 0 ? <p className="empty">Aucune demande.</p> : <div className="admin-recovery__list">{data.help_requests.map((item) => <article key={item.id} className="record admin-recovery__help">
        <div><strong>{item.name}</strong><p className="muted">{item.contact_kind === "email" ? "E-mail" : "Téléphone"} : {item.contact_value} · {formatDate(item.submitted_at)}</p><p>{item.message}</p></div>
        <div className="admin-recovery__row-actions">
          <label className="field"><span>Statut</span><select value={item.status} disabled={busyId === item.id} onChange={(event) => void setStatus(item, event.target.value as HelpRequest["status"])}>{STATUS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {item.status !== "resolved" && <button type="button" className="button small" disabled={assistBusy} onClick={() => helpPerson(item)}>Aider cette personne</button>}
        </div>
      </article>)}</div>}
    </section>

    <section className="card" aria-labelledby="recovery-journal">
      <h3 id="recovery-journal">Journal des récupérations</h3>
      {data.events.length === 0 ? <p className="empty">Aucune tentative enregistrée pour le moment.</p> : <div className="admin-recovery__list">{data.events.map((event) => <article key={event.id} className="record admin-recovery__event">
        <div><strong>{event.label}</strong><p className="muted">{event.name ? `${event.name} · ` : ""}{event.email || "Compte supprimé"}{event.failures ? ` · échec n° ${event.failures}` : ""}{event.by_team ? " · par l’équipe" : ""}</p></div>
        <div className="admin-recovery__when"><span className={`admin-recovery__dot is-${TONE[event.event_type] ?? "info"}`} aria-hidden="true" /><time dateTime={event.created_at}>{formatDate(event.created_at)}</time></div>
      </article>)}</div>}
    </section>
  </div>;
}
