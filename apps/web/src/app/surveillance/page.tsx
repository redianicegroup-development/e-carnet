import type { Metadata } from "next";
import { OpsPortalClient } from "../../components/OpsPortalClient";

/* Portail de surveillance technique : une adresse À PART de /admin, sans lien depuis le site ni la console. */
export const metadata: Metadata = { title: "Portail de surveillance — Mon E-Carnet", robots: { index: false, follow: false } };

export default function SurveillancePage() {
  return <OpsPortalClient />;
}
