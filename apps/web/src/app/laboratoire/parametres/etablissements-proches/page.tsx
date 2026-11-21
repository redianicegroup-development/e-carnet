import { NearbyEstablishmentsPage } from "../../../../components/NearbyEstablishmentsPage";

export const metadata = { title: "Établissements proches de moi — Espace laboratoire — Mon E-Carnet", robots: { index: false, follow: false } };

export default function LaboratoryNearbyEstablishmentsRoute() {
  return <NearbyEstablishmentsPage backHref="/laboratoire/parametres" />;
}
