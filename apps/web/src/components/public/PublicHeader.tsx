"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet } from "../../infrastructure/api/client";
import { BrandMark } from "../ui/BrandMark";

type AccountContext = { role: string; is_active: boolean };
type PublicAccount = { is_admin?: boolean; contexts: AccountContext[] };
type HeaderState = { status: "checking" | "anonymous" } | { status: "connected"; href: string };

const SPACE_BY_ROLE: Record<string, string> = {
  patient: "/patient",
  professional: "/professionnel",
  establishment: "/etablissement",
};

function workspaceFor(account: PublicAccount): string {
  if (account.is_admin) return "/admin";
  const context = account.contexts.find((item) => item.is_active && SPACE_BY_ROLE[item.role]);
  return context ? SPACE_BY_ROLE[context.role] : "/onboarding";
}

export function PublicHeader() {
  const [state, setState] = useState<HeaderState>({ status: "checking" });

  useEffect(() => {
    let active = true;
    apiGet<PublicAccount>("/api/v1/identity/me/", 5000)
      .then((account) => {
        if (active) setState({ status: "connected", href: workspaceFor(account) });
      })
      .catch(() => {
        if (active) setState({ status: "anonymous" });
      });
    return () => { active = false; };
  }, []);

  if (state.status === "connected") {
    return (
      <header className="pub-header pub-header--connected">
        <Link className="pub-return-link" href={state.href}>
          <span aria-hidden="true">←</span>
          Retour à mon espace
        </Link>
      </header>
    );
  }

  return (
    <header className="pub-header">
      <Link className="brand" href="/" aria-label="Mon Carnet Numérique, accueil">
        <BrandMark />
        <span className="brand-text"><strong>E-carnet</strong><small>Mon Carnet Numérique</small></span>
      </Link>
      <nav className="pub-nav" aria-label="Navigation principale">
        <Link href="/#parcours">Comment ça marche</Link>
        <Link href="/#profils">Pour qui</Link>
        <Link href="/securite">Sécurité</Link>
        <Link href="/aide">Aide</Link>
      </nav>
      <div className="pub-actions">
        <Link className="button ghost small" href="/connexion">Se connecter</Link>
        <Link className="button primary small" href="/connexion?mode=register">Créer mon carnet</Link>
      </div>
    </header>
  );
}
