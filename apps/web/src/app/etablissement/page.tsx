import { BreakGlassEntryLink } from "../../components/BreakGlassEntryLink";
import { EstablishmentConsole } from "../../components/EstablishmentConsole";

export const metadata = { title: "Accueil — Espace établissement — Mon E-Carnet", robots: { index: false, follow: false } };

export default function EstablishmentPage() {
  return <div className="stack-lg"><BreakGlassEntryLink role="establishment" /><EstablishmentConsole view="home" /></div>;
}
