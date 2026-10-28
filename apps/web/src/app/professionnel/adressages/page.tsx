import { PageHeader } from "../../../components/ui/PageHeader";
import { ProfessionalReferralsClient } from "../../../components/ProfessionalReferralsClient";

export const metadata = { title: "Adressages reçus — Mon E-Carnet", robots: { index: false, follow: false } };

export default function ProfessionalReferralsPage() {
  return <div className="stack-lg"><PageHeader eyebrow="Continuité des soins" title="Adressages reçus" lead="Consultez uniquement les instantanés que les patients ont autorisés pour votre établissement." /><ProfessionalReferralsClient /></div>;
}
