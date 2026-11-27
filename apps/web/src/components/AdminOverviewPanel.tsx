"use client";

import { useCallback, useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiGet } from "../infrastructure/api/client";
import { fcfa } from "./EstablishmentBilling";
import { tooltipStyle, tooltipText } from "./RoleDashboards";
import "./admin-console.css";

type Day = { date: string; count: number };
type Alert = { id: string; level: "critical" | "warning" | "info"; title: string; detail: string; tab: string };
export type Overview = {
  generated_at: string;
  users: { total: number; active_30d: number; inactive: number; disabled: number; new_7d: number; patients: number; professionals: number; establishment_admins: number; laboratory_admins: number; staff: number };
  establishments: { total: number; active: number; suspended: number; laboratories: number };
  billing: { subscriptions_active: number; overdue_invoices: number; transactions_total: number; transactions_30d: number; revenue_total_fcfa: number; revenue_30d_fcfa: number };
  alerts: Alert[];
  recent_activity: { event_type: string; actor_role: string; created_at: string }[];
  registrations_daily: Day[];
  logins_daily: Day[];
  failed_logins_24h: number;
};

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const shortDay = (value: string) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
const longDay = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date(`${value}T12:00:00`));
const ALERT_TONE = { critical: "off", warning: "warn", info: "ok" } as const;
const ALERT_LABEL = { critical: "Important", warning: "À traiter", info: "À savoir" } as const;

/* Libellés des événements d'audit les plus fréquents. Un type inconnu s'affiche tel quel (code), jamais masqué. */
const EVENTS: Record<string, string> = {
  "care.consultation.signed": "Consultation signée", "consultation.signed": "Consultation signée", "consultation.validated": "Consultation validée",
  "access_grant.requested": "Accès demandé par un professionnel", "access_grant.accept": "Accès accordé par un patient", "access_grant.ended": "Accès terminé", "access_grant.expired": "Accès expiré",
  "billing.payment_confirmed": "Paiement confirmé", "billing.invoice_void": "Facture annulée", "billing.subscription_changed": "Abonnement modifié",
  "admin.account.deactivated": "Compte désactivé par l’équipe", "admin.account.reactivated": "Compte réactivé par l’équipe", "admin.account.sessions_revoked": "Sessions d’un compte fermées",
  "establishment.approved": "Établissement validé", "establishment.suspended": "Établissement suspendu", "establishment.reactivated": "Établissement réactivé",
  "establishment.administrator.provisioned": "Administrateur d’établissement créé", "establishment.administrator.replaced": "Responsable remplacé",
  "advertising.banner_published": "Bannière publiée", "advertising.banner_withdrawn": "Bannière retirée", "account.password_changed": "Mot de passe modifié",
  "operations.portal.login": "Connexion au portail de surveillance", "operations.portal.login_failed": "Échec de connexion au portail de surveillance",
  "operations.incident.acknowledged": "Incident technique reconnu", "operations.incident.resolved": "Incident technique résolu",
};

function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <article className="card admin-metric"><span className="muted">{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</article>;
}

function Trend({ title, description, color, data, label }: { title: string; description: string; color: string; data: Day[]; label: string }) {
  const total = data.reduce((sum, day) => sum + day.count, 0);
  return <article className="card admin-chart-card">
    <header className="admin-chart-heading"><div><span className="eyebrow">Évolution · 30 jours</span><h2>{title}</h2></div><strong>{total}</strong></header>
    <p className="muted admin-chart-description">{description}</p>
    <div className="admin-chart-plot" role="img" aria-label={`${title} : ${total} sur 30 jours`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 16, left: -12, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fill: "var(--chart-text)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} width={36} tick={{ fill: "var(--chart-text)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip labelFormatter={(value) => longDay(String(value))} formatter={(value) => [Number(value ?? 0), label]} contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} />
          <Line type="monotone" dataKey="count" name={label} stroke={color} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </article>;
}

