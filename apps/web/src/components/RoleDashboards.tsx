"use client";

import { useId, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Icon } from "./ui/Icon";

/* Séries de graphiques : uniquement les nuances de la palette du thème (voir tokens.css), jamais une teinte propre au graphique. */
export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
export const chartText = "var(--chart-text)";
export const chartGrid = "var(--chart-grid)";
export const tooltipStyle = { background: "var(--text)", border: 0, borderRadius: 10, color: "var(--bg)", fontSize: 12, boxShadow: "0 8px 24px rgb(0 0 0 / .18)" };
export const tooltipText = { color: "var(--bg)" };
const COLORS = CHART_COLORS;

type Metric = { label: string; value: number; color?: string };

export function EmptyChart({ text }: { text: string }) {
  return <div className="role-chart-empty" role="status">{text}</div>;
}

export function PatientDashboardChart({ metrics }: { metrics: Metric[] }) {
  const [open, setOpen] = useState(true);
  const panelId = useId();
  const data = metrics.filter((item) => item.value > 0);
  return (
    <article className="card role-chart-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Mon carnet</span>
          <h2 className="role-chart-card__title">
            <button className="role-chart-card__toggle" type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
              <span>Vue d’ensemble</span><Icon name="chevron" size={18} />
            </button>
          </h2>
        </div>
      </div>
      <div id={panelId} className="role-chart-card__content" hidden={!open}>
        <p className="muted">Un aperçu des éléments déjà enregistrés, sans afficher de contenu médical dans le graphique.</p>
        {data.length ? (
          <div className="role-chart-plot" role="img" aria-label="Répartition des éléments du carnet">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke={chartGrid} strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: chartText, fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} width={28} tick={{ fill: chartText, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} formatter={(value) => [Number(value ?? 0), "Éléments"]} />
                <Bar dataKey="value" name="Éléments" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                  {data.map((item, index) => <Cell key={item.label} fill={item.color ?? COLORS[index % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyChart text="Votre graphique apparaîtra après votre première information." />}
      </div>
    </article>
  );
}

export function ProfessionalDashboardChart({ metrics }: { metrics: Metric[] }) {
  const data = metrics.map((item) => ({ ...item, value: Math.max(0, item.value) }));
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return <article className="card role-chart-card"><div className="section-heading"><div><span className="eyebrow">Activité professionnelle</span><h2>Répartition du suivi</h2></div></div><p className="muted">Les compteurs concernent votre activité et non le contenu médical des patients.</p>{total ? <div className="role-chart-plot role-chart-plot--donut" role="img" aria-label="Répartition de l’activité professionnelle"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="78%" paddingAngle={3} isAnimationActive={false}>{data.map((item, index) => <Cell key={item.label} fill={item.color ?? COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} formatter={(value, name) => [Number(value ?? 0), String(name)]} /></PieChart></ResponsiveContainer></div> : <EmptyChart text="Votre activité apparaîtra après le premier rattachement ou la première demande." />}<ul className="role-chart-legend" aria-label="Légende de l’activité">{data.map((item, index) => <li key={item.label}><span style={{ backgroundColor: item.color ?? COLORS[index % COLORS.length] }} aria-hidden="true" />{item.label}<strong>{item.value}</strong></li>)}</ul></article>;
}

export function EstablishmentDashboardChart({ pending, active }: { pending: number; active: number }) {
  const data = [{ label: "Actifs", value: active }, { label: "En attente", value: pending }];
  return <article className="card role-chart-card"><div className="section-heading"><div><span className="eyebrow">Équipe</span><h2>État des rattachements</h2></div></div><p className="muted">Vue administrative uniquement. Aucun dossier patient n’est inclus.</p><div className="role-chart-plot" role="img" aria-label="État des rattachements des professionnels"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}><CartesianGrid vertical={false} stroke={chartGrid} strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fill: chartText, fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} width={28} tick={{ fill: chartText, fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} formatter={(value) => [Number(value ?? 0), "Professionnels"]} /><Bar dataKey="value" name="Professionnels" radius={[6, 6, 0, 0]} isAnimationActive={false}><Cell fill="#16835d" /><Cell fill="#d58b16" /></Bar></BarChart></ResponsiveContainer></div></article>;
}
