import Link from "next/link";
import { RepresentationTransferRequest } from "../../../components/RepresentationTransferRequest";

export const metadata = { title: "Demander le transfert de mon dossier — Mon E-Carnet", robots: { index: false, follow: false } };

export default function PatientTransferPage() {
  return (
    <main className="auth-shell">
      <Link className="button" href="/patient/parametres">← Paramètres</Link>
      <RepresentationTransferRequest />
    </main>
  );
}
