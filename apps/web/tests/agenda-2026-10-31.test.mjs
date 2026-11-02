import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { addDays, appointmentsForDay, buildAgenda, consultationsForDay, dayLabel, dosesForDay, mondayIndex } from "../src/lib/agenda.ts";

const src = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const WEDNESDAY = new Date(2026, 9, 28); // mercredi 28 octobre 2026
const reminder = (extra = {}) => ({ id: "r1", name: "Vitamine D", dosage: "1 comprimé", times: ["08:00", "20:30"], days_of_week: [], starts_on: "2026-10-01", ends_on: null, active: true, ...extra });

test("le jour de la semaine suit le serveur : 0 = lundi", () => {
  assert.equal(mondayIndex(new Date(2026, 9, 26)), 0);
  assert.equal(mondayIndex(WEDNESDAY), 2);
  assert.equal(mondayIndex(new Date(2026, 9, 25)), 6);
});

test("les prises respectent les dates, l'état actif et les jours cochés", () => {
  assert.deepEqual(dosesForDay([reminder()], WEDNESDAY).map((e) => e.time), ["08:00", "20:30"]);
  assert.equal(dosesForDay([reminder({ days_of_week: [0] })], WEDNESDAY).length, 0);
  assert.equal(dosesForDay([reminder({ days_of_week: [2, 5] })], WEDNESDAY).length, 2);
  assert.equal(dosesForDay([reminder({ ends_on: "2026-10-27" })], WEDNESDAY).length, 0);
  assert.equal(dosesForDay([reminder({ starts_on: "2026-10-29" })], WEDNESDAY).length, 0);
  assert.equal(dosesForDay([reminder({ active: false })], WEDNESDAY).length, 0);
  assert.equal(dosesForDay([reminder({ times: ["pas une heure", "9:5"] })], WEDNESDAY).length, 1);
});

test("les rendez-vous annulés ou d'un autre jour n'apparaissent pas", () => {
  const rdv = (id, starts_at, status = "confirmed") => ({ id, reason: "Contrôle", starts_at, status, status_label: "Confirmé", establishment_name: "Clinique", professional_name: null });
  const entries = appointmentsForDay([rdv("a", new Date(2026, 9, 28, 14, 30).toISOString()), rdv("b", new Date(2026, 9, 28, 9, 0).toISOString(), "cancelled"), rdv("c", new Date(2026, 9, 29, 9, 0).toISOString())], WEDNESDAY);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].time, "14:30");
  assert.equal(entries[0].detail, "Clinique");
});

test("les consultations validées du jour servent l'agenda du professionnel", () => {
  const items = [{ id: "c1", reason: "Fièvre", facility_label: "Dispensaire", validated_at: new Date(2026, 9, 28, 10, 5).toISOString() }, { id: "c2", reason: "Autre jour", facility_label: "X", validated_at: new Date(2026, 9, 27, 10, 5).toISOString() }];
  assert.deepEqual(consultationsForDay(items, WEDNESDAY).map((e) => e.title), ["Fièvre"]);
});

test("l'agenda trie chaque jour par heure et sait remonter dans le passé", () => {
  const rdv = { id: "a", reason: "Contrôle", starts_at: new Date(2026, 9, 28, 14, 30).toISOString(), status: "confirmed", status_label: "Confirmé", establishment_name: null, professional_name: null };
  const [today, tomorrow] = buildAgenda({ reminders: [reminder()], appointments: [rdv] }, WEDNESDAY, 2);
  assert.deepEqual(today.entries.map((e) => e.time), ["08:00", "14:30", "20:30"]);
  assert.equal(tomorrow.entries.length, 2);
  const past = buildAgenda({}, WEDNESDAY, -3).map((day) => day.key);
  assert.deepEqual(past, ["2026-10-28", "2026-10-27", "2026-10-26"]);
});

test("les jours sont nommés comme à l'oral", () => {
  assert.equal(dayLabel(WEDNESDAY, WEDNESDAY), "Aujourd’hui");
  assert.equal(dayLabel(addDays(WEDNESDAY, 1), WEDNESDAY), "Demain");
  assert.equal(dayLabel(addDays(WEDNESDAY, -1), WEDNESDAY), "Hier");
  assert.match(dayLabel(addDays(WEDNESDAY, 4), WEDNESDAY), /dimanche 1.* novembre/i);
});

test("la fusion du 31/10 garde les écrans des maquettes : Aujourd'hui, agenda et sceau", () => {
  assert.match(src("components/PatientHome.tsx"), /<PatientToday \/>/);
  assert.match(src("components/ProfessionalHome.tsx"), /<ProfessionalToday \/>/);
  assert.match(src("app/patient/agenda/page.tsx"), /PatientAgenda/);
  assert.match(src("app/professionnel/agenda/page.tsx"), /<ClinicalGate>/);
  assert.match(src("components/PatientConsultations.tsx"), /<ConsultationSealPanel item=\{item\} \/>/);
  assert.match(src("components/ConsultationSealPanel.tsx"), /aria-expanded=\{open\}/);
});
