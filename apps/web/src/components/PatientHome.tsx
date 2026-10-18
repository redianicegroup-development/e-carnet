"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet } from "../infrastructure/api/client";
import { AvatarBadge, displayName, useSpaceAccount } from "./shell/SpaceShell";
import { Icon, type IconName } from "./ui/Icon";
import { PatientDashboardChart } from "./RoleDashboards";

type Summary = { declarations: number; drafts: number; closed: number; consultations: number; pending: number; active: number; documents: number; vaccinations: number; appointments: number; unread: number };

async function loadSummary(): Promise<Summary> {
  const [declarations, encounters, consultations, grants, documents, vaccinations, appointments, notifications] = await Promise.all([
    apiGet<unknown[]>("/api/v1/patient/declarations/"),
    apiGet<{ status: string }[]>("/api/v1/patient/care/encounters/"),
    apiGet<unknown[]>("/api/v1/patient/care/consultations/"),
    apiGet<{ status: string }[]>("/api/v1/patient/care/access-grants/"),
    apiGet<unknown[]>("/api/v1/patient/care/documents/"),
    apiGet<unknown[]>("/api/v1/patient/care/vaccinations/"),
    apiGet<unknown[]>("/api/v1/patient/care/appointments/"),
    apiGet<{ read_at?: string | null }[]>("/api/v1/patient/care/notifications/"),
  ]);
  return {
    declarations: declarations.length,
    drafts: encounters.filter((item) => item.status === "draft").length,
    closed: encounters.filter((item) => item.status === "closed").length,
    consultations: consultations.length,
    pending: grants.filter((item) => item.status === "pending").length,
    active: grants.filter((item) => item.status === "active").length,
    documents: documents.length,
    vaccinations: vaccinations.length,
    appointments: appointments.length,
    unread: notifications.filter((item) => !item.read_at).length,
  };
}

const SHORTCUTS: { href: string; icon: IconName; title: string; text: string }[] = [
  { href: "/patient/carnet", icon: "folder", title: "Mon carnet", text: "Allergies, antécédents, traitements déclarés" },
  { href: "/patient/acces#qr", icon: "qr", title: "Mon QR d’accès", text: "Autoriser un professionnel en consultation" },
  { href: "/patient/consultations", icon: "stethoscope", title: "Mon historique", text: "Pré-consultations et consultations validées" },
];

export function PatientHome() {
  const account = useSpaceAccount();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadSummary().then((value) => { if (active) setSummary(value); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Impossible de charger votre carnet."); });
    return () => { active = false; };
  }, []);

  return (
    <div className="stack-lg">
      {account && (
        <div className="greeting">
          <AvatarBadge account={account} size={52} />
          <div className="greeting__text"><small>Bonjour</small><h1>{account.first_name || displayName(account)}</h1></div>
        </div>
      )}

      {account && !account.patient_profile.completed && (
        <section className="card alert-card">
          <h2>Terminez votre profil</h2>
          <p>Quelques informations (téléphone, naissance, couverture) rendent vos consultations plus simples à préparer.</p>
          <div className="actions"><Link className="button" href="/onboarding/patient">Compléter mon profil</Link></div>
        </section>
      )}

      {summary && summary.pending > 0 && (
        <section className="card alert-card" aria-live="polite">
          <h2>{summary.pending} demande{summary.pending > 1 ? "s" : ""} d’accès en attente</h2>
          <p>Un professionnel attend votre décision. Rien n’est partagé tant que vous n’avez pas accepté.</p>
          <div className="actions"><Link className="button" href="/patient/acces">Examiner la demande</Link></div>
        </section>
      )}

      {summary && summary.unread > 0 && <section className="card alert-card" aria-live="polite"><h2>{summary.unread} notification{summary.unread > 1 ? "s" : ""} à lire</h2><p>Une action concernant votre carnet attend votre attention.</p><div className="actions"><Link className="button" href="/patient/carnet#notifications">Voir mes notifications</Link></div></section>}

      {summary && (summary.declarations === 0 || summary.documents === 0 || summary.vaccinations === 0) && <section className="card progress-card"><div className="section-heading"><div><span className="eyebrow">Mise en route</span><h2>Construire mon carnet essentiel</h2></div></div><p className="muted">Commencez par les informations utiles au quotidien. Vous pourrez modifier chaque élément plus tard.</p><div className="progress-card__line" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={[summary.declarations > 0, summary.documents > 0, summary.vaccinations > 0].filter(Boolean).length}><span style={{ width: `${([summary.declarations > 0, summary.documents > 0, summary.vaccinations > 0].filter(Boolean).length / 3) * 100}%` }} /></div><div className="progress-card__meta"><span>{[summary.declarations > 0, summary.documents > 0, summary.vaccinations > 0].filter(Boolean).length}/3 rubriques commencées</span><Link className="text-link" href="/patient/carnet">Continuer</Link></div></section>}

      <section className="card cta-card">
        <span className="eyebrow">Avant votre rendez-vous</span>
        <h2>Préparez votre prochaine consultation</h2>
        <p className="muted">Décrivez votre motif et ce que vous ressentez. Le professionnel le lira uniquement si vous l’autorisez.</p>
        <div className="actions"><Link className="button" href="/patient/consultations#preparer"><Icon name="pencil" size={18} />Préparer ma consultation</Link></div>
      </section>

      {error && <p className="notice" role="alert">{error}</p>}
      {!summary && !error && <div className="skeleton" role="status"><span className="sr-only">Chargement de votre carnet…</span><i /></div>}
      {summary && (
        <section className="stat-grid" aria-label="Résumé de mon carnet">
          <Link className="stat-card card-link" href="/patient/carnet"><span className="val">{summary.declarations}</span><span className="lbl">Déclaration{summary.declarations > 1 ? "s" : ""}</span></Link>
          <Link className="stat-card card-link" href="/patient/consultations"><span className="val">{summary.drafts + summary.closed}</span><span className="lbl">Pré-consultation{summary.drafts + summary.closed > 1 ? "s" : ""}</span></Link>
          <Link className="stat-card card-link" href="/patient/consultations"><span className="val">{summary.consultations}</span><span className="lbl">Consultation{summary.consultations > 1 ? "s" : ""}</span></Link>
          <Link className="stat-card card-link" href="/patient/acces"><span className="val">{summary.active}</span><span className="lbl">Accès actif{summary.active > 1 ? "s" : ""}</span></Link>
        </section>
      )}

      {summary && <div className="role-dashboard-grid"><PatientDashboardChart metrics={[{ label: "Déclarations", value: summary.declarations }, { label: "Documents", value: summary.documents }, { label: "Vaccins", value: summary.vaccinations }, { label: "Visites", value: summary.consultations }]} /></div>}

      <section className="stack" aria-label="Raccourcis">
        {SHORTCUTS.map((item) => (
          <Link key={item.href} className="list-row" href={item.href}>
            <span className="setting-item__icon"><Icon name={item.icon} /></span>
            <span className="list-row__body"><strong>{item.title}</strong><br /><span className="muted">{item.text}</span></span>
            <Icon name="chevron" size={18} />
          </Link>
        ))}
      </section>
    </div>
  );
}
