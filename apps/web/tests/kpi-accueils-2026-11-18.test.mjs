// Accueils patient, professionnel et laboratoire : KPI en Recharts, même carte et même grille que l'accueil établissement (18/11/2026).
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8");
const stats = await import("../src/lib/dashboard-stats.ts");
const spaces = await import("../src/lib/spaces.ts");

// mercredi 18 novembre 2026, midi (heure locale)
const NOW = new Date(2026, 10, 18, 12, 0, 0);
const counts = (buckets) => buckets.map((bucket) => bucket.count);

test("calculs : les mois, semaines et jours se terminent par la période en cours et ignorent les dates illisibles", () => {
  const months = stats.monthBuckets(["2026-11-03T10:00:00", "2026-10-30T10:00:00", "2026-05-10T10:00:00", null, undefined, "pas une date"], 6, NOW);
  assert.deepEqual(counts(months), [0, 0, 0, 0, 1, 1], "mai est hors de la fenêtre de six mois");
  assert.equal(months.at(-1).label, "nov");
  const weeks = stats.weekBuckets(["2026-11-16T09:00:00", "2026-11-22T20:00:00", "2026-11-10T09:00:00"], 3, NOW);
  assert.deepEqual(counts(weeks), [0, 1, 2], "la semaine va du lundi 16 au dimanche 22");
  const days = stats.dayBuckets(["2026-11-18T09:00:00", "2026-11-17T09:00:00", "2026-11-17T19:00:00"], 3, NOW);
  assert.deepEqual(counts(days), [0, 2, 1]);
  assert.deepEqual(days.map((day) => day.label), ["lun", "mar", "mer"]);
  assert.equal(stats.dayBuckets([], 30, NOW).length, 30);
  assert.equal(stats.total(days), 3);
});

test("calculs : comparaison, prochain rendez-vous et délai en toutes lettres", () => {
  assert.equal(stats.compareHint(5, 2), "+3 vs mois dernier");
  assert.equal(stats.compareHint(1, 3), "−2 vs mois dernier");
  assert.equal(stats.compareHint(2, 2), "Stable vs mois dernier");
  assert.equal(stats.daysUntil("2026-11-18T23:00:00", NOW), 0);
  assert.equal(stats.daysUntil("2026-11-19T08:00:00", NOW), 1);
  assert.equal(stats.daysUntil("n'importe quoi", NOW), null);
  assert.deepEqual(stats.whenParts(0), { value: "Aujourd’hui", wordy: true });
  assert.deepEqual(stats.whenParts(1), { value: "Demain", wordy: true });
  assert.deepEqual(stats.whenParts(4), { value: "4", unit: "jours", wordy: false });
  const next = stats.nextUpcoming([
    { id: "a", starts_at: "2026-11-17T09:00:00", status: "confirmed" },
    { id: "b", starts_at: "2026-11-25T09:00:00", status: "confirmed" },
    { id: "c", starts_at: "2026-11-20T09:00:00", status: "cancelled" },
    { id: "d", starts_at: "2026-11-21T09:00:00", status: "completed" },
    { id: "e", starts_at: "2026-11-23T09:00:00", status: "confirmed" },
  ], NOW);
  assert.equal(next.id, "e", "ni passé, ni annulé, ni terminé : le plus proche");
  assert.equal(stats.nextUpcoming([], NOW), null);
  assert.deepEqual(stats.tally(["analysis", "imaging", "analysis"], (kind) => kind), { analysis: 2, imaging: 1 });
});

