"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { isLabFeatureOff, listLabHistory, type LabHistory } from "../application/lab-results";
import { dayBuckets, tally, total } from "../lib/dashboard-stats";
import { KIND_LABEL, localDay } from "../lib/lab-history";
import { BarsChart, DonutChart } from "./dashboard/charts-lazy";
import { ChartCard, KpiSection, KpiStat, Segmented } from "./dashboard/SpaceKpis";
import { Icon } from "./ui/Icon";
import { PageHeader } from "./ui/PageHeader";
import { useLaboratoryName } from "./useLaboratoryName";

/* Accueil du laboratoire : ses dépôts en un coup d'œil, avec les mêmes cartes d'indicateurs que les autres espaces, et le raccourci vers le scanner.
   Tout vient de l'historique des dépôts des 30 derniers jours (initiales, année de naissance, libellé d'examen) : aucun nom, aucun contenu de fichier.
   Un « dépôt » est un résultat déposé ou remplacé par une version corrigée ; les examens abandonnés par le médecin sont comptés à part. */

type Range = "7" | "30";
const RANGES: readonly { value: Range; label: string }[] = [{ value: "7", label: "7 jours" }, { value: "30", label: "30 jours" }];
const average = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function LaboratoryHome() {
  const name = useLaboratoryName();
  const [history, setHistory] = useState<LabHistory | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "off" | "error">("loading");
  const [range, setRange] = useState<Range>("7");

  useEffect(() => {
    let active = true;
    const now = new Date();
    const from = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
    listLabHistory({ from })
      .then((value) => { if (active) { setHistory(value); setState("ready"); } })
      .catch((error: unknown) => { if (active) setState(isLabFeatureOff(error) ? "off" : "error"); });
    return () => { active = false; };
  }, []);

  const view = useMemo(() => {
    const now = new Date();
    const items = history?.items ?? [];
    const deposits = items.filter((item) => item.status !== "abandoned");
    const dates = deposits.map((item) => item.occurred_at);
    const [yesterday, today] = dayBuckets(dates, 2, now);
    const week = total(dayBuckets(dates, 7, now));
    const kinds = tally(deposits, (item) => item.exam_kind || "other");
    return {
      today: today?.count ?? 0, yesterday: yesterday?.count ?? 0, week, perDay: average.format(week / 7), totalDeposits: deposits.length,
      replaced: items.filter((item) => item.status === "replaced").length,
      abandoned: items.filter((item) => item.status === "abandoned").length,
      series: dayBuckets(dates, Number(range), now),
      kinds: Object.keys(KIND_LABEL).map((key) => ({ name: KIND_LABEL[key] ?? key, value: kinds[key] ?? 0 })),
    };
  }, [history, range]);

  if (state === "off") return <section className="notice" role="status"><strong>Espace laboratoire non activé.</strong> Cette fonction n’est pas encore ouverte pour votre structure.</section>;

  const loading = state === "loading";
  const failed = state === "error";
  const hint = (text: string) => (loading ? "Chargement…" : failed ? "Indisponible pour le moment" : text);
  const value = (count: number) => (loading || failed ? null : count);

  return (
    <div className="stack-lg">
      <PageHeader eyebrow={name} title="Accueil" lead="Vos dépôts de résultats, en un coup d’œil. Le contenu des fichiers n’est jamais relu.">
        <div className="actions"><Link className="button dark" href="/laboratoire/scanner"><Icon name="qr" size={18} /> Scanner un QR d’examen</Link></div>
      </PageHeader>

      <KpiSection label="Indicateurs de vos dépôts">
        <KpiStat featured href="/laboratoire/depots" icon="document" label="Dépôts aujourd’hui" value={value(view.today)} hint={hint(`${view.yesterday} hier`)} />
        <KpiStat href="/laboratoire/depots" icon="clock" label="Dépôts · 7 jours" value={value(view.week)} hint={hint(`≈ ${view.perDay} par jour`)} />
        <KpiStat href="/laboratoire/depots" icon="refresh" label="Remplacés · 30 jours" value={value(view.replaced)} hint={hint("Corrigés par un nouveau dépôt")} />
        <KpiStat href="/laboratoire/depots" icon="close" label="Abandonnés · 30 jours" value={value(view.abandoned)} hint={hint("Abandonnés par le médecin")} />

        <ChartCard
          title="Dépôts par jour"
          subtitle={range === "7" ? "7 derniers jours" : "30 derniers jours"}
          actions={<Segmented label="Période du graphique" value={range} options={RANGES} onChange={setRange} />}
          empty={failed ? "Graphique indisponible pour le moment." : !loading && view.totalDeposits === 0 ? "Aucun dépôt sur les 30 derniers jours." : null}
        >
          {loading ? <div className="space-chart__plot space-chart__plot--loading" aria-hidden="true" /> : <BarsChart data={view.series} noun="dépôts" />}
        </ChartCard>

        <ChartCard title="Types d’examens" subtitle="Dépôts des 30 derniers jours" empty={failed ? "Graphique indisponible pour le moment." : !loading && view.totalDeposits === 0 ? "Aucun dépôt sur les 30 derniers jours." : null}>
          {loading ? <div className="space-chart__plot space-chart__plot--loading" aria-hidden="true" /> : <DonutChart noun="dépôts" slices={view.kinds} />}
        </ChartCard>
      </KpiSection>

      {history?.truncated && <p className="muted" role="note">Seuls les dépôts les plus récents sont comptés : sur une très longue période, les chiffres peuvent être incomplets.</p>}
    </div>
  );
}
