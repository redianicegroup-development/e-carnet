import { PageHeader } from "../../../components/ui/PageHeader";
import { PatientConsultations } from "../../../components/PatientConsultations";
import { PatientConsultationFlow } from "../../../components/PatientConsultationFlow";
import { CollapsibleSection } from "../../../components/ui/CollapsibleSection";

export const metadata = { title: "Consultations — Mon E-Carnet", robots: { index: false, follow: false } };

export default function PatientConsultationsPage() {
  return (
    <div className="stack-lg">
      <PageHeader eyebrow="Consultations" title="Préparer et retrouver" lead="Préparez votre rendez-vous, puis ouvrez un accès temporaire au professionnel. Ce qu’il a validé avec votre accord se retrouve plus bas." />
      <PatientConsultationFlow />
      <div className="section-grid"><CollapsibleSection title="Mes consultations" icon="stethoscope" hint="Validées par un professionnel"><PatientConsultations /></CollapsibleSection></div>
    </div>
  );
}
