"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

/** « Retour » qui revient à la page précédente (par exemple les paramètres) ; sans historique ou sans JavaScript : lien vers l'accueil. */
export function BackLink({ fallbackHref = "/", label = "Retour" }: { fallbackHref?: string; label?: string }) {
  const router = useRouter();
  return (
    <a
      className="back-link"
      href={fallbackHref}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        if (window.history.length > 1) {
          event.preventDefault();
          router.back();
        }
      }}
    >
      <span aria-hidden="true">←</span> {label}
    </a>
  );
}
