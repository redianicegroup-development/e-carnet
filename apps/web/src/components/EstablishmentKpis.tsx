"use client";

import Link from "next/link";
import { useId, useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Icon, type IconName } from "./ui/Icon";
import { CHART_COLORS, EmptyChart, chartGrid, chartText, tooltipStyle, tooltipText } from "./RoleDashboards";

/* Tableau de bord de l'établissement : KPI et courbes calculés uniquement sur les rattachements (statut, spécialité déclarée, dates de demande et de réponse).
   Vue administrative : aucun dossier patient, aucune donnée médicale. Rien n'est inventé : sans donnée, la carte l'indique. */
export type KpiMembership = { status: string; professional_specialty?: string; requested_at?: string | null; reviewed_at?: string | null };

const DAY = 86_400_000;
const MONTHS = 6;
const STATUS_LABELS: Record<string, string> = { active: "Actifs", pending: "En attente", refused: "Refusés", suspended: "Suspendus" };

function timestamp(value?: string | null) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : null;
}

function formatDelay(ms: number | null) {
  if (ms === null) return "—";
  const hours = ms / 3_600_000;
  if (hours < 1) return "< 1 h";
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${(hours / 24).toFixed(1).replace(".", ",")} j`;
}

function Kpi({ href, icon, tone, label, value, hint }: { href?: string; icon: IconName; tone: string; label: string; value: string; hint?: string }) {
  const body = (
    <>
      <span className="kpi__top">
        <span className={`orb orb--sm ${tone}`.trim()} aria-hidden="true"><Icon name={icon} /></span>
        {hint ? <span className="kpi__delta">{hint}</span> : null}
      </span>
      <span className="kpi__label">{label}</span>
      <span className="kpi__value">{value}</span>
    </>
  );
  return href ? <Link className="kpi card-link" href={href}>{body}</Link> : <div className="kpi">{body}</div>;
}

export function EstablishmentKpis({ memberships }: { memberships: KpiMembership[] }) {
  const gradientId = useId().replace(/:/g, "");
  const stats = useMemo(() => {
    const now = Date.now();
    const active = memberships.filter((item) => item.status === "active");
    const pending = memberships.filter((item) => item.status === "pending");
    const answered = memberships.filter((item) => item.status !== "pending").map((item) => {
      const from = timestamp(item.requested_at);
      const to = timestamp(item.reviewed_at);
      return from !== null && to !== null && to >= from ? to - from : null;
    }).filter((value): value is number => value !== null);
    const averageDelay = answered.length ? answered.reduce((sum, value) => sum + value, 0) / answered.length : null;
    const recentRequests = memberships.filter((item) => { const time = timestamp(item.requested_at); return time !== null && now - time <= 30 * DAY; }).length;
    const recentActivations = active.filter((item) => { const time = timestamp(item.reviewed_at); return time !== null && now - time <= 30 * DAY; }).length;

    // Courbe : demandes reçues et rattachements confirmés, par mois civil sur les six derniers mois.
    const start = new Date(new Date(now).getFullYear(), new Date(now).getMonth() - (MONTHS - 1), 1);
    const months = Array.from({ length: MONTHS }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
      return { key: `${date.getFullYear()}-${date.getMonth()}`, label: date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""), demandes: 0, confirmes: 0 };
    });
    const index = new Map(months.map((month) => [month.key, month]));
    const bucket = (value?: string | null) => { const time = timestamp(value); if (time === null) return undefined; const date = new Date(time); return index.get(`${date.getFullYear()}-${date.getMonth()}`); };
    for (const item of memberships) {
      const requested = bucket(item.requested_at);
      if (requested) requested.demandes += 1;
      if (item.status === "active") { const confirmed = bucket(item.reviewed_at); if (confirmed) confirmed.confirmes += 1; }
    }

    // Spécialités des médecins actifs : les quatre plus fréquentes, le reste regroupé.
    const bySpecialty = new Map<string, number>();
    for (const item of active) { const name = item.professional_specialty?.trim() || "Non renseignée"; bySpecialty.set(name, (bySpecialty.get(name) ?? 0) + 1); }
    const ranked = [...bySpecialty.entries()].sort((a, b) => b[1] - a[1]);
    const specialties = ranked.slice(0, 3).map(([name, value]) => ({ name, value }));
    const rest = ranked.slice(3).reduce((sum, [, value]) => sum + value, 0);
    if (rest > 0) specialties.push({ name: "Autres", value: rest });

    const statuses = Object.entries(STATUS_LABELS).map(([key, label]) => ({ label, value: memberships.filter((item) => item.status === key).length }));
    return { active: active.length, pending: pending.length, total: memberships.length, averageDelay, recentRequests, recentActivations, months, hasDates: months.some((month) => month.demandes + month.confirmes > 0), specialties, statuses };
  }, [memberships]);

  const confirmedShare = stats.total ? `${Math.round((stats.active / stats.total) * 100)} %` : "—";
  const specialtyTotal = stats.specialties.reduce((sum, item) => sum + item.value, 0);

  return (
    <>
      <section className="kpi-grid" aria-label="Indicateurs de l’équipe">
        <Kpi href="/etablissement/medecins" icon="users" tone="" label={`Médecin${stats.active > 1 ? "s" : ""} actif${stats.active > 1 ? "s" : ""}`} value={String(stats.active)} hint={stats.recentActivations ? `+${stats.recentActivations} en 30 j` : undefined} />
        <Kpi href="/etablissement/demandes" icon="document" tone="orb--green" label={`Demande${stats.pending > 1 ? "s" : ""} à traiter`} value={String(stats.pending)} hint={stats.recentRequests ? `+${stats.recentRequests} en 30 j` : undefined} />
        <Kpi icon="check" tone="orb--cream" label="Rattachements confirmés" value={confirmedShare} hint={stats.total ? `${stats.active} sur ${stats.total}` : undefined} />
        <Kpi icon="clock" tone="orb--mint" label="Délai moyen de réponse" value={formatDelay(stats.averageDelay)} />
      </section>

      <div className="role-dashboard-grid">
        <article className="card role-chart-card role-chart-card--wide">
          <div className="section-heading"><div><span className="eyebrow">Activité</span><h2>Demandes et rattachements</h2></div></div>
          <p className="muted">Six derniers mois, par date de demande et de confirmation. Vue administrative : aucun dossier patient.</p>
          {stats.hasDates ? (
            <div className="role-chart-plot role-chart-plot--area" role="img" aria-label={`Demandes reçues et rattachements confirmés par mois : ${stats.months.map((month) => `${month.label} ${month.demandes} demande${month.demandes > 1 ? "s" : ""}, ${month.confirmes} confirmé${month.confirmes > 1 ? "s" : ""}`).join(" ; ")}`}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.months} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                  <defs>
                    <linearGradient id={`${gradientId}-a`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient>
                    <linearGradient id={`${gradientId}-b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.45} /><stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={chartGrid} strokeDasharray="3 4" />
                  <XAxis dataKey="label" tick={{ fill: chartText, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} width={28} tick={{ fill: chartText, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} />
                  <Area type="monotone" dataKey="demandes" name="Demandes reçues" stroke="var(--chart-1)" strokeWidth={3} fill={`url(#${gradientId}-a)`} isAnimationActive={false} />
                  <Area type="monotone" dataKey="confirmes" name="Rattachements confirmés" stroke="var(--chart-2)" strokeWidth={2.5} strokeDasharray="6 5" fill={`url(#${gradientId}-b)`} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChart text="La courbe apparaîtra dès les premières demandes de rattachement." />}
          <ul className="role-chart-legend" aria-label="Légende">
            <li><span style={{ background: "var(--chart-1)" }} />Demandes reçues</li>
            <li><span style={{ background: "var(--chart-2)" }} />Rattachements confirmés</li>
          </ul>
        </article>

        <article className="card role-chart-card">
          <div className="section-heading"><div><span className="eyebrow">Équipe</span><h2>Médecins par spécialité</h2></div></div>
          <p className="muted">Spécialité déclarée par chaque médecin actif, non certifiée par Mon E‑Carnet.</p>
          {specialtyTotal ? (
            <>
              <div className="role-chart-plot role-chart-plot--donut" role="img" aria-label={`Médecins actifs par spécialité : ${stats.specialties.map((item) => `${item.name} ${item.value}`).join(", ")}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} />
                    <Pie data={stats.specialties} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="86%" paddingAngle={2} stroke="none" isAnimationActive={false}>
                      {stats.specialties.map((item, index) => <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="role-chart-legend">
                {stats.specialties.map((item, index) => <li key={item.name}><span style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />{item.name}<strong>{item.value} · {Math.round((item.value / specialtyTotal) * 100)} %</strong></li>)}
              </ul>
            </>
          ) : <EmptyChart text="Aucun médecin actif pour le moment." />}
        </article>

        <article className="card role-chart-card">
          <div className="section-heading"><div><span className="eyebrow">Équipe</span><h2>État des rattachements</h2></div></div>
          <p className="muted">Nombre de médecins par statut de rattachement.</p>
          {stats.total ? (
            <div className="role-chart-plot" role="img" aria-label={`Rattachements par statut : ${stats.statuses.map((item) => `${item.label} ${item.value}`).join(", ")}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.statuses} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                  <CartesianGrid vertical={false} stroke={chartGrid} strokeDasharray="3 4" />
                  <XAxis dataKey="label" tick={{ fill: chartText, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} width={28} tick={{ fill: chartText, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} formatter={(value) => [Number(value ?? 0), "Médecins"]} />
                  <Bar dataKey="value" name="Médecins" radius={[8, 8, 0, 0]} isAnimationActive={false}>
                    {stats.statuses.map((item, index) => <Cell key={item.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChart text="Les rattachements apparaîtront ici." />}
        </article>
      </div>
    </>
  );
}
