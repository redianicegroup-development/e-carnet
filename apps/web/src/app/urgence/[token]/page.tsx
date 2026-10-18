import { PublicEmergencyCard } from "../../../components/PublicEmergencyCard";
import { BackToTopButton } from "../../../components/public/BackToTopButton";

export const metadata = {
  title: "Carte d’urgence — Mon E‑Carnet",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

export default async function EmergencyCardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <><PublicEmergencyCard token={token} /><BackToTopButton /></>;
}
