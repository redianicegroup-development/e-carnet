/* Historique des accès du patient : logique pure (aucun React), testée dans tests/historique-acces-2026-11-08.test.mjs.
   Le journal brut est une longue liste d'événements ; ici on le range par professionnel, puis par « accès » (une session = une autorisation),
   avec une phrase claire par événement. Dans la fenêtre d'un professionnel son nom est déjà en titre : les phrases ne le répètent pas. */

export type Grant = {
  id: string;
  professional_name: string;
  professional_avatar?: string;
  professional_title?: string;
  establishment_logo?: string;
  facility_label: string;
  scope: string[];
  status: string;
  starts_at: string | null;
  expires_at: string | null;
  extension_count: number;
};

export type AccessEvent = {
  id: string;
  event_type: string;
  action: string;
  status: string | null;
  extension_count: number | null;
  resource_type?: string | null;
  resource_count?: number | null;
  access_duration_minutes?: number | null;
  authorized_until?: string | null;
  method?: string | null;
  access_grant_id?: string | null;
  professional_id?: string | null;
  professional_name: string;
  professional_avatar?: string;
  facility_label: string;
  created_at: string;
};

export type EventKind = "open" | "request" | "read" | "extend" | "refuse" | "revoke" | "end" | "expire" | "other";
export type EventTone = "ok" | "info" | "warn" | "danger" | "muted";
export type EventLine = { id: string; kind: EventKind; tone: EventTone; title: string; detail: string; at: string };

export type AccessSession = {
  id: string;
  grant: Grant | null;
  /** Statut de l'accès : celui de l'autorisation si elle est connue, sinon déduit du dernier événement. */
  status: string | null;
  startedAt: string;
  endedAt: string | null;
  /** Du plus ancien au plus récent : on lit l'histoire dans l'ordre où elle s'est passée. */
  lines: EventLine[];
  reads: number;
};

export type ProfessionalHistory = {
  key: string;
  professionalId: string | null;
  name: string;
  avatar: string;
  title: string;
  facility: string;
  logo: string;
  lastAt: string;
  lastLine: EventLine;
  sessions: AccessSession[];
  /** Nombre de fois où le professionnel a réellement lu des éléments (les ouvertures « à vide » ne comptent pas). */
  reads: number;
  activeGrant: Grant | null;
  pendingGrant: Grant | null;
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "En attente de votre décision",
  active: "Accès actif",
  refused: "Refusée",
  expired: "Expirée",
  revoked: "Révoquée",
};

export const SCOPE_LABELS: Record<string, string> = {
  preconsultation: "Pré-consultation",
  declarations: "Déclarations",
  consultations: "Consultations",
  care_history: "Historique d’autres établissements",
  documents: "Documents médicaux (lecture seule)",
};

const RESOURCE_NOUNS: Record<string, [string, string]> = {
  preconsultation: ["pré-consultation", "pré-consultations"],
  consultation: ["consultation", "consultations"],
  declaration: ["déclaration", "déclarations"],
  document: ["document", "documents"],
  health_measurement: ["mesure de santé", "mesures de santé"],
};

const dateParts = (value: string) => new Date(value);
const isValid = (date: Date) => !Number.isNaN(date.getTime());

export function formatClock(value: string | null | undefined): string {
  if (!value) return "";
  const date = dateParts(value);
  return isValid(date) ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date) : "";
}

export function formatDay(value: string | null | undefined): string {
  if (!value) return "";
  const date = dateParts(value);
  return isValid(date) ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(date) : "";
}

const sameDay = (left: Date, right: Date) => left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();

/** « Aujourd’hui, 14:32 », « Hier, 09:10 », sinon « 6 nov. 2026, 12:33 ». */
export function formatWhen(value: string | null | undefined, now: Date = new Date()): string {
  if (!value) return "";
  const date = dateParts(value);
  if (!isValid(date)) return "";
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const clock = formatClock(value);
  if (sameDay(date, now)) return `Aujourd’hui, ${clock}`;
  if (sameDay(date, yesterday)) return `Hier, ${clock}`;
  return `${formatDay(value)}, ${clock}`;
}

/** La phrase qui décrit un événement, du point de vue du patient. */
export function describeEvent(event: AccessEvent): EventLine {
  const base = { id: event.id, at: event.created_at };
  if (event.event_type === "clinical_data.read") {
    const count = typeof event.resource_count === "number" ? event.resource_count : null;
    const noun = RESOURCE_NOUNS[event.resource_type ?? ""];
    if (count === 0) return { ...base, kind: "read", tone: "muted", title: "A ouvert votre carnet", detail: "Aucun élément à lire pour le moment." };
    if (count === null) return { ...base, kind: "read", tone: "info", title: "A consulté des éléments de votre carnet", detail: "" };
    const label = noun ? noun[count === 1 ? 0 : 1] : count === 1 ? "élément de votre carnet" : "éléments de votre carnet";
    return { ...base, kind: "read", tone: "info", title: `A consulté ${count} ${label}`, detail: "Lecture seule : rien n’a été modifié." };
  }
  switch (event.action) {
    case "accept": {
      const until = formatClock(event.authorized_until);
      const hours = typeof event.access_duration_minutes === "number" ? event.access_duration_minutes / 60 : null;
      const validity = until ? `Valable ${hours ? `${hours} h, ` : ""}jusqu’à ${until}.` : hours ? `Valable ${hours} h.` : "";
      return { ...base, kind: "open", tone: "ok", title: event.method === "qr_scan" ? "Accès ouvert : votre QR a été scanné" : "Vous avez autorisé l’accès", detail: validity };
    }
    case "requested":
      return { ...base, kind: "request", tone: "warn", title: "Demande d’accès reçue", detail: "En attente de votre décision." };
    case "refuse":
      return { ...base, kind: "refuse", tone: "danger", title: "Vous avez refusé la demande", detail: "" };
    case "extend":
      return { ...base, kind: "extend", tone: "info", title: "Vous avez prolongé l’accès d’1 h", detail: typeof event.extension_count === "number" ? `Prolongation ${event.extension_count} sur 2.` : "" };
    case "revoke":
      return { ...base, kind: "revoke", tone: "danger", title: "Vous avez révoqué l’accès", detail: "Le professionnel n’a plus accès à votre carnet." };
    case "ended":
      return { ...base, kind: "end", tone: "muted", title: "Le professionnel a mis fin à son accès", detail: "" };
    case "expired":
      return { ...base, kind: "expire", tone: "muted", title: "L’accès a expiré", detail: "" };
    default:
      return { ...base, kind: "other", tone: "muted", title: "Événement lié à l’accès", detail: "" };
  }
}

