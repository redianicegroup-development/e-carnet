import { AccountSettingsClient } from "../../../components/AccountSettingsClient";
import { ThemeSettingsClient } from "../../../components/ThemeSettingsClient";
import { PageHeader } from "../../../components/ui/PageHeader";

export const metadata = { title: "Mon compte — Mon Carnet Numérique", robots: { index: false, follow: false } };

export default function PatientSettingsPage() {
  return <div className="stack-lg"><PageHeader eyebrow="Moi" title="Mon compte" lead="Vous contrôlez votre identité, vos méthodes de connexion et vos autorisations." /><section className="settings-page"><AccountSettingsClient /><ThemeSettingsClient /></section></div>;
}
