import { ClinicalGate } from "../../../components/ClinicalGate";
import { ProfessionalConsultations } from "../../../components/ProfessionalConsultations";
import { ProfessionalVaccinations } from "../../../components/ProfessionalVaccinations";
import { CollapsibleSection } from "../../../components/ui/CollapsibleSection";

export const metadata = { title: "Consultations — Mon E-Carnet", robots: { index: false, follow: false } };

export default function ProfessionalConsultationsPage() {
  return <ClinicalGate><><ProfessionalConsultations /><CollapsibleSection title="Vaccinations à confirmer"><ProfessionalVaccinations /></CollapsibleSection></></ClinicalGate>;
}
