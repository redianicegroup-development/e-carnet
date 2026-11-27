"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiGet, apiPost } from "../infrastructure/api/client";
import { AdminAccountJournalClient } from "./AdminAccountJournalClient";
import { AdminLoginJournal } from "./AdminLoginJournal";
import { AdminRepresentationTransfersClient } from "./AdminRepresentationTransfersClient";
import { useConfirm } from "./modal/ConfirmProvider";
import { Profile, ProfileGrid, type ProfileStatus } from "./ui/Profile";
import "./admin-console.css";

type UserState = "active" | "suspended" | "disabled";
type Role = { code: string; label: string; detail: string };
export type AdminUser = {
  id: number; name: string; first_name: string; email: string; photo: string; roles: Role[]; state: UserState;
  date_joined: string; last_login: string | null; protected: boolean;
};
type Summary = { total: number; active: number; inactive: number; disabled: number; window_days: number };
type UsersPayload = { summary: Summary; total: number; offset: number; limit: number; has_more: boolean; items: AdminUser[] };

const API = "/api/v1/identity/admin/users/";
const PAGE = 30;
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const when = (value: string | null) => (value ? dateFormat.format(new Date(value)) : "Jamais");
const STATE_STATUS: Record<UserState, ProfileStatus> = {
  active: { label: "Actif", tone: "ok" },
  suspended: { label: "Suspendu par la personne", tone: "warn" },
  disabled: { label: "Désactivé", tone: "off" },
};
const ROLE_FILTERS = [
  ["", "Tous les rôles"], ["patient", "Patients"], ["professional", "Professionnels"], ["establishment", "Administrateurs d’établissement"], ["laboratory", "Laboratoires"], ["staff", "Équipe"],
] as const;
const STATUS_FILTERS = [["", "Tous les états"], ["active", "Actifs (30 jours)"], ["inactive", "Inactifs"], ["disabled", "Fermés"]] as const;

/* Console → Utilisateurs. Des identités de compte, JAMAIS de contenu médical. Chaque personne est un « profil » : un toucher ouvre sa fiche, les
   actions (désactiver, réactiver, fermer ses sessions) sont en bas de la fiche. Les comptes de l'équipe sont protégés. */
