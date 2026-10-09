import { ClinicalGate } from "../../../components/ClinicalGate";
import { ProfessionalAccessGrants } from "../../../components/ProfessionalAccessGrants";

export const metadata = { title: "Patients — Mon Carnet Numérique", robots: { index: false, follow: false } };

export default function ProfessionalPatientsPage() {
  return <ClinicalGate><ProfessionalAccessGrants /></ClinicalGate>;
}
