import { ClinicalGate } from "../../../components/ClinicalGate";
import { ProfessionalAgenda } from "../../../components/ProfessionalAgenda";

export const metadata = { title: "Agenda — Mon E-Carnet", robots: { index: false, follow: false } };

export default function ProfessionalAgendaPage() {
  return <ClinicalGate><ProfessionalAgenda /></ClinicalGate>;
}
