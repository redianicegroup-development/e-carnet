"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiGet, apiPatch, apiPost } from "../../infrastructure/api/client";
import { AdminActivityCharts, type DailyActivityPoint } from "../../components/AdminActivityCharts";
import { AdminAccountActionRequestsClient } from "../../components/AdminAccountActionRequestsClient";
import { useConfirm } from "../../components/modal/ConfirmProvider";

type Visitor = {
  visitor_id: string; first_seen: string; last_seen: string; page_view_count: number;
  auth_page_view_count: number; login_success_count: number; login_failure_count: number;
  registration_count: number; oauth_success_count: number; oauth_link_count: number;
  last_page_category: string; last_auth_event: string; last_auth_event_at: string | null;
  click_count: number; last_click_category: string; last_click_page_category: string; last_click_at: string | null;
  public_page_view_count: number; survey_prompted_at: string | null; survey_completed_at: string | null;
};
type Feedback = {
  id: string; category: string; message: string; page_category: string;
  status: "new" | "in_progress" | "resolved"; submitted_at: string; updated_at: string;
};
type SurveyResponse = { id: string; rating: number; appreciated: string[]; pain_points: string[]; improvement_suggestion: string; submitted_at: string };
type VisitorSurveyResponse = { id: string; persona: string; found_what: string; barriers: string[]; missing: string; submitted_at: string };
type Dashboard = {
  generated_at: string; visitors_total: number; visitors_active_24h: number;
  page_views_total: number; clicks_total: number; auth_successes_total: number;
  login_failures_total: number; feedback_total: number; feedback_new_total: number;
  survey_prompted_total: number; survey_responses_total: number; survey_completion_rate: number;
  survey_average_rating: number | null; survey_distribution: Record<string, number>;
  visitor_survey_prompted_total: number; visitor_survey_responses_total: number; visitor_survey_completion_rate: number;
  visitor_survey_responses: VisitorSurveyResponse[];
  product_survey_prompted_total: number; product_survey_responses_total: number; product_survey_completion_rate: number;
  product_survey_average_rating: number | null; product_survey_distribution: Record<string, number>;
  product_survey_responses: SurveyResponse[];
  legacy_survey_responses_total: number; legacy_survey_responses: SurveyResponse[];
  daily_activity: DailyActivityPoint[];
  visitors: Visitor[]; feedback: Feedback[]; survey_responses: SurveyResponse[];
};
type AdminTab = "overview" | "activity" | "feedback" | "survey" | "establishments" | "account-requests";

const tabs: { id: AdminTab; label: string }[] = [
  { id: "overview", label: "Vue d’ensemble" },
  { id: "activity", label: "Visites & clics" },
  { id: "feedback", label: "Feedback" },
  { id: "survey", label: "Enquête UX" },
  { id: "establishments", label: "Établissements" },
  { id: "account-requests", label: "Demandes de compte" },
];
const categoryLabel: Record<string, string> = {
  landing: "Accueil", public: "Pages publiques", auth: "Connexion / inscription",
  patient: "Espace patient", professional: "Espace professionnel", establishment: "Espace établissement", other: "Autre",
};
const clickLabel: Record<string, string> = {
  signup: "Inscription", professional_signup: "Inscription professionnel", login: "Connexion",
  establishment_contact: "Contact établissement", faq: "FAQ", security: "Sécurité", about: "À propos",
  navigation: "Navigation interne", external: "Lien externe", feedback_open: "Ouverture feedback", action: "Action", other: "Autre",
};
const eventLabel: Record<string, string> = {
  auth_page: "Page de connexion consultée", login_success: "Connexion réussie", login_failure: "Échec de connexion",
  registration: "Inscription", oauth_success: "Connexion OAuth réussie", oauth_link: "Fournisseur lié",
};
const feedbackLabel: Record<string, string> = { bug: "Problème", idea: "Suggestion", question: "Question", other: "Autre" };
const feedbackStatusLabel: Record<Feedback["status"], string> = { new: "Nouveau", in_progress: "En cours", resolved: "Traité" };
const appreciatedLabel: Record<string, string> = { organized_carnet: "Carnet organisé", consultation_preparation: "Préparation consultations", access_control: "Contrôle des accès", history_traceability: "Historique", health_content: "Contenu du carnet" };
const painPointLabel: Record<string, string> = { navigation: "Navigation difficile", form_fields: "Champs à revoir", features: "Fonctionnalité difficile", clarity: "Libellés peu clairs", performance: "Lenteur / problème technique", none: "Aucun point bloquant" };
const personaLabel: Record<string, string> = { patient: "Patient ou proche", professional: "Professionnel de santé", establishment: "Établissement", discovery: "Curieux" };
const foundLabel: Record<string, string> = { yes: "Oui", partly: "En partie", no: "Non" };
const barrierLabel: Record<string, string> = { purpose: "Utilité à clarifier", health_privacy: "Inquiétude sur les données", pricing: "Prix à clarifier", steps: "Démarches trop longues", none: "Aucun frein", other: "Autre raison" };
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const formatDate = (value: string | null) => value ? dateFormat.format(new Date(value)) : "—";

