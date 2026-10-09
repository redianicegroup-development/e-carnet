import { PatientPreconsultations } from "./PatientPreconsultations";

// Ancien point d’entrée conservé pour compatibilité : les pré-consultations
// passent désormais par le formulaire avec établissement choisi au catalogue.
export function PatientDashboard() {
  return <PatientPreconsultations />;
}
