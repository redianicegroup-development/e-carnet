import "../../../components/establishment-preconsultation-templates.css";
import { EstablishmentPreconsultationTemplates } from "../../../components/EstablishmentPreconsultationTemplates";
export const metadata = { title: "Modèles de pré-consultation — Mon E-Carnet", robots: { index: false, follow: false } };
export default function EstablishmentTemplatesPage() {
  return <div className="stack-lg"><EstablishmentPreconsultationTemplates /></div>;
}
