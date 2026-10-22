"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AvatarBadge, displayName, useSpaceAccount } from "./shell/SpaceShell";
import { useProfessionalProfile } from "./ClinicalGate";
import { Icon, type IconName } from "./ui/Icon";
import { listProfessionalConsultations, listProfessionalGrants } from "../application/professional-access-grants";
import { ProfessionalDashboardChart } from "./RoleDashboards";
import { ProfessionalDossier } from "./ProfessionalDossier";
import { SetupCard, type SetupStep } from "./SetupCard";

/* Accueil médecin, dans l'ordre où on en a besoin : bonjour · « Mise en route » (comme chez le patient : elle disparaît une fois tout configuré) ·
   dossier médecin (tout ce qui a été déclaré) · raccourcis · activité. Tant que le rattachement n'est pas validé, seul le rattachement est proposé. */
export function ProfessionalHome() {
  const account = useSpaceAccount();
  const state = useProfessionalProfile();
  const profile = state.status === "ready" ? state.profile : null;
  const hasProfile = state.status === "ready";
  const memberships = profile?.memberships ?? [];
  const pending = memberships.some((item) => item.status === "pending");
  const attached = memberships.some((item) => item.status === "active");
  const ready = Boolean(profile?.clinical_access.allowed);
  const [activity, setActivity] = useState<{ grants: number; activeGrants: number; consultations: number } | null>(null);
  useEffect(() => {
    if (!ready) return;
    let mounted = true;
    Promise.all([listProfessionalGrants(), listProfessionalConsultations()]).then(([grants, consultations]) => { if (mounted) setActivity({ grants: grants.length, activeGrants: grants.filter((item) => item.status === "active").length, consultations: consultations.length }); }).catch(() => { if (mounted) setActivity({ grants: 0, activeGrants: 0, consultations: 0 }); });
    return () => { mounted = false; };
  }, [ready]);

  const steps: SetupStep[] = [
    { key: "profile", title: "Profil professionnel", text: hasProfile ? `${profile?.specialty || "Spécialité à renseigner"} · déclarée, non certifiée par Mon E‑Carnet.` : "Déclarez votre profession et votre spécialité, sans numéro ni pièce justificative.", done: hasProfile, href: "/professionnel/onboarding" },
    { key: "attach", title: "Rattachement à un établissement", text: attached ? "L’établissement a confirmé votre rattachement." : pending ? "Votre établissement examine votre demande en interne." : "Saisissez le code remis par votre établissement après sa vérification interne.", done: attached, href: "/professionnel/acces" },
    { key: "active", title: "Établissement actif", text: ready ? "Vos accès cliniques sont ouverts." : "L’accès clinique s’ouvre avec un rattachement actif et l’autorisation du patient.", done: ready, href: "/professionnel/acces" },
  ];
  const actionLabel = !hasProfile ? "Compléter mon profil" : !attached ? (pending ? "Voir ma demande" : "Saisir mon code") : "Choisir mon établissement";

  const shortcuts: { href: string; icon: IconName; title: string; text: string; locked: boolean }[] = [
    { href: "/professionnel/patients", icon: "qr", title: "Scanner un QR / demander un accès", text: "Le patient reste maître de l’autorisation.", locked: !ready },
    { href: "/professionnel/consultations", icon: "stethoscope", title: "Consultations", text: "Pré-consultation du même établissement et consultation validée.", locked: !ready },
    { href: "/professionnel/acces", icon: "building", title: "Mon rattachement", text: "Code médecin, établissements, établissement actif.", locked: false },
  ];

  return (
    <div className="stack-lg">
      {account && <div className="greeting"><AvatarBadge account={account} size={52} /><div className="greeting__text"><small>{profile?.professional_title ?? "Professionnel"}</small><h1>{displayName(account)}</h1></div></div>}
      {state.status === "loading" && <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /><i /></div>}
      {state.status === "error" && <p className="notice" role="alert">{state.message}</p>}
      {state.status !== "loading" && state.status !== "error" && <SetupCard title="Quelques étapes avant d’ouvrir un carnet" steps={steps} actionLabel={actionLabel} />}
      {account && hasProfile && <ProfessionalDossier account={account} profile={profile} />}
      {state.status !== "loading" && <section className="stack" aria-label="Raccourcis">
        {shortcuts.filter((item) => !item.locked).map((item) => <Link key={item.href} className="list-row" href={item.href}><span className="setting-item__icon"><Icon name={item.icon} /></span><span className="list-row__body"><strong>{item.title}</strong><br /><span className="muted">{item.text}</span></span><Icon name="chevron" size={18} /></Link>)}
      </section>}
      {activity && ready && <div className="role-dashboard-grid"><ProfessionalDashboardChart metrics={[{ label: "Demandes", value: activity.grants }, { label: "Accès actifs", value: activity.activeGrants }, { label: "Consultations", value: activity.consultations }]} /></div>}
    </div>
  );
}
