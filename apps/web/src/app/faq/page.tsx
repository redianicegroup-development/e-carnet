import type { Metadata } from "next";
import { HelpCenter } from "../../components/help/HelpCenter";
import { BackLink } from "../../components/public/BackLink";
import { PublicShell } from "../../components/public/PublicShell";

export const metadata: Metadata = {
  title: "Aide et questions fréquentes — Mon Carnet Numérique",
  description: "Pas à pas pour les patients, les professionnels et les établissements, réponses aux questions fréquentes et aide en cas de problème.",
  robots: { index: true, follow: true },
};

export default function FaqPage() {
  return (
    <PublicShell>
      <article className="hero-page">
        <BackLink />
        <HelpCenter />
      </article>
    </PublicShell>
  );
}
