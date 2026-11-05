import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const { groupMeasurementSeries, filterMeasurementSeries } = await import("../src/lib/measurement-series.ts");

const record = (overrides = {}) => ({
  id: randomUUID(), kind: "temperature", kind_label: "Température", value: "37,2", unit: "°C",
  source: "measured", source_label: "Mesuré", measured_at: "2026-11-01T10:00:00Z", ...overrides,
});

test("normalise 12/8 en deux séries mmHg sans seuil clinique", () => {
  const series = groupMeasurementSeries([record({ kind: "blood_pressure", kind_label: "Tension", value: "12/8", unit: "" })]);
  assert.deepEqual(series.map(({ key, unit, points }) => [key, unit, points[0].value]), [
    ["blood_pressure:diastolic", "mmHg", 80], ["blood_pressure:systolic", "mmHg", 120],
  ]);
});

test("garde les glycémies séparées par unité sans conversion silencieuse", () => {
  const series = groupMeasurementSeries([
    record({ kind: "glycemia", kind_label: "Glycémie", value: "5,2 mmol/L", unit: "" }),
    record({ kind: "glycemia", kind_label: "Glycémie", value: "0,9 g/L", unit: "" }),
  ]);
  assert.deepEqual(series.map(({ unit, points }) => [unit, points[0].value]).sort(), [["g/L", 0.9], ["mmol/L", 5.2]]);
});

test("trie les points et conserve la provenance mesurée ou déclarée", () => {
  const series = groupMeasurementSeries([
    record({ id: "late", measured_at: "2026-11-03T10:00:00Z", source: "declared", source_label: "Déclaré" }),
    record({ id: "early", measured_at: "2026-11-01T10:00:00Z" }),
  ])[0];
  assert.deepEqual(series.points.map(({ id, source }) => [id, source]), [["early", "measured"], ["late", "declared"]]);
});

test("filtre une période sans changer la série originale", () => {
  const series = groupMeasurementSeries([
    record({ id: "old", measured_at: "2026-10-01T10:00:00Z" }),
    record({ id: "recent", measured_at: "2026-11-04T10:00:00Z" }),
  ])[0];
  const filtered = filterMeasurementSeries(series, "7", Date.parse("2026-11-05T10:00:00Z"));
  assert.deepEqual(filtered.points.map(({ id }) => id), ["recent"]);
  assert.equal(series.points.length, 2);
});
