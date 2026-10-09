import { EstablishmentConsole } from "../../../components/EstablishmentConsole";

export const metadata = { title: "Demandes — Mon Carnet Numérique", robots: { index: false, follow: false } };

export default function EstablishmentRequestsPage() {
  return <EstablishmentConsole view="requests" />;
}
