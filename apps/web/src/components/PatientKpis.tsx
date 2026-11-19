"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet } from "../infrastructure/api/client";
import type { AppointmentLike } from "../lib/agenda";
import { daysUntil, monthBuckets, nextUpcoming, plural, toDate, total, whenParts } from "../lib/dashboard-stats";
import type { HealthMeasurementRecord } from "../lib/measurement-types";
import { AreaCountChart, MeasurementLine } from "./dashboard/charts-lazy";
import { ChartCard, KpiSection, KpiStat } from "./dashboard/SpaceKpis";

/* Indicateurs de l'accueil patient : quatre chiffres et deux graphiques, dans la même présentation que l'accueil établissement.
   Chaque source est indépendante : une réponse qui échoue laisse un tiret (jamais un zéro inventé) et n'empêche pas les autres.
   Rien d'interprété : des comptes, des dates et les valeurs déjà enregistrées par le patient. */

export type PatientCarnetCounts = { declarations: number | null; documents: number | null; vaccinations: number | null };

type Loaded = {
  appointments: AppointmentLike[] | null;
  consultations: { validated_at: string }[] | null;
  grants: { status: string }[] | null;
  measurements: HealthMeasurementRecord[] | null;
};

function settled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

async function load(): Promise<Loaded> {
  const [appointments, consultations, grants, measurements] = await Promise.allSettled([
    apiGet<AppointmentLike[]>("/api/v1/patient/care/appointments/"),
    apiGet<{ validated_at: string }[]>("/api/v1/patient/care/consultations/"),
    apiGet<{ status: string }[]>("/api/v1/patient/care/access-grants/"),
    apiGet<HealthMeasurementRecord[]>("/api/v1/patient/care/measurements/"),
  ]);
  return { appointments: settled(appointments), consultations: settled(consultations), grants: settled(grants), measurements: settled(measurements) };
}

const appointmentDate = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function PatientKpis({ carnet }: { carnet: PatientCarnetCounts | null }) {
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    let active = true;
    load().then((value) => { if (active) setData(value); });
    return () => { active = false; };
  }, []);

  const view = useMemo(() => {
    const now = new Date();
    const next = data?.appointments ? nextUpcoming(data.appointments, now) : null;
    const days = next ? daysUntil(next.starts_at, now) : null;
    const when = days === null ? null : whenParts(days);
    const dates = data?.consultations?.map((item) => item.validated_at) ?? [];
    const year = total(monthBuckets(dates, 12, now));
    const grants = data?.grants ?? null;
    const active = grants ? grants.filter((item) => item.status === "active").length : null;
    const pending = grants ? grants.filter((item) => item.status === "pending").length : 0;
    const known = carnet ? [carnet.declarations, carnet.documents, carnet.vaccinations].filter((value) => value !== null) as number[] : [];
    const filled = known.filter((value) => value > 0).length;
    const measurements = (data?.measurements ?? []).map((item) => ({ id: item.id, kind: item.kind, kind_label: item.kind_label, value: item.value, unit: item.unit, source: item.source, measured_at: item.measured_at }));
    return { next, when, year, allConsultations: dates.filter((value) => toDate(value)).length, months: monthBuckets(dates, 6, now), active, pending, known: known.length, filled, measurements };
  }, [data, carnet]);

  const loading = data === null;
  const appointmentsHint = loading ? "Chargement…" : data.appointments === null ? "Indisponible pour le moment" : view.next ? appointmentDate.format(new Date(view.next.starts_at)) : "Aucun rendez-vous prévu";
  const consultationsHint = loading ? "Chargement…" : data.consultations === null ? "Indisponible pour le moment" : view.allConsultations ? `${view.allConsultations} au total` : "Aucune consultation signée";
  const grantsHint = loading ? "Chargement…" : data.grants === null ? "Indisponible pour le moment" : view.pending ? `${view.pending} ${plural(view.pending, "demande")} en attente` : "Aucune demande en attente";
  const carnetHint = !carnet ? "Chargement…" : view.known < 3 ? "Certaines rubriques n’ont pas pu être chargées" : "Déclarations · documents · vaccins";

  return (
    <KpiSection label="Indicateurs de votre carnet">
      <KpiStat featured href="/patient/agenda" icon="clock" label="Prochain rendez-vous" value={view.when?.value ?? null} unit={view.when?.unit} wordy={view.when?.wordy} hint={appointmentsHint} />
      <KpiStat href="/patient/historique" icon="stethoscope" label="Consultations · 12 mois" value={data?.consultations ? view.year : null} hint={consultationsHint} />
      <KpiStat href="/patient/historique#acces" icon="share" label="Accès ouverts" value={view.active} hint={grantsHint} />
      <KpiStat href="/patient/carnet" icon="folder" label="Carnet rempli" value={carnet && view.known > 0 ? `${view.filled}/3` : null} hint={carnetHint} />

      <ChartCard title="Consultations par mois" subtitle="6 derniers mois" empty={loading ? null : data.consultations === null ? "Graphique indisponible pour le moment." : view.allConsultations === 0 ? "Aucune consultation signée pour le moment." : null}>
        {loading ? <div className="space-chart__plot space-chart__plot--loading" aria-hidden="true" /> : <AreaCountChart data={view.months} noun="consultations" />}
      </ChartCard>

      <ChartCard title="Mes mesures" subtitle="Valeurs enregistrées, sans interprétation" actions={<Link className="edash-more" href="/patient/historique">Ajouter</Link>} empty={loading ? null : data.measurements === null ? "Graphique indisponible pour le moment." : view.measurements.length === 0 ? "Aucune mesure enregistrée pour le moment." : null}>
        {loading ? <div className="space-chart__plot space-chart__plot--loading" aria-hidden="true" /> : <MeasurementLine records={view.measurements} />}
      </ChartCard>
    </KpiSection>
  );
}
