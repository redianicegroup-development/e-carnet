"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../infrastructure/api/client";
import "./ad-banner.css";

type Banner = { id: string; alt_text: string; link_url: string; label: string; desktop_url: string; mobile_url: string };

/* Bannière « Sponsorisé » de l'accueil patient. Une seule, jamais dans le carnet, la consultation, le QR ni la carte d'urgence.
   Aucun ciblage : tous les patients voient la même. Rien ne s'affiche tant que la diffusion n'est pas activée côté serveur. */
export function PatientBanner() {
  const [banner, setBanner] = useState<Banner | null>(null);
  useEffect(() => {
    let active = true;
    apiGet<Banner | null>("/api/v1/advertising/banner/")
      .then((data) => { if (active) setBanner(data && typeof data === "object" && "id" in data ? data : null); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  if (!banner) return null;
  const picture = (
    <picture>
      <source media="(max-width: 640px)" srcSet={banner.mobile_url} />
      <img src={banner.desktop_url} alt={banner.alt_text} width={1500} height={500} loading="lazy" decoding="async" />
    </picture>
  );
  return (
    <aside className="ad-banner" aria-label="Publicité">
      <span className="ad-banner__tag">{banner.label}</span>
      {banner.link_url
        ? <a className="ad-banner__link" href={banner.link_url} target="_blank" rel="noopener noreferrer sponsored" onClick={() => { void apiPost(`/api/v1/advertising/banners/${banner.id}/click/`, {}).catch(() => undefined); }}>{picture}</a>
        : picture}
      <p className="ad-banner__note muted">Cette publicité n’utilise pas vos données de santé.</p>
    </aside>
  );
}
