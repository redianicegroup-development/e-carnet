import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { describeEvent, formatWhen, groupByProfessional, splitGrants, timeLeft } from "../src/components/access/access-history.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

const event = (overrides) => ({
  id: "e", event_type: "access_grant.accept", action: "accept", status: "active", extension_count: 0,
  professional_id: "p1", professional_name: "Dr Awa Kone", professional_avatar: "", facility_label: "Pisam2", access_grant_id: "g1",
  created_at: "2026-11-06T12:32:00Z", ...overrides,
});
const grant = (overrides) => ({
  id: "g1", professional_name: "Dr Awa Kone", professional_avatar: "https://img.example/awa.jpg", professional_title: "Médecin · Pédiatrie", establishment_logo: "",
  facility_label: "Pisam2", scope: ["preconsultation"], status: "expired", starts_at: "2026-11-06T12:32:00Z", expires_at: "2026-11-06T14:32:00Z", extension_count: 0, ...overrides,
});

test("chaque événement a une phrase claire, sans répéter le nom du professionnel", () => {
  assert.equal(describeEvent(event({ method: "qr_scan", authorized_until: "2026-11-06T14:32:00Z", access_duration_minutes: 120 })).title, "Accès ouvert : votre QR a été scanné");
  assert.match(describeEvent(event({ method: "qr_scan", access_duration_minutes: 120, authorized_until: "2026-11-06T14:32:00Z" })).detail, /^Valable 2 h, jusqu’à \d{2}:\d{2}\.$/);
  assert.equal(describeEvent(event({ action: "accept" })).title, "Vous avez autorisé l’accès");
  assert.equal(describeEvent(event({ action: "ended" })).title, "Le professionnel a mis fin à son accès");
  assert.equal(describeEvent(event({ action: "expired" })).title, "L’accès a expiré");
  assert.equal(describeEvent(event({ action: "extend", extension_count: 1 })).detail, "Prolongation 1 sur 2.");
  const read1 = describeEvent(event({ event_type: "clinical_data.read", action: "read", resource_type: "preconsultation", resource_count: 1 }));
  assert.equal(read1.title, "A consulté 1 pré-consultation");
  assert.equal(describeEvent(event({ event_type: "clinical_data.read", action: "read", resource_type: "declaration", resource_count: 3 })).title, "A consulté 3 déclarations");
  // « 0 élément » n'est plus affiché comme une lecture : le dossier a seulement été ouvert, sans les doubles points d'avant.
  const empty = describeEvent(event({ event_type: "clinical_data.read", action: "read", resource_type: "preconsultation", resource_count: 0 }));
  assert.equal(empty.title, "A ouvert votre carnet");
  for (const line of [read1, empty]) assert.doesNotMatch(`${line.title}${line.detail}`, /\.\.|Aka|Dr Awa/);
});

test("l'historique est rangé par professionnel, puis par accès, du plus récent au plus ancien", () => {
  const events = [
    event({ id: "7", event_type: "clinical_data.read", action: "read", status: null, resource_type: "preconsultation", resource_count: 1, created_at: "2026-11-06T13:00:00Z" }),
    event({ id: "8", event_type: "clinical_data.read", action: "read", status: null, resource_type: "preconsultation", resource_count: 0, created_at: "2026-11-06T12:40:00Z" }),
    event({ id: "9", action: "expired", status: "expired", created_at: "2026-11-06T14:32:00Z" }),
    event({ id: "1", action: "requested", status: "active", method: "qr_scan", created_at: "2026-11-06T12:32:00Z" }),
    event({ id: "2", action: "accept", method: "qr_scan", authorized_until: "2026-11-06T14:32:00Z", access_duration_minutes: 120, created_at: "2026-11-06T12:32:01Z" }),
    event({ id: "5", professional_id: "p2", professional_name: "Dr Moussa Traore", facility_label: "Clinique Nord", access_grant_id: "g2", action: "refuse", status: "refused", created_at: "2026-11-07T08:00:00Z" }),
  ];
  const groups = groupByProfessional(events, [grant(), grant({ id: "g2", professional_name: "Dr Moussa Traore", professional_avatar: "", status: "refused" })]);
  assert.deepEqual(groups.map((group) => group.name), ["Dr Moussa Traore", "Dr Awa Kone"], "le professionnel actif le plus récemment passe en premier");
  const awa = groups[1];
  assert.equal(awa.avatar, "https://img.example/awa.jpg");
  assert.equal(awa.title, "Médecin · Pédiatrie");
  assert.equal(awa.sessions.length, 1);
  assert.equal(awa.reads, 1, "seules les lectures qui ont réellement lu quelque chose comptent");
  // L'histoire se lit dans l'ordre : ouvert → ouvert (vide) → lu → expiré. La « demande » doublon du scan est masquée.
  assert.deepEqual(awa.sessions[0].lines.map((line) => line.kind), ["open", "read", "read", "expire"]);
  assert.equal(awa.sessions[0].status, "expired");
  assert.equal(awa.lastLine.title, "L’accès a expiré");
});

