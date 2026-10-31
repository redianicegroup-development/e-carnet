import { redirect } from "next/navigation";

export const metadata = { title: "Accès — Mon E-Carnet", robots: { index: false, follow: false } };

/* Ancienne page « Partage » : le QR temporaire est l'étape 2 des consultations, les demandes et l'historique des accès sont dans l'Historique.
   Les anciens liens (notifications, favoris) arrivent donc directement sur la tuile des accès. */
export default function PatientAccessPage() {
  redirect("/patient/historique#acces");
}
