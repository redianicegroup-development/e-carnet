import { EstablishmentSettingsClient } from "../../../components/EstablishmentSettingsClient";
import { PageHeader } from "../../../components/ui/PageHeader";

export const metadata = { title: "Mon compte — Mon E-Carnet", robots: { index: false, follow: false } };

export default function EstablishmentSettingsPage() {
  return <div className="stack-lg"><PageHeader title="Mon compte" lead="Votre identité et l’apparence de l’application." /><EstablishmentSettingsClient /></div>;
}
