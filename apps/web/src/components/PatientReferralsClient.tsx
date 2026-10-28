"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../infrastructure/api/client";

type Item = { id: string; record_type: string; record_id: string; accepted_by_patient: boolean };
type Referral = { id: string; status: string; from_establishment_name: string; to_establishment_name: string; reason_category: string; expires_at: string; items: Item[] };

const labels: Record<string, string> = { consultation: "Consultation", encounter: "Pré-consultation", measurement: "Mesure validée", document: "Document validé", vaccination: "Vaccination confirmée" };

export function PatientReferralsClient() {
  const [items, setItems] = useState<Referral[]>([]); const [message, setMessage] = useState(""); const [selected, setSelected] = useState<Record<string, string[]>>({});
  async function load() { try { setItems(await apiGet<Referral[]>("/api/v1/patient/referrals/")); } catch (error) { setMessage(error instanceof Error ? error.message : "Impossible de charger les adressages."); } }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial depuis l’API.
  useEffect(() => { void load(); }, []);
  async function decide(item: Referral, action: "accept" | "decline" | "revoke") { try { const ids = selected[item.id] ?? item.items.map((entry) => entry.id); await apiPost(`/api/v1/patient/referrals/${item.id}/${action}/`, action === "accept" ? { item_ids: ids, duration_days: 30 } : {}); await load(); setMessage(action === "accept" ? "Votre consentement est enregistré." : "Votre décision est enregistrée."); } catch (error) { setMessage(error instanceof Error ? error.message : "Action impossible."); } }
  return <div className="stack-lg">{message && <p className="notice" role="status">{message}</p>}{items.length === 0 && <p className="muted">Aucun adressage à valider.</p>}{items.map((item) => <article className="card" key={item.id}><p className="eyebrow">Adressage · {item.status}</p><h2>{item.from_establishment_name} → {item.to_establishment_name}</h2><p className="muted">Motif : {item.reason_category}. Proposition valable jusqu’au {new Date(item.expires_at).toLocaleDateString("fr-FR")}.</p><fieldset><legend>Éléments proposés</legend>{item.items.map((entry) => <label className="check-row" key={entry.id}><input type="checkbox" checked={(selected[item.id] ?? item.items.map((x) => x.id)).includes(entry.id)} onChange={(event) => setSelected((current) => ({ ...current, [item.id]: event.target.checked ? [...(current[item.id] ?? item.items.map((x) => x.id)), entry.id] : (current[item.id] ?? item.items.map((x) => x.id)).filter((id) => id !== entry.id) }))} disabled={item.status !== "proposed"} />{labels[entry.record_type] ?? entry.record_type}</label>)}</fieldset>{item.status === "proposed" && <div className="actions"><button className="button primary" type="button" onClick={() => void decide(item, "accept")}>Accepter les éléments cochés</button><button className="button" type="button" onClick={() => void decide(item, "decline")}>Refuser</button></div>}{["accepted", "consulted"].includes(item.status) && <button className="button danger" type="button" onClick={() => void decide(item, "revoke")}>Révoquer maintenant</button>}</article>)}</div>;
}
