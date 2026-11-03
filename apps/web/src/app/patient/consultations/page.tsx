import { PageHeader } from "../../../components/ui/PageHeader";
import { PatientConsultationFlow } from "../../../components/PatientConsultationFlow";

export const metadata = { title: "Consultations — Mon E-Carnet", robots: { index: false, follow: false } };

export default function PatientConsultationsPage() {
  return (
    <div className="stack-lg">
      <PageHeader eyebrow="Consultations" title="Préparer et retrouver" lead="L’infirmier ou le médecin fait la pré-consultation avec vous, puis vous ouvrez un accès temporaire au professionnel. Tout l’historique de vos consultations est dans l’onglet Historique." />
      <PatientConsultationFlow />
    </div>
  );
}
