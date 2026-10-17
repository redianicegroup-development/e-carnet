import { PatientHome } from "../../components/PatientHome";

export const metadata = { title: "Accueil — Espace patient — Mon E-Carnet", robots: { index: false, follow: false } };

export default function PatientPage() {
  return <PatientHome />;
}
