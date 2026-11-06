"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../infrastructure/api/client";
import { EmergencyCardVisual, type EmergencyCardView } from "./emergency-card/EmergencyCardVisual";
import { Icon } from "./ui/Icon";
import { cacheEmergencyCard, forgetEmergencyCard, keepEmergencyPageForOffline, purgeExpiredEmergencyCards, readCachedEmergencyCard } from "../lib/emergency-card-offline";
import { emergencyCardFallback } from "../lib/offline-policy";

export function PublicEmergencyCard({ token }: { token: string }) {
  const [data, setData] = useState<EmergencyCardView | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "cached" | "missing">("loading");
  const [cachedAt, setCachedAt] = useState("");

  useEffect(() => {
    let active = true;
    apiGet<EmergencyCardView>(`/api/v1/patient/emergency-card/qr/${encodeURIComponent(token)}/`)
      .then(async (card) => {
        // Une réponse vide (portail captif, proxy) n'est pas une carte : on la traite comme un défaut de réseau.
        if (!card || typeof card !== "object") throw new TypeError("Réponse inattendue");
        if (active) { setData(card); setStatus("ready"); }
        await cacheEmergencyCard(token, card);
        void purgeExpiredEmergencyCards();
        keepEmergencyPageForOffline();
      })
      .catch(async (error: unknown) => {
        // Seule une absence de réponse (réseau, délai, 429, 5xx) autorise la copie locale. Un 404/410 veut dire « QR désactivé ou
        // renouvelé » : la copie est supprimée et jamais affichée, même si l'appareil est en ligne.
        const fallback = emergencyCardFallback(error);
        if (fallback === "forget") await forgetEmergencyCard(token);
        const cached = fallback === "use-cache" ? await readCachedEmergencyCard(token) : null;
        if (active && cached) { setData(cached.data); setCachedAt(cached.cachedAt); setStatus("cached"); }
        else if (active) setStatus("missing");
      });
    return () => { active = false; };
  }, [token]);

  if (status === "loading") return <main className="epub"><section className="epub__state" role="status"><span className="epub__pulse" /><h1>Ouverture de la carte d’urgence…</h1></section></main>;
  if (status === "missing" || !data) return <main className="epub"><section className="epub__state" role="alert"><span className="eyebrow">Mon E‑Carnet</span><h1>Carte indisponible</h1><p>Ce QR a été désactivé ou renouvelé. Si c’est votre première visite, connectez-vous à Internet puis réessayez.</p></section></main>;

  const phone = data.contact_phone.replace(/[^+\d]/g, "");
  return <main className="epub"><div className="epub__inner">
    <div className="epub__intro"><span className="eyebrow">À présenter aux secours</span><p>Informations d’urgence déclarées par le titulaire de la carte.</p>{status === "cached" && <p className="epub__offline" role="status">Connexion indisponible : dernière synchronisation le {new Date(cachedAt).toLocaleString("fr-FR")}. Ces informations peuvent être obsolètes.</p>}</div>
    <EmergencyCardVisual card={data} showQr={false} />
    {phone && <a className="epub__call" href={`tel:${phone}`}><Icon name="phone" size={22} /><span>Appeler {data.contact_name || "le contact d’urgence"}<small>{data.contact_phone}</small></span></a>}
    <p className="epub__notice">Cette carte contient des déclarations personnelles, non vérifiées par Mon E‑Carnet. Elle ne remplace pas un avis médical ni les services d’urgence.</p>
  </div></main>;
}
