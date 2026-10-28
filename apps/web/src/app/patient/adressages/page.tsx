import { PageHeader } from "../../../components/ui/PageHeader";
import { PatientReferralsClient } from "../../../components/PatientReferralsClient";

export const metadata = { title: "Adressages — Mon E-Carnet", robots: { index: false, follow: false } };

export default function PatientReferralsPage() {
  return <div className="stack-lg"><PageHeader eyebrow="Partage contrôlé" title="Adressages à valider" lead="Choisissez précisément les éléments que vous autorisez à partager avec un autre établissement." /><PatientReferralsClient /></div>;
}
