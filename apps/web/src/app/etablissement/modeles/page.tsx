import "../../../components/establishment-preconsultation-templates.css";
import { EstablishmentPreconsultationTemplates } from "../../../components/EstablishmentPreconsultationTemplates";
import { PageHeader } from "../../../components/ui/PageHeader";
export const metadata = { title: "Modèles de pré-consultation — Mon E-Carnet", robots: { index: false, follow: false } };
export default function EstablishmentTemplatesPage() {
  return <div className="stack-lg"><PageHeader eyebrow="Espace établissement" title="Modèles de pré-consultation" lead="Structurez les informations préparées avant un rendez-vous, avec validation médicale préalable." /><EstablishmentPreconsultationTemplates /></div>;
}
