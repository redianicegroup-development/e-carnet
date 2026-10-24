import { ClinicalGate } from "../../../components/ClinicalGate";
import { ProfessionalConsultations } from "../../../components/ProfessionalConsultations";
import { ProfessionalVaccinations } from "../../../components/ProfessionalVaccinations";
import { CollapsibleSection } from "../../../components/ui/CollapsibleSection";

export const metadata = { title: "Consultations — Mon E-Carnet", robots: { index: false, follow: false } };

export default function ProfessionalConsultationsPage() {
  return <ClinicalGate><><ProfessionalConsultations /><div className="section-grid"><CollapsibleSection title="Vaccinations à confirmer" icon="drop" hint="Preuves à valider"><ProfessionalVaccinations /></CollapsibleSection></div></></ClinicalGate>;
}
