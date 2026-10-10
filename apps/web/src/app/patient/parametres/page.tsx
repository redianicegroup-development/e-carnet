import { AccountSettingsClient } from "../../../components/AccountSettingsClient";
import { PageHeader } from "../../../components/ui/PageHeader";

export const metadata = { title: "Mon compte — Mon Carnet Numérique", robots: { index: false, follow: false } };

export default function PatientSettingsPage() {
  return <div className="stack-lg"><PageHeader eyebrow="Moi" title="Paramètres" lead="Gérez vos informations personnelles, vos préférences et la sécurité de votre compte." /><AccountSettingsClient /></div>;
}
