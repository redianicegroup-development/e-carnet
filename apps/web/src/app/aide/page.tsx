import type { Metadata } from "next";
import { HelpCenter } from "../../components/help/HelpCenter";
import { BackLink } from "../../components/public/BackLink";
import { PublicShell } from "../../components/public/PublicShell";

export const metadata: Metadata = {
  title: "Centre d’aide — Mon E-Carnet",
  description: "Guides pas à pas pour les patients, les professionnels et les établissements, réponses aux questions fréquentes, dépannage et contact.",
  alternates: { canonical: "/aide" },
  robots: { index: true, follow: true },
};

export default function HelpPage() {
  return (
    <PublicShell>
      <article className="hero-page help-page">
        <BackLink />
        <HelpCenter />
      </article>
    </PublicShell>
  );
}