test("une seule carte KPI et une seule grille pour les quatre espaces", () => {
  const shared = read("src/components/dashboard/SpaceKpis.tsx");
  assert.match(shared, /export function KpiStat\(/);
  assert.match(shared, /className=\{`edash-card edash-stat\$\{featured \? " edash-stat--featured" : ""\}`\}|const className = `edash-card edash-stat\$\{featured/);
  assert.match(shared, /import "\.\.\/establishment-dashboard\.css";/);
  assert.match(shared, /<section className="edash space-kpis"[^>]*><div className="edash__grid">/);
  const establishment = read("src/components/EstablishmentDashboard.tsx");
  assert.doesNotMatch(establishment, /function Stat\(/, "l'établissement n'a plus sa propre carte");
  assert.equal((establishment.match(/<KpiStat /g) ?? []).length, 4);
  for (const file of ["PatientKpis", "ProfessionalKpis", "LaboratoryHome"]) {
    const source = read(`src/components/${file}.tsx`);
    assert.equal((source.match(/<KpiStat /g) ?? []).length >= 4, true, `${file} : quatre cartes`);
    assert.match(source, /<KpiSection label=/);
    assert.equal((source.match(/<ChartCard /g) ?? []).length >= 2 || (source.match(/<ChartCard\s/g) ?? []).length >= 2, true, `${file} : deux graphiques`);
    assert.match(source, /featured/, `${file} : la première carte est en vert foncé`);
  }
});

test("les graphiques sont en Recharts, chargés à la demande, avec un résumé pour les lecteurs d'écran et sans couleur en dur", () => {
  const charts = read("src/components/dashboard/DashboardCharts.tsx");
  assert.match(charts, /from "recharts"/);
  for (const name of ["BarsChart", "AreaCountChart", "DonutChart", "MeasurementLine"]) assert.match(charts, new RegExp(`export function ${name}\\(`), name);
  assert.equal((charts.match(/role="img" aria-label=/g) ?? []).length >= 4, true);
  assert.doesNotMatch(charts, /#[0-9a-fA-F]{3,8}\b/, "uniquement les variables du thème");
  const lazy = read("src/components/dashboard/charts-lazy.tsx");
  assert.match(lazy, /dynamic\(\(\) => import\("\.\/DashboardCharts"\)/);
  assert.match(lazy, /ssr: false/);
  for (const file of ["PatientKpis", "ProfessionalKpis", "LaboratoryHome"]) {
    const source = read(`src/components/${file}.tsx`);
    assert.doesNotMatch(source, /from "recharts"/, `${file} : la bibliothèque passe par charts-lazy`);
    assert.match(source, /dashboard\/charts-lazy/);
  }
  const css = read("src/components/dashboard/space-dashboard.css");
  assert.match(css, /grid-column: span 2/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css.replace(/color: #fff;/g, ""), /#[0-9a-fA-F]{3,8}\b/, "pas de couleur propre (hors le blanc sur vert foncé)");
});

test("accueil patient : les KPI viennent AVANT « Mise en route » (19/11/2026), sans nouvel appel dans PatientHome", () => {
  const home = read("src/components/PatientHome.tsx");
  const setup = home.indexOf("<SetupCard");
  const kpis = home.indexOf("<PatientKpis");
  const todo = home.indexOf('id="home-todo-title"');
  assert.ok(kpis > 0 && setup > kpis && todo > setup, "ordre : KPI, Mise en route, À faire");
  assert.equal((home.match(/apiGet</g) ?? []).length, 5, "PatientHome garde ses cinq appels");
  const source = read("src/components/PatientKpis.tsx");
  assert.match(source, /Promise\.allSettled/, "chaque source est indépendante");
  assert.doesNotMatch(source, /Promise\.all\(/);
  for (const label of ["Prochain rendez-vous", "Consultations · 12 mois", "Accès ouverts", "Carnet rempli", "Consultations par mois", "Mes mesures"]) assert.ok(source.includes(label), label);
  assert.match(source, /Valeurs enregistrées, sans interprétation/, "aucun seuil ni interprétation médicale");
});

test("accueil professionnel : les KPI remplacent le petit graphique du bas, seulement quand l'accès est ouvert", () => {
  const home = read("src/components/ProfessionalHome.tsx");
  assert.match(home, /\{ready && <ProfessionalKpis \/>\}/);
  assert.doesNotMatch(home, /ProfessionalDashboardChart|role-dashboard-grid/);
  assert.ok(home.indexOf("<ProfessionalToday") < home.indexOf("<ProfessionalKpis"), "après « Aujourd'hui »");
  const source = read("src/components/ProfessionalKpis.tsx");
  for (const label of ["Consultations ce mois", "Patients avec accès actif", "Demandes en attente", "Résultats attendus", "Consultations signées", "Mes accès"]) assert.ok(source.includes(label), label);
  assert.match(source, /label="Aujourd’hui"/, "carte de remplacement quand la fonction laboratoire n'est pas ouverte");
  assert.match(source, /Segmented/, "semaines / mois");
  assert.doesNotMatch(source, /patient_name|reason|diagnosis|symptoms/, "jamais le contenu d'un dossier");
});

test("laboratoire : un accueil avec KPI, le scanner passe sous /laboratoire/scanner et tout reste relié", () => {
  assert.equal(spaces.SPACES.laboratory.tabs[0].id, "home");
  assert.match(read("src/app/laboratoire/page.tsx"), /<LaboratoryHome \/>/);
  assert.match(read("src/app/laboratoire/scanner/page.tsx"), /<LaboratoryScanner \/>/);
  assert.ok(existsSync(new URL("../src/app/laboratoire/scanner/page.tsx", import.meta.url)));
  const home = read("src/components/LaboratoryHome.tsx");
  for (const label of ["Dépôts aujourd’hui", "Dépôts · 7 jours", "Remplacés · 30 jours", "Abandonnés · 30 jours", "Dépôts par jour", "Types d’examens"]) assert.ok(home.includes(label), label);
  assert.match(home, /href="\/laboratoire\/scanner"/, "gros bouton vers le scanner");
  assert.match(home, /isLabFeatureOff\(error\)/, "fonction éteinte : l'avis, pas un écran cassé");
  assert.doesNotMatch(home, /patient_initials|birth_year/, "aucune identité de patient sur l'accueil");
  assert.match(read("src/components/LaboratoryDeposits.tsx"), /href="\/laboratoire\/scanner"/);
  assert.doesNotMatch(read("src/lib/howto.ts").split("laboratory: [")[1], /href: "\/laboratoire",/, "les aides ne renvoient plus le scanner à l'accueil");
});
