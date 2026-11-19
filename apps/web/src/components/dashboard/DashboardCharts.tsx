"use client";

import { useId, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Bucket } from "../../lib/dashboard-stats";
import { filterMeasurementSeries, groupMeasurementSeries, type MeasurementSeriesInput } from "../../lib/measurement-series";
import { CHART_COLORS, chartGrid, chartText, tooltipStyle, tooltipText } from "../RoleDashboards";

/* Graphiques Recharts des accueils. Ce fichier n'est téléchargé qu'au moment de les afficher (voir charts-lazy.tsx).
   Chaque graphique a un résumé lisible par un lecteur d'écran (role="img" + aria-label) ; les couleurs sont celles du thème (--chart-1 à --chart-4). */

const axisTick = { fill: chartText, fontSize: 11 };
const summaryOf = (data: readonly Bucket[]) => data.map((item) => `${item.title} : ${item.count}`).join(", ");

/** Barres : un nombre par jour, semaine ou mois. */
export function BarsChart({ data, noun }: { data: Bucket[]; noun: string }) {
  return (
    <div className="space-chart__plot" role="img" aria-label={`${noun} : ${summaryOf(data)}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={chartGrid} strokeDasharray="3 4" />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} width={40} tick={axisTick} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "var(--edash-soft)" }} contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} labelFormatter={(_, payload) => payload?.[0]?.payload?.title ?? ""} formatter={(value) => [Number(value ?? 0), noun]} />
          <Bar dataKey="count" name={noun} fill="var(--chart-1)" radius={[8, 8, 0, 0]} maxBarSize={34} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Aire : l'évolution d'un nombre mois après mois. */
export function AreaCountChart({ data, noun }: { data: Bucket[]; noun: string }) {
  const gradient = `space-area-${useId().replace(/:/g, "")}`;
  return (
    <div className="space-chart__plot" role="img" aria-label={`${noun} : ${summaryOf(data)}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.42} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={chartGrid} strokeDasharray="3 4" />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} width={40} tick={axisTick} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} labelFormatter={(_, payload) => payload?.[0]?.payload?.title ?? ""} formatter={(value) => [Number(value ?? 0), noun]} />
          <Area type="monotone" dataKey="count" name={noun} stroke="var(--chart-1)" strokeWidth={3} fill={`url(#${gradient})`} dot={{ r: 3, strokeWidth: 0, fill: "var(--chart-1)" }} activeDot={{ r: 5 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export type Slice = { name: string; value: number };

/** Anneau : une répartition, avec la légende en toutes lettres à côté (jamais la couleur seule). */
export function DonutChart({ slices, noun }: { slices: Slice[]; noun: string }) {
  const sum = slices.reduce((count, slice) => count + slice.value, 0);
  const shown = slices.map((slice, index) => ({ ...slice, color: CHART_COLORS[index % CHART_COLORS.length] })).filter((slice) => slice.value > 0);
  return (
    <div className="space-donut">
      <div className="space-donut__plot" role="img" aria-label={`${noun} : ${slices.map((slice) => `${slice.name} ${slice.value}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={shown} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="94%" paddingAngle={shown.length > 1 ? 3 : 0} stroke="none" isAnimationActive={false}>
              {shown.map((slice) => <Cell key={slice.name} fill={slice.color} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} />
          </PieChart>
        </ResponsiveContainer>
        <span className="space-donut__total" aria-hidden="true"><strong>{sum}</strong><small>{noun}</small></span>
      </div>
      <ul className="space-donut__legend">
        {slices.map((slice, index) => <li key={slice.name}><span className="space-donut__dot" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} aria-hidden="true" /><span>{slice.name}</span><strong>{slice.value}</strong></li>)}
      </ul>
    </div>
  );
}

const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "numeric" });
const longDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

/** Courbe d'une mesure (poids, tension…) : la série qui a le plus de valeurs d'abord, les autres au choix. Les valeurs, sans seuil ni interprétation. */
export function MeasurementLine({ records }: { records: MeasurementSeriesInput[] }) {
  const series = useMemo(() => groupMeasurementSeries(records).sort((a, b) => b.points.length - a.points.length), [records]);
  const [selectedKey, setSelectedKey] = useState("");
  const selected = series.find((item) => item.key === selectedKey) ?? series[0];
  if (!selected) return null;
  const visible = filterMeasurementSeries(selected, "all");
  const data = visible.points.slice(-30).map((point) => ({ ...point, date: shortDate.format(new Date(point.measuredAt)) }));
  const unit = selected.unit ? ` ${selected.unit}` : "";
  return (
    <>
      {series.length > 1 && (
        <label className="space-chart__field">
          <span className="sr-only">Type de mesure</span>
          <select value={selected.key} onChange={(event) => setSelectedKey(event.target.value)}>
            {series.map((item) => <option key={item.key} value={item.key}>{item.label}{item.unit ? ` (${item.unit})` : ""}</option>)}
          </select>
        </label>
      )}
      <div className="space-chart__plot" role="img" aria-label={`${selected.label}, ${data.length} valeur${data.length > 1 ? "s" : ""} : ${data.map((point) => `${point.date} ${point.value}${unit}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={chartGrid} strokeDasharray="3 4" />
            <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis domain={["auto", "auto"]} width={42} tick={axisTick} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} labelFormatter={(_, payload) => (payload?.[0]?.payload?.measuredAt ? longDate.format(new Date(payload[0].payload.measuredAt)) : "")} formatter={(value) => [`${Number(value ?? 0)}${unit}`, selected.label]} />
            <Line type="monotone" dataKey="value" name={selected.label} stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 3, strokeWidth: 0, fill: "var(--chart-1)" }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
