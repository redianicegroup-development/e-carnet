import { EstablishmentConsole } from "../../../components/EstablishmentConsole";

export const metadata = { title: "Demandes — Mon E-Carnet", robots: { index: false, follow: false } };

export default function EstablishmentRequestsPage() {
  return <EstablishmentConsole view="requests" />;
}
