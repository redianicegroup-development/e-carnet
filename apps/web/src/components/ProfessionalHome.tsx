"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AvatarBadge, displayName, useSpaceAccount } from "./shell/SpaceShell";
import { useProfessionalProfile } from "./ClinicalGate";
import { Icon, type IconName } from "./ui/Icon";
import { listProfessionalConsultations, listProfessionalGrants } from "../application/professional-access-grants";
import { ProfessionalDashboardChart } from "./RoleDashboards";

type StepState = "done" | "current" | "todo";

export function ProfessionalHome() {
  const account = useSpaceAccount();
  const state = useProfessionalProfile();
  const profile = state.status === "ready" ? state.profile : null;
  const hasProfile = state.status === "ready";
  const memberships = profile?.memberships ?? [];
  const pending = memberships.some((item) => item.status === "pending");
  const attached = memberships.some((item) => item.status === "active");
  const ready = Boolean(profile?.clinical_access.allowed);
  const active = memberships.find((item) => item.establishment_id === profile?.active_establishment);
  const [activity, setActivity] = useState<{ grants: number; activeGrants: number; consultations: number } | null>(null);
  useEffect(() => { let mounted = true; Promise.all([listProfessionalGrants(), listProfessionalConsultations()]).then(([grants, consultations]) => { if (mounted) setActivity({ grants: grants.length, activeGrants: grants.filter((item) => item.status === "active").length, consultations: consultations.length }); }).catch(() => { if (mounted) setActivity({ grants: 0, activeGrants: 0, consultations: 0 }); }); return () => { mounted = false; }; }, []);

  const steps: { title: string; text: string; state: StepState }[] = [
    { title: "Profil professionnel", text: hasProfile ? `${profile?.specialty || "Spécialité à renseigner"} · déclarée, non certifiée par Mon E‑Carnet.` : "Déclarez votre profession et votre spécialité, sans numéro ni pièce justificative.", state: hasProfile ? "done" : "current" },
    { title: "Vérification interne", text: attached ? "L’établissement a confirmé votre rattachement. Sa vérification médicale relève de ses procédures internes." : pending ? "Votre établissement examine votre demande en interne." : "L’établissement vous remet un code après sa vérification interne.", state: attached ? "done" : pending ? "current" : "todo" },
    { title: "Établissement actif", text: ready ? "Vos accès cliniques sont ouverts dans ce périmètre." : "L’accès clinique dépend d’un rattachement actif et de l’autorisation du patient.", state: ready ? "done" : attached ? "current" : "todo" },
  ];

  const next = !hasProfile ? { href: "/professionnel/onboarding", label: "Compléter mon profil" } : !attached ? { href: "/professionnel/acces", label: pending ? "Voir ma demande" : "Saisir mon code" } : !ready ? { href: "/professionnel/acces", label: "Choisir mon établissement" } : null;
  const shortcuts: { href: string; icon: IconName; title: string; text: string; locked: boolean }[] = [
    { href: "/professionnel/patients", icon: "qr", title: "Scanner un QR / demander un accès", text: "Le patient reste maître de l’autorisation.", locked: !ready },
    { href: "/professionnel/consultations", icon: "stethoscope", title: "Consultations", text: "Pré-consultation du même établissement et consultation validée.", locked: !ready },
    { href: "/professionnel/acces", icon: "building", title: "Mon établissement", text: "Rattachement, code, établissement actif.", locked: false },
  ];

  return (
    <div className="stack-lg">
      {account && <div className="greeting"><AvatarBadge account={account} size={52} /><div className="greeting__text"><small>{profile?.professional_title ?? "Professionnel"}</small><h1>{displayName(account)}</h1></div></div>}
      {state.status === "loading" && <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /><i /></div>}
      {state.status === "error" && <p className="notice" role="alert">{state.message}</p>}
      {state.status !== "loading" && state.status !== "error" && (
        <section className={ready ? "card" : "card alert-card"} aria-live="polite">
          <span className="eyebrow">{ready ? "Prêt" : "Mise en route"}</span>
          <h2>{ready ? `Vous exercez à ${active?.establishment_name ?? "votre établissement"}` : "Quelques étapes avant d’ouvrir un carnet"}</h2>
          <ol className="checklist" aria-label="Étapes de mise en route">
            {steps.map((step, index) => <li key={step.title} className={`is-${step.state}`}><span className="checklist__mark" aria-hidden="true">{step.state === "done" ? <Icon name="check" size={16} /> : index + 1}</span><div><strong>{step.title}</strong><br /><span className={step.state === "todo" ? "muted" : ""}>{step.text}</span></div></li>)}
          </ol>
          {next && <div className="actions"><Link className="button primary" href={next.href}>{next.label}</Link></div>}
        </section>
      )}
      {hasProfile && !attached && <section className="card alert-card" aria-live="polite"><h2>Votre prochaine étape</h2><p>Rattachez-vous à un établissement pour activer les consultations et les demandes d’accès.</p><div className="actions"><Link className="button primary" href="/professionnel/acces">Gérer mon établissement</Link></div></section>}
      <section className="stack" aria-label="Raccourcis">
        {shortcuts.map((item) => <Link key={item.href} className={item.locked ? "list-row locked" : "list-row"} href={item.href} aria-disabled={item.locked || undefined}><span className="setting-item__icon"><Icon name={item.locked ? "lock" : item.icon} /></span><span className="list-row__body"><strong>{item.title}</strong><br /><span className="muted">{item.locked ? "Verrouillé tant que votre rattachement n’est pas confirmé." : item.text}</span></span><Icon name="chevron" size={18} /></Link>)}
      </section>
      {activity && <div className="role-dashboard-grid"><ProfessionalDashboardChart metrics={[{ label: "Demandes", value: activity.grants }, { label: "Accès actifs", value: activity.activeGrants }, { label: "Consultations", value: activity.consultations }]} /></div>}
    </div>
  );
}
