"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./ui/Icon";

type Workspace = "patient" | "professional" | "establishment";

const navigation: Record<Workspace, { label: string; href: string; icon: IconName }[]> = {
  patient: [
    { label: "Accueil", href: "/patient", icon: "home" },
    { label: "Carnet", href: "/patient#carnet", icon: "document" },
    { label: "Consult.", href: "/patient/consultations", icon: "stethoscope" },
    { label: "Historique", href: "/patient/historique", icon: "clock" },
    { label: "Moi", href: "/patient/parametres", icon: "user" },
  ],
  professional: [
    { label: "Accueil", href: "/professionnel", icon: "home" },
    { label: "Patients", href: "/professionnel/acces#nouvelle-demande", icon: "search" },
    { label: "Consult.", href: "/professionnel/consultations", icon: "stethoscope" },
    { label: "Accès", href: "/professionnel/acces#historique", icon: "share" },
    { label: "Moi", href: "/professionnel/parametres", icon: "user" },
  ],
  establishment: [
    { label: "Accueil", href: "/etablissement", icon: "home" },
    { label: "Demande", href: "/etablissement#demande", icon: "document" },
    { label: "Médecins", href: "/etablissement#medecins", icon: "users" },
    { label: "Aide", href: "/etablissement#aide", icon: "help" },
    { label: "Moi", href: "/etablissement/parametres", icon: "user" },
  ],
};

export function WorkspaceNav({ workspace }: { workspace: Workspace }) {
  const pathname = usePathname();
  const [currentHash, setCurrentHash] = useState("");
  useEffect(() => {
    const updateHash = () => setCurrentHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);
  return (
    <nav className="workspace-nav" aria-label={`Navigation ${workspace}`}>
      {navigation[workspace].map((item) => {
        const [route, hashTarget] = item.href.split("#");
        const active = pathname === route && (!hashTarget || currentHash === `#${hashTarget}`)
          || (route !== "/patient" && route !== "/etablissement" && pathname.startsWith(`${route}/`))
          || (workspace === "establishment" && item.href === "/etablissement/parametres" && pathname.startsWith("/etablissement/parametres"));
        return (
          <Link key={item.label} href={item.href} className={active ? "workspace-nav__link is-active" : "workspace-nav__link"} aria-current={active ? "page" : undefined}>
            <Icon name={item.icon} size={20} />{item.label}
          </Link>
        );
      })}
    </nav>
  );
}