test("sans scan automatique, la demande reste visible dans l'histoire", () => {
  const groups = groupByProfessional([event({ id: "1", action: "requested", status: "pending", created_at: "2026-11-06T12:00:00Z" })], []);
  assert.deepEqual(groups[0].sessions[0].lines.map((line) => line.kind), ["request"]);
});

test("accès en cours ou à décider en cartes, accès terminés en lignes compactes", () => {
  const { current, past } = splitGrants([grant({ id: "a", status: "active" }), grant({ id: "b", status: "pending" }), grant({ id: "c", status: "refused" }), grant({ id: "d", status: "revoked" })]);
  assert.deepEqual(current.map((item) => item.id), ["b", "a"], "ce qui attend une décision passe en premier");
  assert.deepEqual(past.map((item) => item.id), ["c", "d"]);
});

test("le temps restant et les dates se lisent simplement", () => {
  const now = new Date("2026-11-06T13:00:00Z");
  assert.equal(timeLeft("2026-11-06T14:24:00Z", now), "1 h 24");
  assert.equal(timeLeft("2026-11-06T13:45:00Z", now), "45 min");
  assert.equal(timeLeft("2026-11-06T13:00:30Z", now), "moins d’une minute");
  assert.equal(timeLeft("2026-11-06T12:00:00Z", now), null);
  assert.equal(timeLeft(null, now), null);
  const local = new Date(2026, 10, 8, 15, 0);
  assert.match(formatWhen(new Date(2026, 10, 8, 9, 5).toISOString(), local), /^Aujourd’hui, /);
  assert.match(formatWhen(new Date(2026, 10, 7, 9, 5).toISOString(), local), /^Hier, /);
});

test("côté patient : photo du professionnel, cartes compactes, fenêtre de détail", () => {
  const grants = read("src/components/PatientAccessGrants.tsx");
  const ui = read("src/components/access/AccessHistory.tsx");
  assert.match(grants, /professional_avatar/);
  assert.match(grants, /<AccessWho name=\{item\.professional_name\} avatar=\{item\.professional_avatar\}/);
  assert.match(grants, /ProfessionalHistoryList/);
  assert.match(grants, /ProfessionalHistoryDialog/);
  assert.match(grants, /Accès terminés/);
  // L'ancienne liste plate d'événements ne revient pas.
  assert.doesNotMatch(grants, /events\.map\(\(event\)/);
  assert.match(ui, /PersonAvatar/);
  assert.match(ui, /EstablishmentLogo/);
  assert.match(ui, /createPortal/);
  assert.match(ui, /useDialogBehavior/);
  assert.match(ui, /role="dialog" aria-modal="true"/);
  assert.match(ui, /Voir tout l’historique de/);
  assert.match(read("src/components/access/access-history.css"), /access-timeline/);
});

test("temps réel : un accès ouvert par scan recharge les listes et fait disparaître le QR affiché", () => {
  const grants = read("src/components/PatientAccessGrants.tsx");
  assert.match(grants, /useNewNotifications\(\(\{ kinds \}\) => \{ if \(concernsAccess\(kinds\)\)/);
  assert.match(read("src/components/shell/SpaceShell.tsx"), /kinds\.includes\("access\.opened"\)\) setPatientAccessQr\(null\)/);
  const share = read("src/components/PatientShareQr.tsx");
  assert.match(share, /item\.kind === "access\.opened"/);
  assert.match(share, /Accès ouvert\./);
  assert.match(share, /Un seul professionnel peut être connecté à la fois/);
});

test("accueil patient : la carte « Réessayer » est retirée, l'écran se recharge au retour du réseau", () => {
  const home = read("src/components/PatientHome.tsx");
  assert.doesNotMatch(home, /card alert-card/);
  assert.doesNotMatch(home, />Réessayer<\/button><\/div><\/div>/);
  assert.match(home, /window\.addEventListener\("online", reloadWhenBack\)/);
});

test("côté professionnel : l'accès s'ouvre au scan, se termine à la demande, et les consultations montrent le patient", () => {
  const access = read("src/components/ProfessionalAccessGrants.tsx");
  assert.match(access, /Terminer l’accès/);
  assert.match(access, /tone: "danger"/);
  assert.match(read("src/application/professional-access-grants.ts"), /access-grants\/\$\{grantId\}\/end\//);
  const consultations = read("src/components/ProfessionalConsultations.tsx");
  assert.match(consultations, /<ConsultationCard [^>]*showPatient/);
  assert.match(read("src/components/consultation/ConsultationCard.tsx"), /<PersonAvatar src=\{item\.patient_avatar\} name=\{patientName\}/);
  // La recherche couvre aussi le nom du patient (PRO-16 : filtre partagé, insensible aux accents).
  assert.match(consultations, /matchesQuery\(\[item\.patient_name,/);
});
