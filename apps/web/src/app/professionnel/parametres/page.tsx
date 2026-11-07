import { ProfessionalSettingsClient } from "../../../components/ProfessionalSettingsClient";
import { PageHeader } from "../../../components/ui/PageHeader";

export const metadata = { title: "Mon profil — Mon E-Carnet", robots: { index: false, follow: false } };

export default function ProfessionalSettingsPage() {
  return <div className="stack-lg"><PageHeader title="Paramètres professionnels" lead="Profession, établissement, préférences et connexion." /><ProfessionalSettingsClient /></div>;
}
