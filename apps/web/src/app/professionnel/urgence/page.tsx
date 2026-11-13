import { ClinicalGate } from "../../../components/ClinicalGate";
import { ProfessionalEmergencyAccess } from "../../../components/ProfessionalEmergencyAccess";

export const metadata = { title: "Accès d’urgence — Mon E-Carnet", robots: { index: false, follow: false } };

export default function ProfessionalEmergencyAccessPage() {
  return <ClinicalGate><ProfessionalEmergencyAccess /></ClinicalGate>;
}
