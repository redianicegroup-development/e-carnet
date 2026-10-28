"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiDelete, apiGet } from "../infrastructure/api/client";

type Delegation = { id: string; patient_first_name?: string; patient_last_name?: string; expires_at: string | null; is_selected?: boolean };
const date = (value: string | null) => value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value)) : "—";

export function TrustedDelegationBanner() {
  const [items, setItems] = useState<Delegation[]>([]);
  const [message, setMessage] = useState("");
  async function refresh() { try { setItems(await apiGet<Delegation[]>("/api/v1/patient/delegations/mine/")); } catch { setItems([]); } }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronise le bandeau avec la session serveur.
  useEffect(() => { void refresh(); const listener = () => void refresh(); window.addEventListener("ecarnet:delegation-changed", listener); return () => window.removeEventListener("ecarnet:delegation-changed", listener); }, []);
  const selected = items.find((item) => item.is_selected);
  if (!selected) return null;
  async function leave() { try { await apiDelete(`/api/v1/patient/delegations/${selected?.id}/select/`); await refresh(); setMessage("Votre carnet personnel est de nouveau sélectionné."); } catch { setMessage("Impossible de quitter ce carnet pour le moment."); } }
  return <aside className="notice trusted-delegation-banner" role="status" aria-label="Accès proche de confiance"><strong>Vous consultez le carnet de {selected.patient_first_name} {selected.patient_last_name}</strong><p className="muted">Lecture seule · fiche d’urgence uniquement · accès journalisé · jusqu’au {date(selected.expires_at)}.</p><div className="actions"><button className="button small" type="button" onClick={() => void leave()}>Revenir à mon carnet</button><Link className="button small" href="/patient/proches">Changer de carnet</Link></div>{message && <p className="status">{message}</p>}</aside>;
}
