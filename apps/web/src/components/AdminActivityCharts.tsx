"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type DailyActivityPoint = {
  date: string;
  new_visitors: number;
  feedback_submissions: number;
  visitor_survey_responses: number;
  product_survey_responses: number;
  survey_responses: number;
  average_rating: number | null;
};

const axisColor = "#68747d";
const gridColor = "#e4e9e7";
const activityLegend = [
  ["#16835d", "Nouveaux visiteurs"],
  ["#5477d4", "Feedback"],
  ["#d58b16", "Enquête visiteurs"],
  ["#8a55a2", "Enquête utilisateurs"],
] as const;
const formatShortDate = (value: string) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
const formatLongDate = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date(`${value}T12:00:00`));

export function AdminActivityCharts({ data }: { data: DailyActivityPoint[] }) {
  const hasRatings = data.some((point) => point.average_rating !== null);

  return <section className="admin-charts-grid" aria-label="Courbes d’activité des 30 derniers jours">
    <article className="card admin-chart-card">
      <header className="admin-chart-heading"><div><span className="eyebrow">Tendance · 30 jours</span><h2>Visiteurs et retours quotidiens</h2></div></header>
      <p className="muted admin-chart-description">Nouveaux visiteurs, retours libres et réponses aux deux enquêtes.</p>
      <div className="admin-chart-plot" role="img" aria-label="Graphique des visites, retours et réponses aux enquêtes sur 30 jours">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 16, left: -12, bottom: 4 }}>
            <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis allowDecimals={false} width={36} tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip labelFormatter={(label) => formatLongDate(String(label))} formatter={(value, name) => [Number(value ?? 0), String(name)]} contentStyle={{ background: "var(--surface)", borderColor: "var(--border)", borderRadius: 12, boxShadow: "0 8px 24px rgba(16, 24, 40, .12)" }} />
            <Line type="monotone" dataKey="new_visitors" name="Nouveaux visiteurs" stroke="#16835d" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="feedback_submissions" name="Feedback" stroke="#5477d4" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="visitor_survey_responses" name="Enquête visiteurs" stroke="#d58b16" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="product_survey_responses" name="Enquête utilisateurs" stroke="#8a55a2" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="admin-chart-legend" aria-label="Légende des événements"><li className="admin-chart-legend-title">Légende</li>{activityLegend.map(([color, label]) => <li key={label}><span className="admin-chart-legend-mark" style={{ backgroundColor: color }} aria-hidden="true" />{label}</li>)}</ul>
    </article>

    <article className="card admin-chart-card">
      <header className="admin-chart-heading"><div><span className="eyebrow">Expérience produit · 30 jours</span><h2>Facilité moyenne</h2></div></header>
      <p className="muted admin-chart-description">Moyenne des réponses à « Cette tâche était… », de 1 à 5.</p>
      {hasRatings ? <div className="admin-chart-plot" role="img" aria-label="Courbe quotidienne de la facilité moyenne de la tâche, sur cinq">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 16, left: -8, bottom: 4 }}>
            <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} width={32} tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip labelFormatter={(label) => formatLongDate(String(label))} formatter={(value) => [`${Number(value).toFixed(1)} / 5`, "Facilité moyenne"]} contentStyle={{ background: "var(--surface)", borderColor: "var(--border)", borderRadius: 12, boxShadow: "0 8px 24px rgba(16, 24, 40, .12)" }} />
            <Line type="monotone" dataKey="average_rating" name="Facilité moyenne" stroke="#b27100" strokeWidth={3} dot={{ r: 3, fill: "#b27100" }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div> : <div className="admin-chart-empty">La courbe apparaîtra après les premiers retours produit.</div>}
    </article>
    <p className="admin-chart-footnote">Les courbes reflètent uniquement les dates conservées par le système. Les compteurs cumulés de pages et de clics ne sont pas ventilés par jour, car leur historique n’est pas stocké.</p>
  </section>;
}
