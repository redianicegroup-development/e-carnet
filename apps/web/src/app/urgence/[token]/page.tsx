import { PublicEmergencyCard } from "../../../components/PublicEmergencyCard";

export const metadata = {
  title: "Carte d’urgence — E‑Carnet",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

export default async function EmergencyCardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicEmergencyCard token={token} />;
}
