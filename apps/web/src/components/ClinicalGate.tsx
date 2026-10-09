"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { apiGet } from "../infrastructure/api/client";
import { Icon } from "./ui/Icon";

export type Membership = { id: string; establishment_id: string; establishment_name: string; city: string; status: "pending" | "active" | "refused" | "suspended" | "terminated"; requested_at: string; reviewed_at: string | null };
export type ProfessionalProfile = {
  id: string; professional_title: string; specialty: string;
  active_establishment: string | null; mfa_active: boolean;
  memberships: Membership[]; clinical_access: { allowed: boolean; reason: string | null };
};

export function useProfessionalProfile() {
  const [state, setState] = useState<{ status: "loading" } | { status: "missing" } | { status: "error"; message: string } | { status: "ready"; profile: ProfessionalProfile; reload: () => void }>({ status: "loading" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let active = true;
    apiGet<ProfessionalProfile>("/api/v1/professionals/me/")
      .then((profile) => { if (active) setState({ status: "ready", profile, reload: () => setTick((value) => value + 1) }); })
      .catch((error: { status?: number; message?: string }) => { if (active) setState(error.status === 404 ? { status: "missing" } : { status: "error", message: error.message ?? "Profil indisponible." }); });
    return () => { active = false; };
  }, [tick]);
  return state;
}

/* Verrou fonctionnel : un rattachement actif et un établissement sélectionné sont requis avant les actions cliniques. */
export function ClinicalGate({ children }: { children: ReactNode }) {
  const state = useProfessionalProfile();
  if (state.status === "loading") return <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /><i /></div>;
  if (state.status === "error") return <p className="notice" role="alert">{state.message}</p>;
  if (state.status === "missing") {
    return <section className="card gate"><span className="gate__icon"><Icon name="idcard" size={26} /></span><h2>Complétez d’abord votre profil</h2><p className="muted">Votre profil professionnel n’est pas encore créé.</p><div className="actions"><Link className="button primary" href="/professionnel/onboarding">Compléter mon profil</Link></div></section>;
  }
  if (!state.profile.clinical_access.allowed) {
    return (
      <section className="card gate" aria-live="polite">
        <span className="gate__icon"><Icon name="lock" size={26} /></span>
        <h2>Accès cliniques verrouillés</h2>
        <p className="muted">{state.profile.clinical_access.reason ?? "Votre profil n’est pas encore autorisé."}</p>
        <p className="muted">Le scan du QR et les demandes d’accès s’ouvrent dès que votre rattachement à un établissement actif est confirmé.</p>
        <div className="actions"><Link className="button primary" href="/professionnel/acces">Voir mon rattachement</Link><Link className="button" href="/professionnel">Retour à l’accueil</Link></div>
      </section>
    );
  }
  return <>{children}</>;
}
