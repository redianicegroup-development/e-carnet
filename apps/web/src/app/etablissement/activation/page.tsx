import { Suspense } from "react";
import { EstablishmentInvitationActivation } from "../../../components/EstablishmentInvitationActivation";

export const metadata = { title: "Activation de l’accès établissement — Mon Carnet Numérique", robots: { index: false, follow: false } };

export default function EstablishmentActivationPage() {
  return <Suspense fallback={<main className="auth-shell"><p className="notice">Chargement de l’invitation…</p></main>}><EstablishmentInvitationActivation /></Suspense>;
}
