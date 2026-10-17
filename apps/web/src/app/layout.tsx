import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import {
  Bricolage_Grotesque,
  Caveat,
  Fredoka,
  JetBrains_Mono,
  Manrope,
  Mooli,
  Quicksand,
  Sora,
} from "next/font/google";
import "@ecarnet/ui/tokens.css";
import "./globals.css";
import "./site-pages.css";
import { ThemeBootstrap } from "../components/ThemeBootstrap";
import { PwaRegister } from "../components/PwaRegister";
import { AnonymousVisitorTracker } from "../components/AnonymousVisitorTracker";
import { LandingFeedbackWidget } from "../components/LandingFeedbackWidget";
import { GooeyFilters } from "../components/ui/GooeyFilters";
import { ConfirmProvider } from "../components/modal/ConfirmProvider";
import { CookieConsentBanner } from "../components/CookieConsentBanner";
import "./cookie-consent.css";
import "./screen-loader.css";
import "../components/modal/modal.css";
import "./carnet-skin.css";

// Polices auto-hébergées par Next au build : une seule paire est utilisée à l’écran,
// sans requête Google Fonts à l’exécution ni préchargement des autres paires.
const manrope = Manrope({ subsets: ["latin"], weight: "400", variable: "--font-manrope", display: "swap", preload: false });
const sora = Sora({ subsets: ["latin"], weight: "400", variable: "--font-sora", display: "swap", preload: false });
const mooli = Mooli({ subsets: ["latin"], weight: "400", variable: "--font-mooli", display: "swap", preload: false });
const quicksand = Quicksand({ subsets: ["latin"], weight: "400", variable: "--font-quicksand", display: "swap", preload: false });
const bricolageGrotesque = Bricolage_Grotesque({ subsets: ["latin"], weight: "400", variable: "--font-bricolage-grotesque", display: "swap", preload: false });
const fredoka = Fredoka({ subsets: ["latin"], weight: "400", variable: "--font-fredoka", display: "swap", preload: false });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-jetbrains-mono", display: "swap", preload: false });
// Écriture manuscrite : uniquement les titres du pied de page public (variable --font-script).
const caveat = Caveat({ subsets: ["latin"], weight: "600", variable: "--font-script", display: "swap", preload: false });
const localFontClasses = [jetbrainsMono, manrope, sora, mooli, quicksand, bricolageGrotesque, fredoka, caveat]
  .map((font) => font.variable)
  .join(" ");

export const metadata: Metadata = {
  title: "Mon E-Carnet",
  description: "Un carnet médical personnel, sous le contrôle du patient.",
  robots: { index: false, follow: false },
  applicationName: "Mon E-Carnet",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#FFF7E6" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="fr" className={localFontClasses}><body><GooeyFilters /><ThemeBootstrap /><AnonymousVisitorTracker /><PwaRegister /><ConfirmProvider>{children}</ConfirmProvider><CookieConsentBanner /><LandingFeedbackWidget /></body></html>;
}
