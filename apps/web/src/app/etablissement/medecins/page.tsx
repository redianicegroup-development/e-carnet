import { EstablishmentConsole } from "../../../components/EstablishmentConsole";

export const metadata = { title: "Médecins — Mon Carnet Numérique", robots: { index: false, follow: false } };

export default function EstablishmentDoctorsPage() {
  return <EstablishmentConsole view="doctors" />;
}