export function AdminUsersClient() {
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<AdminUser[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(async (offset: number) => {
    const id = ++requestId.current;
    const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
    if (search) params.set("q", search);
    if (role) params.set("role", role);
    if (status) params.set("status", status);
    try {
      const data = await apiGet<UsersPayload>(`${API}?${params.toString()}`);
      if (id !== requestId.current) return; // une réponse plus récente est déjà arrivée
      setItems((current) => (offset === 0 ? data.items : [...current, ...data.items]));
      setSummary(data.summary);
      setTotal(data.total);
      setHasMore(data.has_more);
      setMessage("");
    } catch (error) {
      if (id === requestId.current) setMessage(error instanceof Error ? error.message : "Impossible de charger les utilisateurs.");
    } finally {
      if (id === requestId.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [search, role, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => { setLoading(true); void load(0); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const replace = (user: AdminUser) => setItems((current) => current.map((item) => (item.id === user.id ? user : item)));

  async function changeStatus(user: AdminUser, action: "deactivate" | "reactivate"): Promise<string> {
    const accepted = await confirm(action === "deactivate"
      ? { title: "Désactiver ce compte ?", message: `${user.name} sera déconnecté de tous ses appareils et ne pourra plus se connecter tant que vous ne l’aurez pas réactivé.`, note: "Aucune donnée n’est supprimée. La désactivation est inscrite au journal d’audit.", confirmLabel: "Désactiver le compte", cancelLabel: "Annuler", tone: "danger" }
      : { title: "Réactiver ce compte ?", message: `${user.name} pourra de nouveau se connecter avec son mot de passe.`, confirmLabel: "Réactiver le compte", cancelLabel: "Annuler" });
    if (!accepted) return "";
    try {
      const updated = await apiPost<AdminUser>(`${API}${user.id}/status/`, { action });
      replace(updated);
      void load(0);
      return action === "deactivate" ? "Compte désactivé. Toutes ses sessions sont fermées." : "Compte réactivé.";
    } catch (error) {
      return error instanceof ApiError || error instanceof Error ? error.message : "Action impossible pour le moment.";
    }
  }

  async function closeSessions(user: AdminUser): Promise<string> {
    const accepted = await confirm({ title: "Fermer ses sessions ?", message: `${user.name} sera déconnecté de tous ses appareils. Son compte reste ouvert : il se reconnecte avec son mot de passe.`, confirmLabel: "Fermer les sessions", cancelLabel: "Annuler" });
    if (!accepted) return "";
    try {
      const result = await apiPost<{ closed: number }>(`${API}${user.id}/sessions/revoke/`, {});
      return result.closed > 0 ? `${result.closed} session(s) fermée(s).` : "Aucune session ouverte.";
    } catch (error) {
      return error instanceof ApiError || error instanceof Error ? error.message : "Action impossible pour le moment.";
    }
  }

  const chips: Array<[string, string, number | undefined]> = [["", "Comptes", summary?.total], ["active", `Actifs (${summary?.window_days ?? 30} j)`, summary?.active], ["inactive", "Inactifs", summary?.inactive], ["disabled", "Fermés", summary?.disabled]];

  return <section className="stack-lg" aria-label="Utilisateurs">
    <section className="card admin-users">
      <div className="admin-table-title"><div><span className="eyebrow">Comptes</span><h2>Utilisateurs</h2></div><span className="muted">{loading ? "Chargement…" : `${total} résultat(s)`}</span></div>
      <div className="admin-chips" role="group" aria-label="Filtrer par état">
        {chips.map(([value, label, count]) => <button key={label} type="button" className="admin-chip" data-active={status === value ? "true" : undefined} aria-pressed={status === value} onClick={() => setStatus(value)}><strong>{count ?? "—"}</strong><span>{label}</span></button>)}
      </div>
      <div className="admin-filters">
        <label className="field"><span>Rechercher</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom ou e-mail" autoComplete="off" maxLength={80} /></label>
        <label className="field"><span>Rôle</span><select value={role} onChange={(event) => setRole(event.target.value)}>{ROLE_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="field"><span>État</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{STATUS_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      {message && <p className="notice" role="alert">{message}</p>}
      {!loading && items.length === 0 && !message && <p className="empty">Aucun compte ne correspond à ces filtres.</p>}
      {items.length > 0 && <ProfileGrid label="Utilisateurs">
        {items.map((user) => <Profile
          key={user.id} name={user.name} label={user.first_name || user.name} subtitle={user.email || "Sans e-mail"} photo={user.photo || null}
          status={STATE_STATUS[user.state]}
          rows={[
            { label: "Rôle", value: user.roles.length ? <ul className="admin-role-list">{user.roles.map((item) => <li key={`${item.code}-${item.detail}`}><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}</li>)}</ul> : "Aucun rôle (compte sans espace)" },
            { label: "État", value: STATE_STATUS[user.state].label },
            { label: "E-mail", value: user.email || "—" },
            { label: "Inscrit le", value: when(user.date_joined) },
            { label: "Dernière connexion", value: when(user.last_login) },
          ]}
          note={user.protected ? "Compte de l’équipe : protégé. Il ne se gère pas depuis cette liste." : "L’équipe voit l’identité du compte, jamais son contenu médical."}
          actions={user.protected ? [] : [
            user.state === "active"
              ? { label: "Désactiver le compte", tone: "danger", onClick: () => changeStatus(user, "deactivate") }
              : { label: "Réactiver le compte", tone: "primary", onClick: () => changeStatus(user, "reactivate") },
            { label: "Fermer ses sessions", onClick: () => closeSessions(user), disabled: user.state !== "active" },
          ]}
        />)}
      </ProfileGrid>}
      {hasMore && <div className="admin-more"><button className="button" type="button" disabled={loadingMore} onClick={() => { setLoadingMore(true); void load(items.length); }}>{loadingMore ? "Chargement…" : "Voir plus de comptes"}</button></div>}
    </section>

    <details className="card admin-fold"><summary><span className="eyebrow">Sécurité</span><strong>Journal des connexions</strong></summary><AdminLoginJournal /></details>
    <details className="card admin-fold"><summary><span className="eyebrow">Comptes</span><strong>Suspensions et suppressions</strong></summary><AdminAccountJournalClient /></details>
    <details className="card admin-fold"><summary><span className="eyebrow">Enfants</span><strong>Transferts de dossiers</strong></summary><AdminRepresentationTransfersClient /></details>
  </section>;
}
