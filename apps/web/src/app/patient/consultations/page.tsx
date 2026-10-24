import { PageHeader } from "../../../components/ui/PageHeader";
import { PatientConsultations } from "../../../components/PatientConsultations";
import { PatientPreconsultations } from "../../../components/PatientPreconsultations";
import { CollapsibleSection } from "../../../components/ui/CollapsibleSection";

export const metadata = { title: "Consultations — Mon E-Carnet", robots: { index: false, follow: false } };

export default function PatientConsultationsPage() {
  return (
    <div className="stack-lg">
      <PageHeader eyebrow="Consultations" title="Préparer et retrouver" lead="Préparez vos rendez-vous, puis retrouvez ce que les professionnels ont validé avec votre accord." />
      <PatientPreconsultations />
      <div className="section-grid"><CollapsibleSection title="Mes consultations" icon="stethoscope" hint="Validées par un professionnel"><PatientConsultations /></CollapsibleSection></div>
    </div>
  );
}
