"use client";

import Link from "next/link";
import { useId, useMemo } from "react";
import { AvatarBadge } from "./shell/SpaceShell";
import { Icon, type IconName } from "./ui/Icon";
import { splitFullName } from "../lib/join-codes";
import "./establishment-dashboard.css";

/* Tableau de bord de l'accueil établissement (PLAN : maquette « dashboard » — indicateurs, activité de la semaine, rappel, demandes,
   équipe, progression, codes). Tout est calculé sur des données administratives déjà chargées par EstablishmentConsole :
   rattachements, codes médecin, rendez-vous, ouvertures. Aucun dossier patient, aucune donnée médicale. Sans donnée, la carte le dit. */
export type DashboardMember = {
  id: string; status: string; professional_name?: string; professional_email?: string; professional_avatar_url?: string;
  professional_title?: string; professional_specialty?: string; requested_at?: string | null; reviewed_at?: string | null;
};
export type DashboardAppointment = { id: string; starts_at: string; ends_at: string | null; status: string };

const DAY = 86_400_000;
const WEEKDAYS = [["L", "lundi"], ["M", "mardi"], ["M", "mercredi"], ["J", "jeudi"], ["V", "vendredi"], ["S", "samedi"], ["D", "dimanche"]] as const;
const STATUS_TEXT: Record<string, string> = { active: "Actif", pending: "En attente", refused: "Refusé", suspended: "Suspendu" };

const time = (value?: string | null) => { const parsed = value ? Date.parse(value) : NaN; return Number.isFinite(parsed) ? parsed : null; };
const dateOnly = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const dateTime = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const hourOnly = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

function Avatar({ member, size }: { member: DashboardMember; size: number }) {
  return <AvatarBadge size={size} account={{ ...splitFullName(member.professional_name), email: member.professional_email ?? "", avatar_url: member.professional_avatar_url ?? "" }} />;
}

function Stat({ href, icon, label, value, hint, featured = false }: { href?: string; icon: IconName; label: string; value: number; hint: string; featured?: boolean }) {
  const body = <>
    <span className="edash-stat__top"><span className="edash-stat__label">{label}</span>{href && <span className="edash-stat__go" aria-hidden="true"><Icon name="arrowUp" size={16} style={{ transform: "rotate(45deg)" }} /></span>}</span>
    <span className="edash-stat__value">{value}</span>
    <span className="edash-stat__hint"><span className="edash-stat__chip" aria-hidden="true"><Icon name={icon} size={13} /></span>{hint}</span>
  </>;
  const className = `edash-card edash-stat${featured ? " edash-stat--featured" : ""}`;
  return href ? <Link className={`${className} is-link`} href={href}>{body}</Link> : <div className={className}>{body}</div>;
}

/* Jauge en demi-cercle : trois segments (confirmés, en attente, autres) sur un seul arc de longueur 100. */
function Gauge({ confirmed, pending, other }: { confirmed: number; pending: number; other: number }) {
  const hatchId = useId().replace(/:/g, "");
  const total = confirmed + pending + other;
  const share = (value: number) => (total ? (value / total) * 100 : 0);
  const a = share(confirmed); const b = share(pending); const c = share(other);
  const arc = "M 24 104 A 76 76 0 0 1 176 104";
  const segment = (length: number, start: number, stroke: string) => length > 0 ? <path d={arc} pathLength={100} fill="none" stroke={stroke} strokeWidth={28} strokeDasharray={`${length} 100`} strokeDashoffset={-start} /> : null;
  return (
    <svg className="edash-gauge" viewBox="0 0 200 116" aria-hidden="true" focusable="false">
      <defs><pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--edash-soft)" /><rect width="2" height="6" fill="var(--edash-hatch)" /></pattern></defs>
      <path d={arc} pathLength={100} fill="none" stroke="var(--edash-track)" strokeWidth={28} />
      {segment(a, 0, "var(--edash-dark)")}
      {segment(b, a, `url(#${hatchId})`)}
      {segment(c, a + b, "var(--edash-mid)")}
    </svg>
  );
}

