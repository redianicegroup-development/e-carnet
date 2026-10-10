import { ProfessionalSettingsClient } from "../../../components/ProfessionalSettingsClient";
import { PageHeader } from "../../../components/ui/PageHeader";

export const metadata = { title: "Mon profil — Mon Carnet Numérique", robots: { index: false, follow: false } };

export default function ProfessionalSettingsPage() {
  return <div className="stack-lg"><PageHeader eyebrow="Espace professionnel" title="Paramètres professionnels" lead="Retrouvez votre profession, votre établissement, vos préférences et vos méthodes de connexion." /><ProfessionalSettingsClient /></div>;
}
