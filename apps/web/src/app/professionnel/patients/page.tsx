import { ClinicalGate } from "../../../components/ClinicalGate";
import { ProfessionalAccessGrants } from "../../../components/ProfessionalAccessGrants";

export const metadata = { title: "Patients — Mon E-Carnet", robots: { index: false, follow: false } };

export default function ProfessionalPatientsPage() {
  return <ClinicalGate><ProfessionalAccessGrants /></ClinicalGate>;
}