const sessionStatusFromEvents = (events: AccessEvent[]): string | null => {
  // `events` est trié du plus récent au plus ancien : le premier statut renseigné est l'état actuel de l'accès.
  for (const event of events) if (event.status) return event.status;
  return null;
};

/** Range le journal par professionnel (le plus récemment actif en premier), puis par accès. `grants` apporte photo, fonction et statut courant. */
export function groupByProfessional(events: AccessEvent[], grants: Grant[]): ProfessionalHistory[] {
  const grantById = new Map(grants.map((grant) => [grant.id, grant]));
  const groups = new Map<string, AccessEvent[]>();
  for (const event of events) {
    const key = event.professional_id ?? `nom:${event.professional_name}`;
    const list = groups.get(key);
    if (list) list.push(event); else groups.set(key, [event]);
  }
  const result: ProfessionalHistory[] = [];
  for (const [key, groupEvents] of groups) {
    const newestFirst = [...groupEvents].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const bySession = new Map<string, AccessEvent[]>();
    for (const event of newestFirst) {
      const sessionKey = event.access_grant_id ?? "sans-acces";
      const list = bySession.get(sessionKey);
      if (list) list.push(event); else bySession.set(sessionKey, [event]);
    }
    const sessions: AccessSession[] = [];
    for (const [sessionId, sessionEventsNewestFirst] of bySession) {
      const grant = grantById.get(sessionId) ?? null;
      const chronological = [...sessionEventsNewestFirst].reverse();
      // Quand le QR ouvre l'accès tout de suite, « demande » + « accès ouvert » disent la même chose : on ne garde que le second.
      const openedByQr = chronological.some((event) => event.action === "accept" && event.method === "qr_scan");
      const shown = chronological.filter((event) => !(openedByQr && event.action === "requested"));
      const lines = shown.map(describeEvent);
      const last = sessionEventsNewestFirst[0];
      const ended = ["expired", "ended", "revoke", "refuse"].includes(last.action) ? last.created_at : null;
      sessions.push({
        id: sessionId,
        grant,
        status: grant?.status ?? sessionStatusFromEvents(sessionEventsNewestFirst),
        startedAt: chronological[0].created_at,
        endedAt: ended ?? grant?.expires_at ?? null,
        lines,
        reads: shown.filter((event) => event.event_type === "clinical_data.read" && (event.resource_count ?? 0) > 0).length,
      });
    }
    sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const newest = newestFirst[0];
    const grantsOfPro = sessions.map((session) => session.grant).filter((grant): grant is Grant => grant !== null);
    const sample = grantsOfPro[0];
    result.push({
      key,
      professionalId: newest.professional_id ?? null,
      name: newest.professional_name,
      avatar: sample?.professional_avatar || newest.professional_avatar || "",
      title: sample?.professional_title ?? "",
      facility: newest.facility_label,
      logo: sample?.establishment_logo ?? "",
      lastAt: newest.created_at,
      lastLine: describeEvent(newest),
      sessions,
      reads: sessions.reduce((total, session) => total + session.reads, 0),
      activeGrant: grantsOfPro.find((grant) => grant.status === "active") ?? null,
      pendingGrant: grantsOfPro.find((grant) => grant.status === "pending") ?? null,
    });
  }
  return result.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/** Autorisations à décider ou en cours (cartes complètes) ; le reste est du passé, présenté en lignes compactes. */
export function splitGrants(grants: Grant[]): { current: Grant[]; past: Grant[] } {
  const rank = (grant: Grant) => (grant.status === "pending" ? 0 : 1);
  const current = grants.filter((grant) => grant.status === "pending" || grant.status === "active").sort((a, b) => rank(a) - rank(b));
  const past = grants.filter((grant) => grant.status !== "pending" && grant.status !== "active");
  return { current, past };
}

/** Pendant l'accès : « Il reste 1 h 24 » (ou « moins d’une minute »). `null` si l'accès n'a pas d'échéance connue ou est déjà fini. */
export function timeLeft(expiresAt: string | null | undefined, now: Date = new Date()): string | null {
  if (!expiresAt) return null;
  const end = dateParts(expiresAt);
  if (!isValid(end)) return null;
  const minutes = Math.floor((end.getTime() - now.getTime()) / 60_000);
  if (minutes < 0) return null;
  if (minutes < 1) return "moins d’une minute";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}
