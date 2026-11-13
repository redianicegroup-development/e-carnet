import { EstablishmentSettingsClient } from "../../../components/EstablishmentSettingsClient";
import { PageHeader } from "../../../components/ui/PageHeader";

export const metadata = { title: "Mon compte — Espace laboratoire — Mon E-Carnet", robots: { index: false, follow: false } };

export default function LaboratorySettingsPage() {
  return <div className="stack-lg"><PageHeader title="Mon compte" lead="Votre identité, celle de votre laboratoire et l’apparence de l’application." /><EstablishmentSettingsClient laboratory /></div>;
}
