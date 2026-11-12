import type { Metadata } from "next";
import { InstallLanding } from "../../components/app/InstallLanding";
import { PublicShell } from "../../components/public/PublicShell";

export const metadata: Metadata = {
  title: "Installer Mon E-Carnet",
  description: "Installez Mon E-Carnet, votre carnet de santé personnel, sur l’écran d’accueil de votre téléphone ou de votre ordinateur.",
  robots: { index: false, follow: false },
  openGraph: { title: "Installer Mon E-Carnet", description: "Votre carnet de santé personnel, sur l’écran d’accueil de votre téléphone.", type: "website", locale: "fr_FR", images: [{ url: "/brand/icon-512.png", width: 512, height: 512, alt: "Mon E-Carnet" }] },
  twitter: { card: "summary", title: "Installer Mon E-Carnet", description: "Votre carnet de santé personnel, sur l’écran d’accueil de votre téléphone.", images: ["/brand/icon-512.png"] },
};

/* Le navigateur peut proposer l'installation avant que la page soit interactive : ce petit script la garde pour le bouton. */
const KEEP_INSTALL_PROMPT = "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__ecarnetInstallPrompt=e;});";

export default function InstallPage() {
  return (
    <PublicShell>
      <script dangerouslySetInnerHTML={{ __html: KEEP_INSTALL_PROMPT }} />
      <InstallLanding />
    </PublicShell>
  );
}