export function EstablishmentDashboard({ establishmentName, memberships, activeJoinCodeCount, appointments, openingCount }: {
  establishmentName: string; memberships: DashboardMember[]; activeJoinCodeCount: number; appointments: DashboardAppointment[]; openingCount: number;
}) {
  const stats = useMemo(() => {
    const now = Date.now();
    const active = memberships.filter((item) => item.status === "active");
    const pending = memberships.filter((item) => item.status === "pending");
    const other = memberships.length - active.length - pending.length;
    const newThisMonth = active.filter((item) => { const t = time(item.reviewed_at); return t !== null && now - t <= 30 * DAY; }).length;
    const live = appointments.filter((item) => item.status !== "cancelled" && time(item.starts_at) !== null);
    const upcoming = live.filter((item) => (time(item.ends_at ?? item.starts_at) ?? 0) >= now).sort((x, y) => (time(x.starts_at) ?? 0) - (time(y.starts_at) ?? 0));

    // Semaine en cours (du lundi au dimanche), par jour de rendez-vous.
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const week = WEEKDAYS.map(([short, full], index) => {
      const start = new Date(monday); start.setDate(monday.getDate() + index);
      const end = new Date(start); end.setDate(start.getDate() + 1);
      const count = live.filter((item) => { const t = time(item.starts_at) ?? 0; return t >= start.getTime() && t < end.getTime(); }).length;
      return { short, full, count, today: start.getTime() === today.getTime() };
    });
    const peak = Math.max(1, ...week.map((day) => day.count));
    const weekTotal = week.reduce((sum, day) => sum + day.count, 0);

    const recent = [...memberships].sort((x, y) => (time(y.requested_at) ?? 0) - (time(x.requested_at) ?? 0));
    const requests = [...pending, ...recent.filter((item) => item.status !== "pending")].slice(0, 4);
    const confirmedShare = memberships.length ? Math.round((active.length / memberships.length) * 100) : 0;
    return { active, pending, other, newThisMonth, upcoming, week, peak, weekTotal, requests, confirmedShare };
  }, [memberships, appointments]);

  const next = stats.upcoming[0];
  const weekSummary = stats.week.map((day) => `${day.full} ${day.count}`).join(", ");

  return (
    <section className="edash" aria-label="Tableau de bord de l’établissement">
      <header className="edash__head">
        <div>
          <h2 className="edash__title">Tableau de bord</h2>
          <p className="muted">Suivez votre équipe, les demandes et l’activité de {establishmentName}. Vue administrative : aucun dossier patient.</p>
        </div>
        <div className="edash__actions">
          <Link className="button primary" href="/etablissement/medecins"><Icon name="plus" size={16} /> Ajouter un médecin</Link>
          <Link className="button" href="/etablissement/dossiers">Dossiers patients</Link>
        </div>
      </header>

      <div className="edash__grid">
        <Stat featured href="/etablissement/medecins" icon="users" label="Médecins actifs" value={stats.active.length} hint={stats.newThisMonth ? `+${stats.newThisMonth} ces 30 derniers jours` : "Équipe rattachée"} />
        <Stat href="/etablissement/demandes" icon="document" label="Demandes à traiter" value={stats.pending.length} hint={stats.pending.length ? "En attente de votre réponse" : "Aucune en attente"} />
        <Stat icon="clock" label="Rendez-vous à venir" value={stats.upcoming.length} hint={`${stats.weekTotal} cette semaine`} />
        <Stat href="/etablissement/medecins" icon="qr" label="Codes médecin actifs" value={activeJoinCodeCount} hint="Non utilisés · valables 48 h" />

        <article className="edash-card edash-week" aria-labelledby="edash-week-title">
          <h3 id="edash-week-title" className="edash-card__title">Rendez-vous de la semaine</h3>
          <div className="edash-week__bars" role="img" aria-label={`Rendez-vous de la semaine en cours : ${weekSummary}`}>
            {stats.week.map((day, index) => {
              const height = day.count > 0 ? 40 + (60 * day.count) / stats.peak : 36;
              return <div className="edash-week__col" key={index} title={`${day.full} : ${day.count}`}>
                <span className="edash-week__count" aria-hidden="true">{day.count > 0 || day.today ? day.count : ""}</span>
                <span className={`edash-week__bar${day.count > 0 ? " has-data" : ""}${day.today ? " is-today" : ""}`} style={{ height: `${height}%` }} aria-hidden="true" />
                <span className={`edash-week__day${day.today ? " is-today" : ""}`} aria-hidden="true">{day.short}</span>
              </div>;
            })}
          </div>
          {stats.weekTotal === 0 && <p className="edash-card__note">Aucun rendez-vous cette semaine.</p>}
        </article>

        <article className="edash-card edash-reminder" aria-labelledby="edash-reminder-title">
          <h3 id="edash-reminder-title" className="edash-card__title">À faire</h3>
          {stats.pending.length > 0 ? <>
            <p className="edash-reminder__headline">{stats.pending.length} demande{stats.pending.length > 1 ? "s" : ""} de rattachement</p>
            <p className="edash-reminder__text">{stats.pending.length > 1 ? "Des médecins attendent" : "Un médecin attend"} votre confirmation.</p>
            <Link className="edash-cta" href="/etablissement/demandes"><Icon name="check" size={18} /> Traiter les demandes</Link>
          </> : next ? <>
            <p className="edash-reminder__headline">Prochain rendez-vous</p>
            <p className="edash-reminder__text">{dateTime.format(new Date(next.starts_at))}{next.ends_at ? ` – ${hourOnly.format(new Date(next.ends_at))}` : ""}</p>
            <Link className="edash-cta" href="/etablissement/medecins"><Icon name="users" size={18} /> Voir l’équipe</Link>
          </> : <>
            <p className="edash-reminder__headline">Tout est à jour</p>
            <p className="edash-reminder__text">Aucune demande en attente et aucun rendez-vous à venir.</p>
            <Link className="edash-cta" href="/etablissement/medecins"><Icon name="qr" size={18} /> Créer un code médecin</Link>
          </>}
        </article>

        <article className="edash-card edash-requests" aria-labelledby="edash-requests-title">
          <div className="edash-card__bar"><h3 id="edash-requests-title" className="edash-card__title">Demandes récentes</h3><Link className="edash-pill" href="/etablissement/demandes"><Icon name="plus" size={13} /> Voir</Link></div>
          {stats.requests.length === 0 ? <p className="edash-card__note">Les demandes des médecins apparaîtront ici.</p> : <ul className="edash-list">
            {stats.requests.map((item) => <li key={item.id}>
              <Avatar member={item} size={34} />
              <span className="edash-list__main"><strong>{item.professional_name || "Médecin"}</strong><small>{time(item.requested_at) !== null ? `Demande du ${dateOnly.format(new Date(item.requested_at as string))}` : "Date non renseignée"}</small></span>
              <span className={`edash-badge edash-badge--${item.status}`}>{STATUS_TEXT[item.status] ?? item.status}</span>
            </li>)}
          </ul>}
        </article>

        <article className="edash-card edash-team" aria-labelledby="edash-team-title">
          <div className="edash-card__bar"><h3 id="edash-team-title" className="edash-card__title">Équipe</h3><Link className="edash-pill" href="/etablissement/medecins"><Icon name="plus" size={13} /> Ajouter un médecin</Link></div>
          {stats.active.length === 0 ? <p className="edash-card__note">Aucun médecin rattaché pour le moment. Créez un code et remettez-le à vos médecins.</p> : <ul className="edash-list">
            {stats.active.slice(0, 4).map((item) => <li key={item.id}>
              <Avatar member={item} size={38} />
              <span className="edash-list__main"><strong>{item.professional_name || "Médecin"}</strong><small>{[item.professional_title, item.professional_specialty].filter(Boolean).join(" · ") || "Spécialité non renseignée"}</small></span>
              <span className="edash-badge edash-badge--active">Actif</span>
            </li>)}
          </ul>}
          {stats.active.length > 4 && <Link className="edash-more" href="/etablissement/medecins">Voir les {stats.active.length} médecins →</Link>}
        </article>

        <article className="edash-card edash-progress" aria-labelledby="edash-progress-title">
          <h3 id="edash-progress-title" className="edash-card__title">Progression des rattachements</h3>
          <div className="edash-progress__plot">
            <Gauge confirmed={stats.active.length} pending={stats.pending.length} other={stats.other} />
            <div className="edash-progress__center"><strong>{memberships.length ? `${stats.confirmedShare} %` : "—"}</strong><span>confirmés</span></div>
          </div>
          <ul className="edash-legend" aria-label="Légende des rattachements">
            <li><span className="edash-dot edash-dot--dark" aria-hidden="true" />Confirmés<strong>{stats.active.length}</strong></li>
            <li><span className="edash-dot edash-dot--hatch" aria-hidden="true" />En attente<strong>{stats.pending.length}</strong></li>
            <li><span className="edash-dot edash-dot--mid" aria-hidden="true" />Refusés ou suspendus<strong>{stats.other}</strong></li>
          </ul>
        </article>

        <article className="edash-card edash-codes" aria-labelledby="edash-codes-title">
          <h3 id="edash-codes-title" className="edash-codes__title">Codes médecin</h3>
          <p className="edash-codes__value" aria-label={`${activeJoinCodeCount} code${activeJoinCodeCount > 1 ? "s" : ""} actif${activeJoinCodeCount > 1 ? "s" : ""}`}>{activeJoinCodeCount}</p>
          <p className="edash-codes__text">actif{activeJoinCodeCount > 1 ? "s" : ""}, valable{activeJoinCodeCount > 1 ? "s" : ""} 48 h · {openingCount} ouverture{openingCount > 1 ? "s" : ""} de dossier récente{openingCount > 1 ? "s" : ""}</p>
          <Link className="edash-codes__cta" href="/etablissement/medecins"><Icon name="qr" size={18} /> Gérer les codes</Link>
        </article>
      </div>
    </section>
  );
}
