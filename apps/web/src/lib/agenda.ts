/* Agenda : « Aujourd'hui » et vues par jour, du patient (prises de médicaments, rendez-vous) et du professionnel (consultations validées).
   Logique pure, sans réseau : les composants chargent les données et appellent ces fonctions. Toutes les dates sont lues en heure locale. */

export type ReminderLike = { id: string; name: string; dosage: string; times: string[]; days_of_week?: number[]; starts_on: string; ends_on: string | null; active: boolean };
export type AppointmentLike = { id: string; reason: string; starts_at: string; status: string; status_label: string; establishment_name: string | null; professional_name: string | null };
export type ConsultationLike = { id: string; reason: string; facility_label: string; validated_at: string };
export type AgendaKind = "dose" | "appointment" | "consultation";
export type AgendaEntry = { key: string; kind: AgendaKind; time: string; title: string; detail: string; badge?: string; at: number };
export type AgendaDay = { key: string; date: Date; entries: AgendaEntry[] };

const pad = (value: number) => String(value).padStart(2, "0");
export const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
/** 0 = lundi … 6 = dimanche, comme `days_of_week` côté serveur (JavaScript compte depuis dimanche). */
export const mondayIndex = (date: Date) => (date.getDay() + 6) % 7;
export const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
export const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const clock = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** Prises prévues ce jour-là : rappel actif, dans ses dates, et le jour de la semaine coché (aucun coché = tous les jours). */
export function dosesForDay(reminders: ReminderLike[], day: Date): AgendaEntry[] {
  const key = dateKey(day);
  const weekday = mondayIndex(day);
  const entries: AgendaEntry[] = [];
  for (const reminder of reminders) {
    if (!reminder.active || reminder.starts_on > key || (reminder.ends_on && reminder.ends_on < key)) continue;
    if (reminder.days_of_week?.length && !reminder.days_of_week.includes(weekday)) continue;
    for (const time of reminder.times) {
      const [hours, minutes] = time.split(":").map(Number);
      if (!Number.isInteger(hours) || !Number.isInteger(minutes)) continue;
      entries.push({ key: `dose-${reminder.id}-${key}-${time}`, kind: "dose", time: `${pad(hours)}:${pad(minutes)}`, title: reminder.name, detail: reminder.dosage, at: new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes).getTime() });
    }
  }
  return entries;
}

/** Rendez-vous de ce jour, hors rendez-vous annulés. */
export function appointmentsForDay(appointments: AppointmentLike[], day: Date): AgendaEntry[] {
  const key = dateKey(day);
  return appointments.flatMap((appointment) => {
    const start = new Date(appointment.starts_at);
    if (appointment.status === "cancelled" || Number.isNaN(start.getTime()) || dateKey(start) !== key) return [];
    return [{ key: `rdv-${appointment.id}`, kind: "appointment" as const, time: clock(start), title: appointment.reason || "Rendez-vous", detail: [appointment.professional_name, appointment.establishment_name].filter(Boolean).join(" · "), badge: appointment.status_label, at: start.getTime() }];
  });
}

/** Consultations validées ce jour-là (côté professionnel). */
export function consultationsForDay(consultations: ConsultationLike[], day: Date): AgendaEntry[] {
  const key = dateKey(day);
  return consultations.flatMap((consultation) => {
    const at = new Date(consultation.validated_at);
    if (Number.isNaN(at.getTime()) || dateKey(at) !== key) return [];
    return [{ key: `consultation-${consultation.id}`, kind: "consultation" as const, time: clock(at), title: consultation.reason || "Consultation", detail: consultation.facility_label, badge: "Validée", at: at.getTime() }];
  });
}

export type AgendaSources = { reminders?: ReminderLike[]; appointments?: AppointmentLike[]; consultations?: ConsultationLike[] };

/** `days` jours à partir de `from` (négatif : vers le passé), chaque jour trié par heure. */
export function buildAgenda(sources: AgendaSources, from: Date, days: number): AgendaDay[] {
  const step = days < 0 ? -1 : 1;
  return Array.from({ length: Math.abs(days) }, (_, index) => {
    const date = addDays(startOfDay(from), index * step);
    const entries = [...dosesForDay(sources.reminders ?? [], date), ...appointmentsForDay(sources.appointments ?? [], date), ...consultationsForDay(sources.consultations ?? [], date)].sort((a, b) => a.at - b.at);
    return { key: dateKey(date), date, entries };
  });
}

const LONG_DAY = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
export function dayLabel(date: Date, today: Date): string {
  const gap = Math.round((startOfDay(date).getTime() - startOfDay(today).getTime()) / 86_400_000);
  if (gap === 0) return "Aujourd’hui";
  if (gap === 1) return "Demain";
  if (gap === -1) return "Hier";
  return LONG_DAY.format(date);
}
