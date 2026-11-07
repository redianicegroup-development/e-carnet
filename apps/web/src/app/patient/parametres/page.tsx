import { AccountSettingsClient } from "../../../components/AccountSettingsClient";
import { PageHeader } from "../../../components/ui/PageHeader";

export const metadata = { title: "Mon compte — Mon E-Carnet", robots: { index: false, follow: false } };

export default function PatientSettingsPage() {
  return <div className="stack-lg"><PageHeader title="Paramètres" lead="Compte, préférences et sécurité." /><AccountSettingsClient /></div>;
}
