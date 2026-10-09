import { EstablishmentConsole } from "../../components/EstablishmentConsole";

export const metadata = { title: "Accueil — Espace établissement — Mon Carnet Numérique", robots: { index: false, follow: false } };

export default function EstablishmentPage() {
  return <EstablishmentConsole view="home" />;
}
