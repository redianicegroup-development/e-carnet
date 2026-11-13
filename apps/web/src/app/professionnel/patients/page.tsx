import { ClinicalGate } from "../../../components/ClinicalGate";
import { BreakGlassEntryLink } from "../../../components/BreakGlassEntryLink";
import { ProfessionalAccessGrants } from "../../../components/ProfessionalAccessGrants";
import { ProfessionalRecentPatients } from "../../../components/ProfessionalRecentPatients";

export const metadata = { title: "Patients — Mon E-Carnet", robots: { index: false, follow: false } };

export default function ProfessionalPatientsPage() {
  return <ClinicalGate><div className="stack-lg"><ProfessionalRecentPatients /><ProfessionalAccessGrants /><BreakGlassEntryLink role="professional" /></div></ClinicalGate>;
}
