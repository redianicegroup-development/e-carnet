"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../infrastructure/api/client";

type Referral = { id: string; patient_id: string; patient_name: string; from_establishment: string; reason_category: string; status: string; read_until: string };
export function ProfessionalReferralsClient({ establishmentId: initialEstablishmentId = "" }: { establishmentId?: string }) {
  const [establishmentId, setEstablishmentId] = useState(initialEstablishmentId);
  const [items, setItems] = useState<Referral[]>([]); const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null); const [message, setMessage] = useState("");
  async function load() { try { const id = establishmentId || (await apiGet<{ active_establishment: string | null }>("/api/v1/professionals/me/")).active_establishment; if (!id) throw new Error("Sélectionnez un établissement actif."); setEstablishmentId(id); setItems(await apiGet<Referral[]>(`/api/v1/establishments/${id}/referrals/inbox/`)); } catch (error) { setMessage(error instanceof Error ? error.message : "Impossible de charger l’inbox."); } }
  async function open(item: Referral) { try { await apiPost(`/api/v1/referrals/${item.id}/open/`); setSnapshot(await apiGet<Record<string, unknown>>(`/api/v1/referrals/${item.id}/snapshot/`)); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "Cet adressage n’est plus accessible."); } }
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- chargement initial depuis l’API.
  useEffect(() => { void load(); }, []);
  return <div className="stack-lg"><div className="actions"><button className="button" type="button" onClick={() => void load()}>Actualiser les adressages reçus</button></div>{message && <p className="notice" role="alert">{message}</p>}{items.length === 0 && <p className="muted">Aucun adressage accepté n’est disponible.</p>}{items.map((item) => <article className="card" key={item.id}><p className="eyebrow">Adressage reçu · {item.status}</p><h2>{item.patient_name}</h2><p className="muted">Depuis {item.from_establishment} · motif : {item.reason_category} · accès jusqu’au {new Date(item.read_until).toLocaleDateString("fr-FR")}.</p><button className="button primary" type="button" onClick={() => void open(item)}>Ouvrir l’instantané</button></article>)}{snapshot && <article className="card"><p className="eyebrow">Instantané en lecture seule</p><pre className="code-block">{JSON.stringify(snapshot, null, 2)}</pre></article>}</div>;
}
