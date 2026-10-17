import { PageHeader } from "../../../components/ui/PageHeader";
import { PatientConsultations } from "../../../components/PatientConsultations";
import { PatientPreconsultations } from "../../../components/PatientPreconsultations";

export const metadata = { title: "Consultations — Mon E-Carnet", robots: { index: false, follow: false } };

export default function PatientConsultationsPage() {
  return (
    <div className="stack-lg">
      <PageHeader eyebrow="Consultations" title="Préparer et retrouver" lead="Préparez vos rendez-vous, puis retrouvez ce que les professionnels ont validé avec votre accord." />
      <PatientPreconsultations />
      <PatientConsultations />
    </div>
  );
}
