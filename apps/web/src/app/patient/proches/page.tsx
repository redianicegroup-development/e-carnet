import { PageHeader } from "../../../components/ui/PageHeader";
import { TrustedContactDelegationClient } from "../../../components/TrustedContactDelegationClient";

export const metadata = { title: "Proche de confiance — Mon E-Carnet", robots: { index: false, follow: false } };

export default function TrustedContactPage() {
  return <div className="stack-lg"><PageHeader eyebrow="Accès partagé" title="Proche de confiance" lead="Générez ou saisissez un mot de rattachement temporaire pour créer un lien de lecture seule." /><section className="card"><TrustedContactDelegationClient /></section></div>;
}
