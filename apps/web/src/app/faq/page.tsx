import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "../../components/public/PublicShell";

export const metadata: Metadata = { title: "FAQ — Mon Carnet Numérique", description: "Réponses aux questions fréquentes sur le contrôle patient et les accès professionnels.", robots: { index: true, follow: true } };

const questions = [["Un professionnel voit-il mon carnet automatiquement ?", "Non. Il doit être vérifié, être rattaché à un établissement actif et recevoir votre autorisation temporaire. Le MFA TOTP est reporté en V3."], ["Combien de temps dure une autorisation ?", "La durée active prévue est de deux heures, avec au maximum deux prolongations d’une heure. Vous pouvez révoquer à tout moment."], ["Un infirmier possède-t-il un compte ?", "Non. La V1 ne crée aucun compte, rôle, écran ou endpoint infirmier. Une aide éventuelle se fait dans le compte du patient."], ["Les données sont-elles disponibles hors connexion ?", "Les pages publiques peuvent offrir un repli limité. Aucune donnée médicale ni réponse d’API n’est mise en cache hors ligne." ]];

export default function FaqPage() {
  return <PublicShell><article className="hero-page"><span className="eyebrow">Réponses directes</span><h1>Les questions importantes, sans jargon.</h1><div className="stack">{questions.map(([question, answer]) => <details className="card" key={question}><summary><strong>{question}</strong></summary><p className="muted">{answer}</p></details>)}</div></article></PublicShell>;
}
