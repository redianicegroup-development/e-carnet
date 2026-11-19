"use client";

import { useEffect, useMemo, useState } from "react";
import { listMyPending, type MyPending } from "../application/lab-results";
import { listProfessionalConsultations, listProfessionalGrants } from "../application/professional-access-grants";
import { compareHint, dayBuckets, monthBuckets, plural, total, weekBuckets } from "../lib/dashboard-stats";
import { BarsChart, DonutChart } from "./dashboard/charts-lazy";
import { ChartCard, KpiSection, KpiStat, Segmented } from "./dashboard/SpaceKpis";

/* Indicateurs de l'accueil professionnel : quatre chiffres et deux graphiques, comme l'accueil établissement.
   Ils comptent des consultations signées, des accès et des examens attendus : jamais le contenu d'un dossier.
   « Résultats attendus » dépend de la fonction laboratoire ; si elle n'est pas ouverte, la carte montre les consultations du jour à la place. */

type Grant = { status: string };
type Loaded = { grants: Grant[] | null; dates: string[] | null; pending: MyPending[] | null };
type Span = "weeks" | "months";

const SPANS: readonly { value: Span; label: string }[] = [{ value: "weeks", label: "Semaines" }, { value: "months", label: "Mois" }];
const ENDED = new Set(["expired", "revoked", "refused"]);

async function load(): Promise<Loaded> {
  const [grants, consultations, pending] = await Promise.allSettled([listProfessionalGrants(), listProfessionalConsultations(), listMyPending()]);
  return {
    grants: grants.status === "fulfilled" ? grants.value : null,
    dates: consultations.status === "fulfilled" ? consultations.value.map((item) => item.validated_at) : null,
    // Fonction laboratoire éteinte (404) ou indisponible : même traitement, la carte « Aujourd’hui » prend le relais.
    pending: pending.status === "fulfilled" ? pending.value : null,
  };
}

export function ProfessionalKpis() {
  const [data, setData] = useState<Loaded | null>(null);
  const [span, setSpan] = useState<Span>("weeks");

  useEffect(() => {
    let active = true;
    load().then((value) => { if (active) setData(value); });
    return () => { active = false; };
  }, []);

  const view = useMemo(() => {
    const now = new Date();
    const dates = data?.dates ?? [];
    const [previous, current] = monthBuckets(dates, 2, now);
    const today = total(dayBuckets(dates, 1, now));
    const grants = data?.grants ?? null;
    const active = grants ? grants.filter((item) => item.status === "active").length : null;
    const pending = grants ? grants.filter((item) => item.status === "pending").length : null;
    const ended = grants ? grants.filter((item) => ENDED.has(item.status)).length : 0;
    const waiting = (data?.pending ?? []).filter((item) => item.status === "waiting_results");
    return {
      month: current?.count ?? 0, previousMonth: previous?.count ?? 0, today, active, pending, ended, grantsTotal: grants?.length ?? 0,
      waitingExams: waiting.reduce((sum, item) => sum + item.exams_waiting, 0), waitingConsultations: waiting.length,
      series: span === "weeks" ? weekBuckets(dates, 8, now) : monthBuckets(dates, 6, now), allConsultations: dates.length,
    };
  }, [data, span]);

  const loading = data === null;
  const monthHint = loading ? "Chargement…" : data?.dates === null ? "Indisponible pour le moment" : view.month === 0 && view.previousMonth === 0 ? "Aucune consultation signée ce mois-ci" : compareHint(view.month, view.previousMonth);
  const labOn = Boolean(data?.pending);

  return (
    <KpiSection label="Indicateurs de votre activité">
      <KpiStat featured href="/professionnel/consultations" icon="stethoscope" label="Consultations ce mois" value={data?.dates ? view.month : null} hint={monthHint} />
      <KpiStat href="/professionnel/patients" icon="users" label="Patients avec accès actif" value={view.active} hint={loading ? "Chargement…" : data?.grants === null ? "Indisponible pour le moment" : `${view.grantsTotal} ${plural(view.grantsTotal, "accès", "accès")} au total`} />
      <KpiStat href="/professionnel/patients" icon="document" label="Demandes en attente" value={view.pending} hint={loading ? "Chargement…" : data?.grants === null ? "Indisponible pour le moment" : view.pending ? "En attente de l’accord du patient" : "Aucune demande en attente"} />
      {labOn
        ? <KpiStat href="/professionnel/consultations" icon="document" label="Résultats attendus" value={view.waitingExams} hint={view.waitingConsultations ? `${view.waitingConsultations} ${plural(view.waitingConsultations, "consultation")} en attente d’examens` : "Aucune consultation en attente"} />
        : <KpiStat href="/professionnel/consultations" icon="clock" label="Aujourd’hui" value={data?.dates ? view.today : null} hint={loading ? "Chargement…" : "Consultations signées aujourd’hui"} />}

      <ChartCard
        title="Consultations signées"
        subtitle={span === "weeks" ? "8 dernières semaines" : "6 derniers mois"}
        actions={<Segmented label="Période du graphique" value={span} options={SPANS} onChange={setSpan} />}
        empty={loading ? null : data?.dates === null ? "Graphique indisponible pour le moment." : view.allConsultations === 0 ? "Aucune consultation signée pour le moment." : null}
      >
        {loading ? <div className="space-chart__plot space-chart__plot--loading" aria-hidden="true" /> : <BarsChart data={view.series} noun="consultations" />}
      </ChartCard>

      <ChartCard title="Mes accès" subtitle="Répartition des demandes d’accès" empty={loading ? null : data?.grants === null ? "Graphique indisponible pour le moment." : view.grantsTotal === 0 ? "Aucune demande d’accès pour le moment." : null}>
        {loading ? <div className="space-chart__plot space-chart__plot--loading" aria-hidden="true" /> : <DonutChart noun="accès" slices={[{ name: "Actifs", value: view.active ?? 0 }, { name: "En attente", value: view.pending ?? 0 }, { name: "Terminés", value: view.ended }]} />}
      </ChartCard>
    </KpiSection>
  );
}
