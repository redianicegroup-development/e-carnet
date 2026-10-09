import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "../../components/public/PublicShell";

export const metadata: Metadata = { title: "Sécurité — Mon Carnet Numérique", description: "Les principes de sécurité et les limites du pilote fictif de Mon Carnet Numérique.", robots: { index: true, follow: true } };

export default function SecurityPage() {
  return <PublicShell><article className="hero-page"><span className="eyebrow">Transparence</span><h1>La sécurité ne repose jamais sur l’interface seule.</h1><p className="lead">Chaque demande sensible est contrôlée côté serveur avec la session, le contexte, l’établissement, l’AccessGrant, le scope et l’expiration.</p><div className="stack"><section className="card"><h2>Ce qui est prévu</h2><ul><li>Sessions serveur et cookies protégés.</li><li>MFA TOTP professionnel prévu en V3, sans blocage du parcours V1.</li><li>Isolation entre établissements.</li><li>Audit append-only des transitions sensibles.</li><li>Aucun cache hors ligne de données médicales.</li></ul></section><section className="card"><h2>Ce qui n’est pas une promesse</h2><p className="muted">La V1 reste un pilote sur données fictives. L’hébergement ivoirien, la revue juridique, la restauration testée et les contrôles indépendants sont obligatoires avant toute donnée réelle.</p></section></div></article></PublicShell>;
}
