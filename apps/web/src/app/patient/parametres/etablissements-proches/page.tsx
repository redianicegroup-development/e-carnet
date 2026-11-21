import { NearbyEstablishmentsPage } from "../../../../components/NearbyEstablishmentsPage";

export const metadata = { title: "Établissements proches de moi — Mon E-Carnet", robots: { index: false, follow: false } };

export default function NearbyEstablishmentsRoute() {
  return <NearbyEstablishmentsPage backHref="/patient/parametres" />;
}
