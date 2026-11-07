import { PageHeader } from "../../../components/ui/PageHeader";
import { ProfessionalReferralsClient } from "../../../components/ProfessionalReferralsClient";

export const metadata = { title: "Adressages reçus — Mon E-Carnet", robots: { index: false, follow: false } };

export default function ProfessionalReferralsPage() {
  return <div className="stack-lg"><PageHeader title="Adressages reçus" lead="Uniquement ce que les patients ont autorisé pour votre établissement." /><ProfessionalReferralsClient /></div>;
}
