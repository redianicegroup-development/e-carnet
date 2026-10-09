"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Workspace = "patient" | "professional" | "establishment";

const navigation: Record<Workspace, { label: string; href: string; icon: string }[]> = {
  patient: [
    { label: "Accueil", href: "/patient", icon: "⌂" },
    { label: "Carnet", href: "/patient#carnet", icon: "▤" },
    { label: "Consult.", href: "/patient/consultations", icon: "＋" },
    { label: "Accès", href: "/patient/acces", icon: "↗" },
    { label: "Moi", href: "/patient/parametres", icon: "●" },
  ],
  professional: [
    { label: "Accueil", href: "/professionnel", icon: "⌂" },
    { label: "Patients", href: "/professionnel/acces#nouvelle-demande", icon: "⌕" },
    { label: "Consult.", href: "/professionnel/consultations", icon: "＋" },
    { label: "Accès", href: "/professionnel/acces#historique", icon: "↗" },
    { label: "Moi", href: "/professionnel/parametres", icon: "●" },
  ],
  establishment: [
    { label: "Accueil", href: "/etablissement", icon: "⌂" },
    { label: "Demande", href: "/etablissement#demande", icon: "▤" },
    { label: "Médecins", href: "/etablissement#medecins", icon: "▣" },
    { label: "Aide", href: "/etablissement#aide", icon: "?" },
    { label: "Moi", href: "/etablissement/parametres", icon: "●" },
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
            <span aria-hidden="true">{item.icon}</span>{item.label}
          </Link>
        );
      })}
    </nav>
  );
}
