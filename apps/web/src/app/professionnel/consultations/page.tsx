import { ClinicalGate } from "../../../components/ClinicalGate";
import { ProfessionalConsultations } from "../../../components/ProfessionalConsultations";
import { ProfessionalVaccinations } from "../../../components/ProfessionalVaccinations";

export const metadata = { title: "Consultations — Mon E-Carnet", robots: { index: false, follow: false } };

export default function ProfessionalConsultationsPage() {
  return <ClinicalGate><><ProfessionalConsultations /><ProfessionalVaccinations /></></ClinicalGate>;
}
