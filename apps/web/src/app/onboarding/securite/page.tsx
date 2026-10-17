import Link from "next/link";
import { RecoverySetup } from "../../../components/RecoverySetup";

export const metadata = { title: "Sécuriser votre compte — Mon E-Carnet", robots: { index: false, follow: false } };

export default function RecoverySetupPage() {
  return (
    <main className="auth-shell">
      <Link className="button" href="/">← Accueil</Link>
      <RecoverySetup />
    </main>
  );
}
