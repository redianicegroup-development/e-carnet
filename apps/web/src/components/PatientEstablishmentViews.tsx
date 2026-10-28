"use client";
import { useEffect, useState } from "react";
import { apiGet } from "../infrastructure/api/client";

type Opening = { opening_id: string; who: string; role: string; when: string; reason_label: string; reason_note: string };
type EstablishmentViews = { establishment_id: string; establishment_name: string; openings_count: number; last_opened_at: string; openings: Opening[] };
function date(value: string) { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
export function PatientEstablishmentViews() {
  const [items, setItems] = useState<EstablishmentViews[] | null>(null);
  useEffect(() => { let active = true; apiGet<EstablishmentViews[]>("/api/v1/patient/record-views/").then((data) => active && setItems(data)).catch(() => active && setItems([])); return () => { active = false; }; }, []);
  return <section className="card" aria-labelledby="establishment-views-heading"><div className="section-heading"><div><span className="eyebrow">Transparence</span><h2 id="establishment-views-heading">Établissements</h2></div><span className="count-badge">{items === null ? "…" : items.reduce((total, item) => total + item.openings_count, 0)}</span></div><p className="muted">Retrouvez qui a ouvert votre dossier dans un établissement, quand et pour quel motif.</p>{items === null ? <p className="muted" role="status">Chargement de l’historique…</p> : items.length === 0 ? <div className="empty"><p>Aucun établissement n’a encore ouvert votre dossier.</p></div> : <div className="stack">{items.map((item) => <details className="record" key={item.establishment_id}><summary><strong>{item.establishment_name}</strong><span className="badge">{item.openings_count} vue{item.openings_count === 1 ? "" : "s"}</span></summary><p className="muted">Dernière ouverture : {date(item.last_opened_at)}</p><ol className="stack">{item.openings.map((opening) => <li key={opening.opening_id}><strong>{opening.who}</strong><p className="muted">{opening.reason_label} · {date(opening.when)}</p>{opening.reason_note && <p>{opening.reason_note}</p>}</li>)}</ol></details>)}</div>}</section>;
}
