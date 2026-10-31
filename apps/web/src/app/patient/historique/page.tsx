import { PatientHistory } from "../../../components/PatientHistory";

export const metadata = { title: "Historique — Mon E-Carnet", robots: { index: false, follow: false } };

export default function PatientHistoryPage() {
  return <PatientHistory />;
}
