import { EstablishmentConsole } from "../../../components/EstablishmentConsole";

export const metadata = { title: "Médecins — Mon E-Carnet", robots: { index: false, follow: false } };

export default function EstablishmentDoctorsPage() {
  return <EstablishmentConsole view="doctors" />;
}
