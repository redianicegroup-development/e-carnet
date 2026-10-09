import { ProfessionalSettingsClient } from "../../../components/ProfessionalSettingsClient";
import { PageHeader } from "../../../components/ui/PageHeader";

export const metadata = { title: "Mon profil — Mon Carnet Numérique", robots: { index: false, follow: false } };

export default function ProfessionalSettingsPage() {
  return <div className="stack-lg"><PageHeader eyebrow="Moi" title="Mon profil professionnel" lead="Votre identité, votre profession et l’apparence de l’application. Aucun dossier patient n’est accessible depuis ici." /><ProfessionalSettingsClient /></div>;
}