/* Console → Accueil : les chiffres de la PLATEFORME (comptes, établissements, abonnements, revenus), les alertes à traiter, l'évolution sur 30 jours et la
   dernière activité. Aucun contenu médical : des comptages, des montants d'abonnement et le TYPE des derniers événements d'audit. */
export function AdminOverviewPanel({ onOpenTab }: { onOpenTab: (tab: string) => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await apiGet<Overview>("/api/v1/identity/admin/overview/"));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de charger les indicateurs.");
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 120_000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [load]);

  if (!data) return <section className="card" aria-label="Indicateurs de la plateforme">{message ? <p className="notice" role="alert">{message}</p> : <p className="muted" role="status">Calcul des indicateurs…</p>}</section>;
  const { users, establishments, billing } = data;
  return <section className="stack-lg" aria-label="Indicateurs de la plateforme">
    {message && <p className="notice" role="status">{message}</p>}
    {data.alerts.length > 0 && <section className="card admin-alerts" aria-label="Alertes importantes">
      <div className="admin-table-title"><div><span className="eyebrow">Alertes</span><h2>À traiter</h2></div><span className="muted">{data.alerts.length}</span></div>
      <ul className="admin-loglist">
        {data.alerts.map((alert) => <li key={alert.id}>
          <div><strong>{alert.title}</strong><small>{alert.detail}</small></div>
          <span className="admin-alerts__side"><span className="badge" data-tone={ALERT_TONE[alert.level]}>{ALERT_LABEL[alert.level]}</span><button className="button small" type="button" onClick={() => onOpenTab(alert.tab)}>Voir</button></span>
        </li>)}
      </ul>
    </section>}

    <div className="admin-metrics" aria-label="Indicateurs clés">
      <Metric label="Utilisateurs" value={users.total} detail={`${users.patients} patients · ${users.professionals} professionnels · +${users.new_7d} cette semaine`} />
      <Metric label="Actifs (30 jours)" value={users.active_30d} detail={`${users.inactive} inactifs · ${users.disabled} fermés`} />
      <Metric label="Établissements" value={establishments.total} detail={`${establishments.active} actifs · ${establishments.suspended} suspendus · ${establishments.laboratories} laboratoire(s)`} />
      <Metric label="Abonnements actifs" value={billing.subscriptions_active} detail={billing.overdue_invoices ? `${billing.overdue_invoices} facture(s) en retard` : "Aucune facture en retard"} />
      <Metric label="Transactions" value={billing.transactions_total} detail={`${billing.transactions_30d} sur 30 jours`} />
      <Metric label="Revenus générés" value={fcfa(billing.revenue_total_fcfa)} detail={`${fcfa(billing.revenue_30d_fcfa)} sur 30 jours`} />
    </div>

    <div className="admin-charts-grid">
      <Trend title="Nouveaux comptes" description="Comptes créés chaque jour." color="var(--chart-1)" data={data.registrations_daily} label="Nouveaux comptes" />
      <Trend title="Connexions réussies" description="Connexions réussies chaque jour." color="var(--chart-2)" data={data.logins_daily} label="Connexions réussies" />
    </div>

    <section className="card admin-table-card">
      <div className="admin-table-title"><div><span className="eyebrow">Journal</span><h2>Activités récentes</h2></div><button className="button small" type="button" onClick={() => onOpenTab("audit")}>Journal d’audit complet</button></div>
      {data.recent_activity.length === 0 ? <p className="empty">Aucune activité enregistrée.</p> : <ul className="admin-loglist">
        {data.recent_activity.map((event, index) => <li key={`${event.created_at}-${index}`}><div><strong>{EVENTS[event.event_type] ?? <code>{event.event_type}</code>}</strong><small>{event.actor_role || "système"} · {dateTime.format(new Date(event.created_at))}</small></div></li>)}
      </ul>}
      <p className="muted admin-privacy-note">Seul le type de l’événement est affiché, jamais son contenu.</p>
    </section>
  </section>;
}