function StarRating({ value, label }: { value: number; label: string }) {
  return <span className="admin-stars" role="img" aria-label={label}>{[1, 2, 3, 4, 5].map((star) => <span key={star} className={star <= Math.round(value) ? "is-filled" : ""} aria-hidden="true">★</span>)}</span>;
}

export default function AdminPage() {
  const confirm = useConfirm();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [message, setMessage] = useState("");
  const [refreshMessage, setRefreshMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [visitorSearch, setVisitorSearch] = useState("");
  const [feedbackSearch, setFeedbackSearch] = useState("");
  const [surveySearch, setSurveySearch] = useState("");
  const [busyFeedbackId, setBusyFeedbackId] = useState("");

  const loadDashboard = useCallback(async (silent = false, manual = false) => {
    if (!silent) setLoading(true);
    if (manual) setManualRefreshing(true);
    try {
      const data = await apiGet<Dashboard>("/api/v1/identity/admin/dashboard/");
      setDashboard(data);
      setMessage("");
      setRefreshMessage("");
    } catch (error) {
      if (silent && !(error instanceof ApiError && (error.status === 401 || error.status === 403))) {
        setRefreshMessage("Actualisation momentanément indisponible; les données affichées sont conservées.");
        return;
      }
      setDashboard(null);
      if (error instanceof ApiError && (error.status === 403 || error.status === 401)) setMessage("Connectez-vous avec le compte superadministrateur autorisé pour continuer.");
      else setMessage(error instanceof Error ? error.message : "Impossible de charger le tableau de bord.");
    } finally {
      if (!silent) setLoading(false);
      if (manual) setManualRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadDashboard(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadDashboard(true);
    }, 120_000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(timer); };
  }, [loadDashboard]);

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

  async function askSignOut() {
    const ok = await confirm({ title: "Fermer la session administrateur ?", message: "Vous devrez vous reconnecter pour revoir la console.", confirmLabel: "Me déconnecter", cancelLabel: "Rester connecté", tone: "neutral", mood: "decision" });
    if (ok) await signOut();
  }

  async function updateFeedback(feedbackId: string, status: Feedback["status"]) {
    setBusyFeedbackId(feedbackId);
    try {
      await apiPatch(`/api/v1/identity/admin/feedback/${feedbackId}/`, { status });
      setDashboard((current) => {
        if (!current) return current;
        const previous = current.feedback.find((item) => item.id === feedbackId)?.status;
        const feedback = current.feedback.map((item) => item.id === feedbackId ? { ...item, status } : item);
        const feedbackNewTotal = current.feedback_new_total + (previous === "new" && status !== "new" ? -1 : previous !== "new" && status === "new" ? 1 : 0);
        return { ...current, feedback, feedback_new_total: Math.max(0, feedbackNewTotal) };
      });
    } catch (error) {
      setRefreshMessage(error instanceof Error ? error.message : "Impossible de mettre à jour ce retour.");
    } finally { setBusyFeedbackId(""); }
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.id === activeTab);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setActiveTab(tabs[next].id);
    document.getElementById(`admin-tab-${tabs[next].id}`)?.focus();
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

  const filteredVisitors = dashboard.visitors.filter((visitor) => {
    const query = visitorSearch.trim().toLowerCase();
    if (!query) return true;
    return [visitor.visitor_id, visitor.last_page_category, visitor.last_click_category, visitor.last_auth_event]
      .some((value) => value.toLowerCase().includes(query));
  });
  const filteredFeedback = dashboard.feedback.filter((item) => {
    const query = feedbackSearch.trim().toLowerCase();
    return !query || [item.message, item.category, item.page_category, item.status].some((value) => value.toLowerCase().includes(query));
  });
  const filteredSurveyResponses = dashboard.survey_responses.filter((item) => {
    const query = surveySearch.trim().toLowerCase();
    if (!query) return true;
    return [item.improvement_suggestion, ...item.appreciated.map((value) => appreciatedLabel[value] ?? value), ...item.pain_points.map((value) => painPointLabel[value] ?? value), String(item.rating)]
      .some((value) => value.toLowerCase().includes(query));
  });
  const filteredVisitorSurveyResponses = dashboard.visitor_survey_responses.filter((item) => {
    const query = surveySearch.trim().toLowerCase();
    return !query || [personaLabel[item.persona] ?? item.persona, foundLabel[item.found_what] ?? item.found_what, item.missing, ...item.barriers.map((value) => barrierLabel[value] ?? value)].some((value) => value.toLowerCase().includes(query));
  });
  const filteredLegacySurveyResponses = dashboard.legacy_survey_responses.filter((item) => {
    const query = surveySearch.trim().toLowerCase();
    return !query || [item.improvement_suggestion, ...item.appreciated.map((value) => appreciatedLabel[value] ?? value), ...item.pain_points.map((value) => painPointLabel[value] ?? value), String(item.rating)].some((value) => value.toLowerCase().includes(query));
  });

  return <main className="shell admin-shell stack-lg">
    <header className="admin-heading"><div><span className="eyebrow">Console privée</span><h1>Administration E‑Carnet</h1><p className="muted">Données actualisées {formatDate(dashboard.generated_at)} · synchronisation automatique toutes les 2 min</p></div><div className="admin-actions"><button className="button secondary" onClick={() => void loadDashboard(true, true)} disabled={manualRefreshing}>{manualRefreshing ? "Actualisation…" : "Actualiser"}</button><button className="button ghost" onClick={() => void askSignOut()}>Déconnexion</button></div></header>
    {refreshMessage && <p className="admin-refresh-note" role="status">{refreshMessage}</p>}
    <div className="admin-tabs" role="tablist" aria-label="Sections de l’administration" onKeyDown={onTabKeyDown}>
      {tabs.map((tab) => <button key={tab.id} id={`admin-tab-${tab.id}`} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`admin-panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1} className="admin-tab" onClick={() => setActiveTab(tab.id)}>{tab.label}{tab.id === "feedback" && dashboard.feedback_new_total > 0 && <span className="admin-tab-badge">{dashboard.feedback_new_total}</span>}</button>)}
    </div>

    {activeTab === "overview" && <section id="admin-panel-overview" role="tabpanel" aria-labelledby="admin-tab-overview" className="stack-lg">
      <div className="admin-metrics" aria-label="Indicateurs clés">
        <article className="card admin-metric"><span className="muted">Visiteurs suivis</span><strong>{dashboard.visitors_total}</strong><small>cookies pseudonymes · rétention 90 jours</small></article>
        <article className="card admin-metric"><span className="muted">Actifs sur 24 h</span><strong>{dashboard.visitors_active_24h}</strong><small>visiteurs distincts estimés</small></article>
        <article className="card admin-metric"><span className="muted">Pages vues</span><strong>{dashboard.page_views_total}</strong><small>compteur agrégé global</small></article>
        <article className="card admin-metric"><span className="muted">Clics mesurés</span><strong>{dashboard.clicks_total}</strong><small>catégories, sans URL ni libellé</small></article>
        <article className="card admin-metric"><span className="muted">Connexions / inscriptions</span><strong>{dashboard.auth_successes_total}</strong><small>succès cumulés</small></article>
        <article className="card admin-metric"><span className="muted">Échecs de connexion</span><strong>{dashboard.login_failures_total}</strong><small>compteurs agrégés</small></article>
        <article className="card admin-metric"><span className="muted">Retours reçus</span><strong>{dashboard.feedback_total}</strong><small>{dashboard.feedback_new_total} nouveaux</small></article>
        <article className="card admin-metric"><span className="muted">Facilité moyenne après usage</span>{dashboard.product_survey_average_rating !== null ? <><StarRating value={dashboard.product_survey_average_rating} label={`Facilité moyenne ${dashboard.product_survey_average_rating.toFixed(1)} sur 5`} /><strong>{dashboard.product_survey_average_rating.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}<small className="admin-metric-inline">/5</small></strong></> : <strong>—</strong>}<small>{dashboard.product_survey_responses_total} réponse(s)</small></article>
      </div>
      <AdminActivityCharts data={dashboard.daily_activity} />
      <section className="card admin-table-card"><div className="admin-table-title"><div><span className="eyebrow">Résumé</span><h2>Activité récente</h2></div><div className="admin-inline-actions"><button className="button small" onClick={() => setActiveTab("activity")}>Voir les visites et clics</button><button className="button small" onClick={() => setActiveTab("survey")}>Voir l’enquête UX</button></div></div><p className="muted">Les détails par visiteur pseudonyme, la recherche et les dernières catégories de clic sont disponibles dans l’onglet Visites & clics.</p></section>
    </section>}

    {activeTab === "activity" && <section id="admin-panel-activity" role="tabpanel" aria-labelledby="admin-tab-activity" className="stack-lg">
      <div className="admin-metrics admin-metrics--compact"><article className="card admin-metric"><span className="muted">Pages vues</span><strong>{dashboard.page_views_total}</strong></article><article className="card admin-metric"><span className="muted">Clics anonymisés</span><strong>{dashboard.clicks_total}</strong></article><article className="card admin-metric"><span className="muted">Connexions réussies</span><strong>{dashboard.auth_successes_total}</strong></article><article className="card admin-metric"><span className="muted">Échecs login</span><strong>{dashboard.login_failures_total}</strong></article></div>
      <section className="card admin-table-card"><div className="admin-table-title"><div><span className="eyebrow">Mesure de fréquentation</span><h2>Visiteurs pseudonymes</h2></div><span className="muted">{filteredVisitors.length} résultat(s) · 200 visiteurs les plus récents chargés</span></div>
        <label className="field admin-search"><span>Rechercher par identifiant ou catégorie</span><input type="search" value={visitorSearch} onChange={(event) => setVisitorSearch(event.target.value)} placeholder="ID, accueil, inscription, clic…" /></label>
        {filteredVisitors.length === 0 ? <p className="empty">Aucun visiteur ne correspond à cette recherche.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Visiteur</th><th>Dernière page</th><th>Pages</th><th>Clics</th><th>Dernier clic</th><th>Connexions</th><th>Échecs</th><th>Dernière activité</th></tr></thead><tbody>{filteredVisitors.map((visitor) => <tr key={visitor.visitor_id}><td><code>{visitor.visitor_id.slice(0, 8)}…</code><small>Depuis {formatDate(visitor.first_seen)}</small></td><td>{categoryLabel[visitor.last_page_category] ?? "Autre"}</td><td>{visitor.page_view_count}</td><td>{visitor.click_count}</td><td>{clickLabel[visitor.last_click_category] ?? "—"}<small>{visitor.last_click_at ? `${categoryLabel[visitor.last_click_page_category] ?? "Autre"} · ${formatDate(visitor.last_click_at)}` : "Aucun clic mesuré"}</small></td><td>{visitor.login_success_count + visitor.registration_count + visitor.oauth_success_count}</td><td>{visitor.login_failure_count}</td><td>{formatDate(visitor.last_seen)}<small>{eventLabel[visitor.last_auth_event] ?? "—"}</small></td></tr>)}</tbody></table></div>}
        <p className="admin-privacy-note">Pour protéger la vie privée, le système ne conserve ni texte de bouton, ni URL complète, ni IP, ni user-agent, et ignore les clics dans les espaces de santé et les consoles privées.</p>
      </section>
    </section>}

    {activeTab === "feedback" && <section id="admin-panel-feedback" role="tabpanel" aria-labelledby="admin-tab-feedback" className="stack-lg">
      <div className="admin-metrics admin-metrics--compact"><article className="card admin-metric"><span className="muted">Retours reçus</span><strong>{dashboard.feedback_total}</strong></article><article className="card admin-metric"><span className="muted">À traiter</span><strong>{dashboard.feedback_new_total}</strong></article></div>
      <section className="card admin-table-card"><div className="admin-table-title"><div><span className="eyebrow">Retours du site</span><h2>Feedback des visiteurs</h2></div><span className="muted">{filteredFeedback.length} résultat(s) · maximum 200 chargés</span></div>
        <label className="field admin-search"><span>Rechercher dans les retours</span><input type="search" value={feedbackSearch} onChange={(event) => setFeedbackSearch(event.target.value)} placeholder="Mot, catégorie, statut…" /></label>
        {filteredFeedback.length === 0 ? <p className="empty">Aucun retour ne correspond à cette recherche.</p> : <div className="admin-feedback-list">{filteredFeedback.map((item) => <article className="admin-feedback-item" key={item.id}><div className="admin-feedback-head"><div><span className="badge">{feedbackLabel[item.category] ?? item.category}</span><span className={`badge admin-feedback-status admin-feedback-status--${item.status}`}>{feedbackStatusLabel[item.status]}</span></div><small>{categoryLabel[item.page_category] ?? "Autre"} · {formatDate(item.submitted_at)}</small></div><p className="admin-feedback-message">{item.message}</p><label className="field admin-feedback-select"><span>Statut</span><select value={item.status} disabled={busyFeedbackId === item.id} onChange={(event) => void updateFeedback(item.id, event.target.value as Feedback["status"])}><option value="new">Nouveau</option><option value="in_progress">En cours</option><option value="resolved">Traité</option></select></label></article>)}</div>}
        <p className="admin-privacy-note">Les retours sont anonymes; le formulaire ne demande pas d’adresse email. Il demande aux visiteurs de ne pas inclure de données de santé ou d’identifiants.</p>
      </section>
    </section>}

    {activeTab === "survey" && <section id="admin-panel-survey" role="tabpanel" aria-labelledby="admin-tab-survey" className="stack-lg">
      <div className="admin-metrics admin-metrics--compact">
        <article className="card admin-metric"><span className="muted">Enquête visiteurs proposée</span><strong>{dashboard.visitor_survey_prompted_total}</strong><small>après cinq pages publiques</small></article>
        <article className="card admin-metric"><span className="muted">Réponses visiteurs</span><strong>{dashboard.visitor_survey_responses_total}</strong><small>{dashboard.visitor_survey_completion_rate.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}% de réponse</small></article>
        <article className="card admin-metric"><span className="muted">Enquête produit proposée</span><strong>{dashboard.product_survey_prompted_total}</strong><small>après une première action réussie</small></article>
        <article className="card admin-metric"><span className="muted">Réponses utilisateurs</span><strong>{dashboard.product_survey_responses_total}</strong><small>{dashboard.product_survey_completion_rate.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}% de réponse</small></article>
        <article className="card admin-metric"><span className="muted">Facilité moyenne</span>{dashboard.product_survey_average_rating !== null ? <><StarRating value={dashboard.product_survey_average_rating} label={`Facilité moyenne ${dashboard.product_survey_average_rating.toFixed(1)} sur 5`} /><strong>{dashboard.product_survey_average_rating.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}/5</strong></> : <strong>—</strong>}<small>après une tâche dans le carnet</small></article>
      </div>
      <section className="card admin-table-card"><div className="admin-table-title"><div><span className="eyebrow">Enquête de découverte</span><h2>Visiteurs du site</h2></div><span className="muted">{filteredVisitorSurveyResponses.length} réponse(s)</span></div>
        <label className="field admin-search"><span>Rechercher dans les réponses</span><input type="search" value={surveySearch} onChange={(event) => setSurveySearch(event.target.value)} placeholder="Profil, frein, suggestion…" /></label>
        {filteredVisitorSurveyResponses.length === 0 ? <p className="empty">Aucune réponse ne correspond à cette recherche.</p> : <div className="admin-feedback-list">{filteredVisitorSurveyResponses.map((item) => <article className="admin-feedback-item" key={item.id}><div className="admin-feedback-head"><div><span className="badge">{personaLabel[item.persona] ?? item.persona}</span><span className="badge">A trouvé : {foundLabel[item.found_what] ?? item.found_what}</span></div><small>{formatDate(item.submitted_at)}</small></div><div><strong>Freins à la création d’un compte</strong><div className="admin-survey-tags">{item.barriers.length ? item.barriers.map((value) => <span className="badge" key={value}>{barrierLabel[value] ?? value}</span>) : <span className="muted">Aucun choix</span>}</div></div>{item.missing && <div><strong>Ce qui manque sur le site</strong><p className="admin-feedback-message">{item.missing}</p></div>}</article>)}</div>}
        <p className="admin-privacy-note">Réponses anonymes, sans email ni identifiant visiteur.</p>
      </section>
      <section className="card admin-survey-summary"><div><span className="eyebrow">Facilité d’usage</span><h2>Après la première action</h2><p className="muted">La note est publiée sur l’accueil uniquement à partir de 30 réponses.</p></div><div className="admin-survey-distribution">{[5, 4, 3, 2, 1].map((score) => { const count = dashboard.product_survey_distribution[String(score)] ?? 0; const percent = dashboard.product_survey_responses_total ? count * 100 / dashboard.product_survey_responses_total : 0; return <div className="admin-survey-distribution-row" key={score}><span>{score} / 5</span><div className="admin-survey-bar" aria-label={`${percent.toFixed(0)} %`}><span style={{ width: `${percent}%` }} /></div><strong>{count}</strong></div>; })}</div><p className="admin-privacy-note">1 = très difficile · 5 = très facile</p></section>
      <section className="card admin-table-card"><div className="admin-table-title"><div><span className="eyebrow">Enquête produit</span><h2>Retour des utilisateurs connectés</h2></div><span className="muted">{filteredSurveyResponses.length} réponse(s) · maximum 200 chargées</span></div>
        {filteredSurveyResponses.length === 0 ? <p className="empty">Aucune réponse ne correspond à cette recherche.</p> : <div className="admin-feedback-list">{filteredSurveyResponses.map((item) => <article className="admin-feedback-item" key={item.id}><div className="admin-feedback-head"><div className="admin-survey-response-rating"><StarRating value={item.rating} label={`Facilité ${item.rating} sur 5`} /><strong>{item.rating}/5</strong></div><small>{formatDate(item.submitted_at)}</small></div><div><strong>Apprécié</strong><div className="admin-survey-tags">{item.appreciated.length ? item.appreciated.map((value) => <span className="badge" key={value}>{appreciatedLabel[value] ?? value}</span>) : <span className="muted">Aucun choix indiqué</span>}</div></div><div><strong>Freins rencontrés</strong><div className="admin-survey-tags">{item.pain_points.length ? item.pain_points.map((value) => <span className="badge" key={value}>{painPointLabel[value] ?? value}</span>) : <span className="muted">Aucun point signalé</span>}</div></div>{item.improvement_suggestion && <div><strong>Amélioration proposée</strong><p className="admin-feedback-message">{item.improvement_suggestion}</p></div>}</article>)}</div>}
        <p className="admin-privacy-note">Réponses sans email ni identifiant de compte. La moyenne publique reste masquée sous 30 réponses.</p>
      </section>
      {dashboard.legacy_survey_responses_total > 0 && <details className="card admin-table-card admin-survey-archive"><summary><strong>Ancienne enquête archivée</strong> <span className="muted">({dashboard.legacy_survey_responses_total} réponse(s))</span></summary><div className="admin-feedback-list">{filteredLegacySurveyResponses.map((item) => <article className="admin-feedback-item" key={item.id}><div className="admin-feedback-head"><StarRating value={item.rating} label={`Note historique ${item.rating} sur 5`} /><small>{formatDate(item.submitted_at)}</small></div>{item.improvement_suggestion && <p className="admin-feedback-message">{item.improvement_suggestion}</p>}</article>)}</div></details>}
    </section>}

    {activeTab === "establishments" && <section id="admin-panel-establishments" role="tabpanel" aria-labelledby="admin-tab-establishments" className="grid admin-management-grid">
      <article className="card"><span className="eyebrow">Création après validation</span><h2>Créer un établissement et inviter son responsable</h2><p className="muted">L’établissement transmet ses justificatifs par le canal officiel. Après vérification manuelle hors application, créez l’entité et envoyez une invitation nominative au responsable principal.</p><ul className="admin-checklist"><li>Invitation à usage unique, valable 48 heures.</li><li>Le responsable définit son propre mot de passe; aucun secret temporaire n’est envoyé.</li><li>Aucun dépôt public de justificatifs et aucune création libre par un établissement.</li></ul><Link className="button primary" href="/staff/etablissements">Ouvrir le formulaire de création</Link></article>
      <article className="card"><span className="eyebrow">Limites du rôle</span><h2>Contrôle administratif, pas clinique</h2><p className="muted">Le staff E‑Carnet ne vérifie pas les justificatifs personnels du médecin dans ce parcours. L’établissement vérifie ses médecins, émet un code temporaire et décide des demandes de rattachement. L’espace établissement n’accède jamais aux dossiers médicaux.</p></article>
    </section>}
    {activeTab === "account-requests" && <section id="admin-panel-account-requests" role="tabpanel" aria-labelledby="admin-tab-account-requests"><AdminAccountActionRequestsClient /></section>}
  </main>;
}
