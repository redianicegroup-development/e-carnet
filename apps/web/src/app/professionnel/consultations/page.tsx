import { ClinicalGate } from "../../../components/ClinicalGate";
import { ProfessionalConsultations } from "../../../components/ProfessionalConsultations";

export const metadata = { title: "Consultations — Mon Carnet Numérique", robots: { index: false, follow: false } };

export default function ProfessionalConsultationsPage() {
  return <ClinicalGate><ProfessionalConsultations /></ClinicalGate>;
}
