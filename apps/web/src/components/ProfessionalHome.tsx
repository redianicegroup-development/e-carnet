"use client";

import { useEffect, useState } from "react";
import { AvatarBadge, displayName, useSpaceAccount } from "./shell/SpaceShell";
import { useProfessionalProfile } from "./ClinicalGate";
import { type IconName } from "./ui/Icon";
import { TileGrid } from "./ui/TileGrid";
import { listProfessionalConsultations, listProfessionalGrants } from "../application/professional-access-grants";
import { ProfessionalDashboardChart } from "./RoleDashboards";
import { ProfessionalDossier } from "./ProfessionalDossier";
import { VirtualCardPanel } from "./emergency-card/VirtualCardPanel";
import { useEmergencyCard } from "./emergency-card/useEmergencyCard";
import type { ProfessionalProfile } from "./ClinicalGate";
import type { SpaceAccount } from "./shell/SpaceShell";
import { SetupCard, type SetupStep } from "./SetupCard";
import { CollapsibleSection } from "./ui/CollapsibleSection";

/* Carte virtuelle du médecin : son identité de patient et son métier déclaré, même carte et même image PNG que dans l'espace patient. */
function ProfessionalVirtualCard({ account, profile }: { account: SpaceAccount; profile: ProfessionalProfile }) {
  const { card, loading, error } = useEmergencyCard();
  const profession = { title: profile.professional_title, specialty: profile.specialty || undefined };
  return <div className="section-grid"><CollapsibleSection title="Ma carte virtuelle" icon="idcard" hint="Carte et QR"><VirtualCardPanel account={account} card={card} profession={profession} loading={loading} error={error} /></CollapsibleSection></div>;
}

/* Accueil médecin, dans l'ordre où on en a besoin : bonjour · « Mise en route » (comme chez le patient : elle disparaît une fois tout configuré) ·
   dossier médecin (tout ce qui a été déclaré) · carte virtuelle · raccourcis · activité. Tant que le rattachement n'est pas validé, seul le rattachement est proposé. */
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
    { key: "attach", title: "Rattachement à un établissement", text: attached ? "L’établissement a confirmé votre rattachement." : pending ? "Votre établissement examine votre demande." : "Saisissez le code remis par votre établissement.", done: attached, href: "/professionnel/acces" },
    { key: "active", title: "Établissement actif", text: ready ? "Vos accès cliniques sont ouverts." : "Il faut un rattachement actif et l’accord du patient.", done: ready, href: "/professionnel/acces" },
  ];
  const actionLabel = !hasProfile ? "Compléter mon profil" : !attached ? (pending ? "Voir ma demande" : "Saisir mon code") : "Choisir mon établissement";

  const shortcuts: { href: string; icon: IconName; title: string; text: string; locked: boolean }[] = [
    { href: "/professionnel/patients", icon: "qr", title: "Scanner un QR / demander un accès", text: "Le patient reste maître de l’autorisation.", locked: !ready },
    { href: "/professionnel/consultations", icon: "stethoscope", title: "Consultations", text: "Pré-consultations et consultations validées.", locked: !ready },
    { href: "/professionnel/acces", icon: "building", title: "Mon rattachement", text: "Code médecin, établissements, établissement actif.", locked: false },
  ];

  return (
    <div className="stack-lg">
      {account && <div className="greeting"><AvatarBadge account={account} size={52} /><div className="greeting__text"><small>{profile?.professional_title ?? "Professionnel"}</small><h1>{displayName(account)}</h1></div></div>}
      {state.status === "loading" && <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /><i /></div>}
      {state.status === "error" && <p className="notice" role="alert">{state.message}</p>}
      {state.status !== "loading" && state.status !== "error" && <SetupCard title="Quelques étapes avant d’ouvrir un carnet" steps={steps} actionLabel={actionLabel} />}
      {account && hasProfile && <ProfessionalDossier account={account} profile={profile} />}
      {account && profile && <ProfessionalVirtualCard account={account} profile={profile} />}
      {state.status !== "loading" && <TileGrid label="Raccourcis" items={shortcuts.filter((item) => !item.locked)} />}
      {activity && ready && <div className="role-dashboard-grid"><ProfessionalDashboardChart metrics={[{ label: "Demandes", value: activity.grants }, { label: "Accès actifs", value: activity.activeGrants }, { label: "Consultations", value: activity.consultations }]} /></div>}
    </div>
  );
}
