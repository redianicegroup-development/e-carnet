"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../infrastructure/api/client";

type Encounter = { id: string; establishment_id: string | null; facility_label: string; reason: string; observations: string; recorded_with_help?: string; status: "draft" | "closed"; closed_at: string | null; provenance: { label: string } };
type EstablishmentOption = { id: string; name: string; city: string };
type FormState = { establishment_id: string; reason: string; observations: string; recorded_with_help: string };
const EMPTY_FORM: FormState = { establishment_id: "", reason: "", observations: "", recorded_with_help: "" };

export function PatientPreconsultations() {
  const [items, setItems] = useState<Encounter[] | null>(null);
  const [establishments, setEstablishments] = useState<EstablishmentOption[] | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiGet<Encounter[]>("/api/v1/patient/care/encounters/"),
      apiGet<EstablishmentOption[]>("/api/v1/establishments/catalog/"),
    ]).then(([encounters, sites]) => {
      if (!active) return;
      setItems(encounters);
      setEstablishments(sites);
      setMessage(sites.length ? "Choisissez l’établissement destinataire de cette pré-consultation." : "Aucun établissement actif n’est disponible pour le moment.");
    }).catch((error) => {
      if (!active) return;
      setItems([]);
      setEstablishments([]);
      setMessage(error instanceof Error ? error.message : "Impossible de charger les établissements et pré-consultations.");
    });
    return () => { active = false; };
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const created = await apiPost<Encounter>("/api/v1/patient/care/encounters/", form);
      setItems((current) => [created, ...(current ?? [])]);
      setForm(EMPTY_FORM);
      setMessage("Pré-consultation enregistrée. Seul un professionnel rattaché à cet établissement pourra la lire, avec votre autorisation.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pré-consultation refusée.");
    } finally {
      setBusy(false);
    }
  }

  async function close(id: string) {
    setMessage("");
    try {
      const closed = await apiPost<Encounter>(`/api/v1/patient/care/encounters/${id}/`, {});
      setItems((current) => (current ?? []).map((item) => (item.id === id ? closed : item)));
      setMessage("Pré-consultation clôturée. Elle n’est lisible qu’avec votre autorisation et par le même établissement.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Clôture impossible.");
    }
  }

  return (
    <div className="patient-grid">
      <form id="preparer" className="card" onSubmit={create}>
        <span className="eyebrow">Préparer</span>
        <h2>Une pré-consultation</h2>
        <p className="muted">Associez-la à l’établissement concerné. Le lieu affiché est repris de son registre, pas d’un texte libre.</p>
        <label className="field">
          <span>Établissement destinataire</span>
          <select required value={form.establishment_id} onChange={(event) => setForm({ ...form, establishment_id: event.target.value })} disabled={!establishments?.length || busy}>
            <option value="" disabled>Choisir un établissement actif</option>
            {(establishments ?? []).map((site) => <option key={site.id} value={site.id}>{site.name} — {site.city}</option>)}
          </select>
        </label>
        <label className="field"><span>Motif de la consultation</span><input required maxLength={240} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Ex. fièvre depuis deux jours" /></label>
        <label className="field"><span>Ce que vous ressentez</span><textarea maxLength={2000} value={form.observations} onChange={(event) => setForm({ ...form, observations: event.target.value })} /></label>
        <label className="field"><span>Saisie aidée par (facultatif)</span><input maxLength={120} value={form.recorded_with_help} onChange={(event) => setForm({ ...form, recorded_with_help: event.target.value })} placeholder="Ex. infirmière du centre" /></label>
        <button className="button primary" type="submit" disabled={busy || !establishments?.length}>{busy ? "Enregistrement…" : "Enregistrer en brouillon"}</button>
        <p className="status" role="status" aria-live="polite">{message}</p>
      </form>
      <section className="card" aria-label="Mes pré-consultations">
        <div className="section-heading"><div><span className="eyebrow">Brouillons et clôturées</span><h2>Mes pré-consultations</h2></div><span className="count-badge">{items?.length ?? "…"}</span></div>
        {items === null ? <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /></div> : items.length === 0 ? <p className="empty">Aucune pré-consultation. Préparez-en une avant votre prochain rendez-vous.</p> : (
          <div className="stack">
            {items.map((item) => (
              <article className="record" key={item.id}>
                <div>
                  <strong>{item.reason}</strong>
                  <p className="muted">{item.facility_label || "Aucun établissement associé"}{item.closed_at ? ` · clôturée le ${new Date(item.closed_at).toLocaleDateString("fr-FR")}` : ""}</p>
                  {item.status === "draft" && <button type="button" className="button small" onClick={() => void close(item.id)}>Clôturer</button>}
                </div>
                <span className={item.status === "draft" ? "badge pending" : "badge measured"}>{item.status === "draft" ? "Brouillon" : item.provenance.label}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
