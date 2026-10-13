"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../infrastructure/api/client";
import { PageHeader } from "./ui/PageHeader";

type Declaration = { id: string; kind: string; label: string; details: string; provenance: { label: string } };
const KINDS: Record<string, string> = { allergy: "Allergie", antecedent: "Antécédent", treatment: "Traitement", blood_group: "Groupe sanguin" };
const BLOOD_GROUPS = ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−", "Inconnu"];

export function PatientCarnet() {
  const [items, setItems] = useState<Declaration[] | null>(null);
  const [form, setForm] = useState({ kind: "allergy", label: "", details: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    apiGet<Declaration[]>("/api/v1/patient/declarations/").then((data) => { if (active) setItems(data); }).catch((error) => { if (active) { setItems([]); setMessage(error instanceof Error ? error.message : "Impossible de charger le carnet."); } });
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.label.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const created = await apiPost<Declaration>("/api/v1/patient/declarations/", form);
      setItems((current) => [created, ...(current ?? []).filter((item) => form.kind !== "blood_group" || item.kind !== "blood_group")]);
      setForm({ ...form, label: "", details: "" });
      setMessage("Déclaration ajoutée. Elle reste marquée « déclarée par vous ».");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Déclaration refusée.");
    } finally { setBusy(false); }
  }

  return (
    <div className="stack-lg">
      <PageHeader eyebrow="Mon carnet" title="Ce que je déclare" lead="Chaque information garde sa provenance : déclarée par vous, jamais présentée comme confirmée tant qu’un médecin ne l’a pas validée." />
      <div className="patient-grid">
        <form className="card" onSubmit={submit}>
          <span className="eyebrow">Ajouter</span>
          <h2>Une déclaration</h2>
          <label className="field"><span>Type</span><select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value, label: "", details: "" })}>{Object.entries(KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {form.kind === "blood_group" ? <label className="field"><span>Groupe sanguin déclaré</span><select required value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })}><option value="">Choisir un groupe</option>{BLOOD_GROUPS.map((group) => <option key={group} value={group}>{group}</option>)}</select></label> : <label className="field"><span>Nom ou libellé</span><input required maxLength={160} value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="Ex. allergie connue" /></label>}
          <label className="field"><span>Détails (facultatif)</span><textarea maxLength={500} value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} /></label>
          <button className="button primary" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Ajouter à mon carnet"}</button>
          <p className="status" role="status" aria-live="polite">{message}</p>
        </form>
        <section className="card" aria-label="Mes déclarations">
          <div className="section-heading"><div><span className="eyebrow">Provenance visible</span><h2>Mes déclarations</h2></div><span className="count-badge">{items?.length ?? "…"}</span></div>
          {items === null ? <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /></div> : items.length === 0 ? <p className="empty">Aucune déclaration pour le moment. Vous gardez la main sur ce que vous ajoutez.</p> : (
            <div className="stack">
              {items.map((item) => (
                <article className="record" key={item.id}>
                  <div><strong>{item.label}</strong><p className="muted">{KINDS[item.kind] ?? "Antécédent"} · {item.details || "Aucun détail"}</p></div>
                  <span className="badge declared">{item.provenance.label}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
