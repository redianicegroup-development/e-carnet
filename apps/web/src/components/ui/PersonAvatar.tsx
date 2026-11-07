"use client";

import { useState } from "react";
import "./person-avatar.css";

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase() || "?";
}

/* Photo de profil d'une personne (patient) : l'image si elle existe et se charge, sinon les initiales. Jamais une icône cassée. */
export function PersonAvatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  // eslint-disable-next-line @next/next/no-img-element -- photo du compte (URL externe ou Cloudinary)
  if (src && !failed) return <img className="person-avatar" style={style} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
  return <span className="person-avatar person-avatar--initials" style={style} aria-hidden="true">{initialsOf(name)}</span>;
}
