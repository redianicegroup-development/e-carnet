export type MeasurementSource = "measured" | "declared";

export type MeasurementSeriesInput = {
  id?: string;
  kind: string;
  kind_label?: string;
  value?: string | number | null;
  raw_value?: string | null;
  unit?: string | null;
  source: MeasurementSource;
  source_label?: string;
  measured_at: string;
};

export type MeasurementSeriesPoint = {
  id: string;
  value: number;
  unit: string;
  measuredAt: string;
  source: MeasurementSource;
  sourceLabel: string;
};

export type MeasurementSeries = {
  key: string;
  kind: string;
  label: string;
  unit: string;
  points: MeasurementSeriesPoint[];
};

export type MeasurementPeriod = "7" | "30" | "90" | "all";

const DAY = 86_400_000;

function numeric(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(",", ".");
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function textValue(record: MeasurementSeriesInput): string {
  if (typeof record.raw_value === "string" && record.raw_value.trim()) return record.raw_value.trim();
  return typeof record.value === "string" ? record.value.trim() : String(record.value ?? "").trim();
}

function point(record: MeasurementSeriesInput, id: string, value: number, unit: string): MeasurementSeriesPoint {
  return {
    id,
    value,
    unit,
    measuredAt: record.measured_at,
    source: record.source,
    sourceLabel: record.source_label ?? (record.source === "measured" ? "Mesuré" : "Déclaré"),
  };
}

function addSeries(map: Map<string, MeasurementSeries>, key: string, kind: string, label: string, unit: string, item: MeasurementSeriesPoint) {
  const series = map.get(key) ?? { key, kind, label, unit, points: [] };
  series.points.push(item);
  map.set(key, series);
}

function bloodPressure(record: MeasurementSeriesInput, map: Map<string, MeasurementSeries>): boolean {
  const match = textValue(record).match(/^\s*([0-9]{1,3}(?:[,.][0-9]+)?)\s*\/\s*([0-9]{1,3}(?:[,.][0-9]+)?)/);
  if (!match) return false;
  const rawSystolic = numeric(match[1]);
  const rawDiastolic = numeric(match[2]);
  if (rawSystolic === null || rawDiastolic === null) return false;
  // Le format courant 12/8 est explicitement noté en dizaines de mmHg.
  const systolic = rawSystolic < 30 ? rawSystolic * 10 : rawSystolic;
  const diastolic = rawDiastolic < 30 ? rawDiastolic * 10 : rawDiastolic;
  addSeries(map, "blood_pressure:systolic", record.kind, "Tension systolique", "mmHg", point(record, `${record.id ?? record.measured_at}:systolic`, systolic, "mmHg"));
  addSeries(map, "blood_pressure:diastolic", record.kind, "Tension diastolique", "mmHg", point(record, `${record.id ?? record.measured_at}:diastolic`, diastolic, "mmHg"));
  return true;
}

function glucose(record: MeasurementSeriesInput, map: Map<string, MeasurementSeries>): boolean {
  const value = numeric(textValue(record).match(/^\s*([0-9]+(?:[,.][0-9]+)?)/)?.[1]);
  if (value === null) return false;
  const textUnit = textValue(record).match(/\d+(?:[,.]\d+)?\s*([a-zA-Zµμ]+\s*(?:\/\s*[a-zA-Z]+)?)/)?.[1]?.replace(/\s+/g, " ").trim();
  const unit = textUnit || record.unit?.trim() || "unité non précisée";
  addSeries(map, `glycemia:${unit.toLowerCase()}`, record.kind, `Glycémie · ${unit}`, unit, point(record, record.id ?? record.measured_at, value, unit));
  return true;
}

/** Convertit les valeurs affichables en séries sans appliquer de seuil ni d’interprétation médicale. */
export function groupMeasurementSeries(records: readonly MeasurementSeriesInput[]): MeasurementSeries[] {
  const grouped = new Map<string, MeasurementSeries>();
  for (const record of records) {
    if (!record.measured_at || Number.isNaN(Date.parse(record.measured_at))) continue;
    if (record.kind === "blood_pressure" && bloodPressure(record, grouped)) continue;
    if (record.kind === "glycemia" && glucose(record, grouped)) continue;
    const value = numeric(record.value);
    if (value === null) continue;
    const unit = record.unit?.trim() ?? "";
    addSeries(grouped, record.kind, record.kind, record.kind_label ?? record.kind, unit, point(record, record.id ?? record.measured_at, value, unit));
  }
  return [...grouped.values()]
    .map((series) => ({ ...series, points: [...series.points].sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt)) }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

export function filterMeasurementSeries(series: MeasurementSeries, period: MeasurementPeriod, now = Date.now()): MeasurementSeries {
  if (period === "all") return series;
  const cutoff = now - Number(period) * DAY;
  return { ...series, points: series.points.filter((item) => Date.parse(item.measuredAt) >= cutoff) };
}
