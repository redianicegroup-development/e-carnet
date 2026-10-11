"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError, apiGet, apiPost } from "../../infrastructure/api/client";

type Visitor = {
  visitor_id: string; first_seen: string; last_seen: string; page_view_count: number;
  auth_page_view_count: number; login_success_count: number; login_failure_count: number;
  registration_count: number; oauth_success_count: number; oauth_link_count: number;
  last_page_category: string; last_auth_event: string; last_auth_event_at: string | null;
};
type Dashboard = {
  generated_at: string; visitors_total: number; visitors_active_24h: number;
  page_views_total: number; auth_successes_total: number; login_failures_total: number;
  visitors: Visitor[];
};

const categoryLabel: Record<string, string> = {
  landing: "Accueil", public: "Pages publiques", auth: "Connexion / inscription",
  patient: "Espace patient", professional: "Espace professionnel",
  establishment: "Espace établissement", other: "Autre",
};
const eventLabel: Record<string, string> = {
  auth_page: "Page de connexion consultée", login_success: "Connexion réussie",
  login_failure: "Échec de connexion", registration: "Inscription",
  oauth_success: "Connexion OAuth réussie", oauth_link: "Fournisseur lié",
};
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const formatDate = (value: string | null) => value ? dateFormat.format(new Date(value)) : "—";

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Dashboard>("/api/v1/identity/admin/dashboard/");
      setDashboard(data); setMessage("");
    } catch (error) {
      setDashboard(null);
      if (error instanceof ApiError && (error.status === 403 || error.status === 401)) setMessage("Connectez-vous avec le compte superadministrateur autorisé pour continuer.");
      else setMessage(error instanceof Error ? error.message : "Impossible de charger le tableau de bord.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setMessage("");
    try {
      await apiPost("/api/v1/identity/login/", { email, password });
      setPassword(""); await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connexion impossible.");
    } finally { setSubmitting(false); }
  }

  async function signOut() {
    try { await apiPost("/api/v1/identity/logout/"); } catch { /* la session peut déjà être expirée */ }
    setDashboard(null); setMessage("Session administrateur fermée.");
  }

  if (loading && !dashboard) return <main className="shell admin-shell"><section className="card"><p className="muted">Vérification de la session…</p></section></main>;

  if (!dashboard) return <main className="shell admin-shell"><section className="admin-login card">
    <span className="eyebrow">E‑Carnet · Administration</span><h1>Console d’administration</h1>
    <p className="muted">Accès réservé aux superadministrateurs autorisés.</p>
    <form className="stack" onSubmit={signIn}>
      <label className="field"><span>Email administrateur</span><input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label className="field"><span>Mot de passe</span><input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {message && <p className="notice" role="alert">{message}</p>}
      <button className="button primary" type="submit" disabled={submitting}>{submitting ? "Connexion…" : "Se connecter"}</button>
    </form>
  </section></main>;

  return <main className="shell admin-shell stack-lg">
    <header className="admin-heading"><div><span className="eyebrow">Console privée</span><h1>Vue d’ensemble</h1><p className="muted">Statistiques de fréquentation anonymisées · actualisées {formatDate(dashboard.generated_at)}</p></div><div className="admin-actions"><button className="button secondary" onClick={() => void loadDashboard()} disabled={loading}>{loading ? "Actualisation…" : "Actualiser"}</button><button className="button ghost" onClick={() => void signOut()}>Déconnexion</button></div></header>
    <section className="admin-metrics" aria-label="Indicateurs">
      <article className="card admin-metric"><span className="muted">Visiteurs suivis</span><strong>{dashboard.visitors_total}</strong><small>cookie pseudonyme · rétention 90 jours</small></article>
      <article className="card admin-metric"><span className="muted">Actifs sur 24 h</span><strong>{dashboard.visitors_active_24h}</strong><small>visiteurs distincts estimés</small></article>
      <article className="card admin-metric"><span className="muted">Pages consultées</span><strong>{dashboard.page_views_total}</strong><small>total des visiteurs affichés</small></article>
      <article className="card admin-metric"><span className="muted">Connexions / inscriptions</span><strong>{dashboard.auth_successes_total}</strong><small>succès cumulés affichés</small></article>
      <article className="card admin-metric"><span className="muted">Échecs de connexion</span><strong>{dashboard.login_failures_total}</strong><small>compteurs agrégés</small></article>
    </section>
    <section className="card admin-table-card"><div className="admin-table-title"><div><span className="eyebrow">Activité récente</span><h2>Visiteurs pseudonymes</h2></div><span className="muted">Jusqu’à 100 entrées récentes</span></div>
      {dashboard.visitors.length === 0 ? <p className="empty">Aucun visiteur enregistré pour le moment.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Visiteur</th><th>Dernière page</th><th>Pages</th><th>Connexions</th><th>Échecs</th><th>Dernier événement</th><th>Vu pour la dernière fois</th></tr></thead><tbody>{dashboard.visitors.map((visitor) => <tr key={visitor.visitor_id}><td><code>{visitor.visitor_id.slice(0, 8)}…</code><small>Depuis {formatDate(visitor.first_seen)}</small></td><td>{categoryLabel[visitor.last_page_category] ?? "Autre"}</td><td>{visitor.page_view_count}</td><td>{visitor.login_success_count + visitor.registration_count + visitor.oauth_success_count}</td><td>{visitor.login_failure_count}</td><td>{eventLabel[visitor.last_auth_event] ?? "—"}<small>{formatDate(visitor.last_auth_event_at)}</small></td><td>{formatDate(visitor.last_seen)}</td></tr>)}</tbody></table></div>}
      <p className="admin-privacy-note">Les statistiques sont agrégées. Aucun email, mot de passe, adresse IP, user-agent ou URL complète n’est affiché dans ce tableau.</p>
    </section>
  </main>;
}
