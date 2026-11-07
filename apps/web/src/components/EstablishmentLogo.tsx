"use client";

import { useState } from "react";

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[1][0] : words[0]?.[1] ?? "")).toUpperCase() || "?";
}

/* Photo de profil d'un établissement : le logo de la structure s'il existe et se charge, sinon une pastille avec ses initiales
   (jamais une image cassée). */
export function EstablishmentLogo({ logo, name, size = 44 }: { logo?: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  // eslint-disable-next-line @next/next/no-img-element -- logo fourni par la structure (URL Cloudinary ou route authentifiée)
  if (logo && !failed) return <img className="establishment-logo" style={style} src={logo} alt={`Logo de ${name}`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
  return <span className="establishment-logo establishment-logo--empty" style={{ ...style, fontSize: Math.round(size * 0.36) }} aria-hidden="true">{initialsOf(name)}</span>;
}
