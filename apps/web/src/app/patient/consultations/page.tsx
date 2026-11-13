import { PageHeader } from "../../../components/ui/PageHeader";
import { PatientConsultationFlow } from "../../../components/PatientConsultationFlow";
import { PatientPendingConsultations } from "../../../components/PatientPendingConsultations";

export const metadata = { title: "Consultations — Mon E-Carnet", robots: { index: false, follow: false } };

export default function PatientConsultationsPage() {
  return (
    <div className="stack-lg">
      <PageHeader title="Préparer et retrouver" lead="Préparez avec un soignant, puis ouvrez un accès temporaire." />
      <PatientPendingConsultations />
      <PatientConsultationFlow />
    </div>
  );
}
