import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import {
  Barlow,
  Bricolage_Grotesque,
  Fredoka,
  JetBrains_Mono,
  Lexend,
  Manrope,
  Mooli,
  Nunito,
  Plus_Jakarta_Sans,
  Quicksand,
  Sora,
  Ubuntu,
  Unbounded,
} from "next/font/google";
import "@ecarnet/ui/tokens.css";
import "./globals.css";
import { ThemeBootstrap } from "../components/ThemeBootstrap";
import { PwaRegister } from "../components/PwaRegister";

// Les fichiers sont intégrés au build puis servis localement. preload=false
// évite de précharger les 12 familles : seul le thème sélectionné est demandé.
const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ["latin"], weight: "400", variable: "--font-plus-jakarta-sans", display: "swap", preload: false });
const nunito = Nunito({ subsets: ["latin"], weight: "400", variable: "--font-nunito", display: "swap", preload: false });
const lexend = Lexend({ subsets: ["latin"], weight: "400", variable: "--font-lexend", display: "swap", preload: false });
const manrope = Manrope({ subsets: ["latin"], weight: "400", variable: "--font-manrope", display: "swap", preload: false });
const sora = Sora({ subsets: ["latin"], weight: "400", variable: "--font-sora", display: "swap", preload: false });
const mooli = Mooli({ subsets: ["latin"], weight: "400", variable: "--font-mooli", display: "swap", preload: false });
const unbounded = Unbounded({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-unbounded", display: "swap", preload: false });
const quicksand = Quicksand({ subsets: ["latin"], weight: "400", variable: "--font-quicksand", display: "swap", preload: false });
const bricolageGrotesque = Bricolage_Grotesque({ subsets: ["latin"], weight: "400", variable: "--font-bricolage-grotesque", display: "swap", preload: false });
const barlow = Barlow({ subsets: ["latin"], weight: "400", variable: "--font-barlow", display: "swap", preload: false });
const ubuntu = Ubuntu({ subsets: ["latin"], weight: "400", variable: "--font-ubuntu", display: "swap", preload: false });
const fredoka = Fredoka({ subsets: ["latin"], weight: "400", variable: "--font-fredoka", display: "swap", preload: false });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-jetbrains-mono", display: "swap", preload: false });
const localFontClasses = [jetbrainsMono, plusJakartaSans, nunito, lexend, manrope, sora, mooli, unbounded, quicksand, bricolageGrotesque, barlow, ubuntu, fredoka]
  .map((font) => font.variable)
  .join(" ");

export const metadata: Metadata = {
  title: "Mon Carnet Numérique",
  description: "Un carnet médical personnel, sous le contrôle du patient.",
  robots: { index: false, follow: false },
  applicationName: "Mon Carnet Numérique",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#E6FFF7" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="fr" className={localFontClasses}><body><ThemeBootstrap /><PwaRegister />{children}</body></html>;
}
