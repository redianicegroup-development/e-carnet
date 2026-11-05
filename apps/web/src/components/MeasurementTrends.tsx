"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartGrid, chartText, tooltipStyle, tooltipText } from "./RoleDashboards";
import { filterMeasurementSeries, groupMeasurementSeries, type MeasurementPeriod, type MeasurementSeriesInput, type MeasurementSeriesPoint } from "../lib/measurement-series";

type MeasurementTrendsProps = {
  records?: readonly MeasurementSeriesInput[] | null;
  loading?: boolean;
  error?: string | null;
};

const PERIODS: readonly { value: MeasurementPeriod; label: string }[] = [
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
  { value: "all", label: "Tout l’historique" },
];

const dateLabel = (value: string) => new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
const dateDetail = (value: string) => new Date(value).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });

function Point({ cx, cy, payload }: { cx?: number; cy?: number; payload?: MeasurementSeriesPoint }) {
  if (cx === undefined || cy === undefined) return null;
  const measured = payload?.source === "measured";
  return <circle cx={cx} cy={cy} r={measured ? 4 : 5} fill={measured ? "var(--chart-1)" : "var(--bg)"} stroke="var(--chart-1)" strokeWidth={2} />;
}

function AlternativeTable({ points, unit }: { points: MeasurementSeriesPoint[]; unit: string }) {
  return <details className="measurement-trends__alternative">
    <summary>Afficher le tableau des valeurs</summary>
    <div className="measurement-trends__table-wrap">
      <table><caption className="sr-only">Valeurs de la série sélectionnée</caption><thead><tr><th scope="col">Date</th><th scope="col">Valeur</th><th scope="col">Provenance</th></tr></thead><tbody>{points.map((point) => <tr key={point.id}><td>{dateDetail(point.measuredAt)}</td><td>{point.value}{unit ? ` ${unit}` : ""}</td><td>{point.sourceLabel}</td></tr>)}</tbody></table>
    </div>
  </details>;
}

export function MeasurementTrends({ records, loading = false, error = null }: MeasurementTrendsProps) {
  const [period, setPeriod] = useState<MeasurementPeriod>("all");
  const [selectedKey, setSelectedKey] = useState("");
  const series = useMemo(() => groupMeasurementSeries(records ?? []), [records]);
  const selected = series.find((item) => item.key === selectedKey) ?? series[0];
  const visible = selected ? filterMeasurementSeries(selected, period) : null;
  const chartData = visible?.points.map((point) => ({ ...point, date: dateLabel(point.measuredAt) })) ?? [];
  const summary = visible ? `${visible.label}, ${visible.points.length} valeur${visible.points.length > 1 ? "s" : ""}${visible.unit ? ` en ${visible.unit}` : ""}` : "Aucune série numérique";

  return <section className="card measurement-trends" aria-labelledby="measurement-trends-title">
    <div className="section-heading"><div><span className="eyebrow">PAT-13 · suivi visuel</span><h2 id="measurement-trends-title">Tendance des mesures</h2></div></div>
    <p className="muted">Les courbes montrent les valeurs enregistrées, sans seuil, alerte ni interprétation médicale. Un point plein correspond à une mesure ; un point creux à une déclaration.</p>
    {loading && <div className="skeleton" role="status"><span className="sr-only">Chargement des tendances…</span><i /></div>}
    {!loading && error && <div className="notice error" role="alert">{error}</div>}
    {!loading && !error && series.length === 0 && <div className="role-chart-empty" role="status">Aucune mesure numérique à afficher pour le moment.</div>}
    {!loading && !error && series.length > 0 && <>
      <div className="measurement-trends__controls">
        <label className="field"><span>Type de mesure</span><select value={selected?.key ?? ""} onChange={(event) => setSelectedKey(event.target.value)}>{series.map((item) => <option key={item.key} value={item.key}>{item.label}{item.unit ? ` (${item.unit})` : ""}</option>)}</select></label>
        <label className="field"><span>Période</span><select value={period} onChange={(event) => setPeriod(event.target.value as MeasurementPeriod)}>{PERIODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      </div>
      {visible && visible.points.length === 0 ? <div className="role-chart-empty" role="status">Aucune valeur dans cette période.</div> : visible && <>
        <div className="role-chart-plot role-chart-plot--area" role="img" aria-label={`Évolution des mesures : ${summary}. Les points pleins sont mesurés et les points creux déclarés.`}>
          <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 4 }}>
            <CartesianGrid vertical={false} stroke={chartGrid} strokeDasharray="3 4" />
            <XAxis dataKey="date" tick={{ fill: chartText, fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis domain={["auto", "auto"]} width={42} tick={{ fill: chartText, fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} formatter={(value) => [Number(value ?? 0), visible.unit || "Valeur"]} labelFormatter={(_, payload) => payload?.[0]?.payload ? `${dateDetail(payload[0].payload.measuredAt)} · ${payload[0].payload.sourceLabel}` : ""} />
            <Line type="monotone" dataKey="value" name={visible.label} stroke="var(--chart-1)" strokeWidth={3} dot={<Point />} activeDot={{ r: 6 }} isAnimationActive={false} />
          </LineChart></ResponsiveContainer>
        </div>
        <AlternativeTable points={visible.points} unit={visible.unit} />
      </>}
    </>}
  </section>;
}
