"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "../infrastructure/api/client";
import { PageHeader } from "./ui/PageHeader";
import { MedicalDocuments } from "./MedicalDocuments";
import { Vaccinations } from "./Vaccinations";
import { HealthMeasurements } from "./HealthMeasurements";
import { MedicationReminders } from "./MedicationReminders";
import { FollowUpPlans } from "./FollowUpPlans";
import { PatientAppointments } from "./PatientAppointments";
import { CollapsibleSection } from "./ui/CollapsibleSection";
import { PatientPreconsultations } from "./PatientPreconsultations";

type Declaration = { id: string; kind: string; label: string; details: string; provenance: { label: string } };
type Kind = "allergy" | "antecedent" | "treatment" | "blood_group" | "city" | "emergency_contact" | "height" | "weight";
type FormState = { kind: Kind; label: string; details: string };

const KINDS: Record<Kind, string> = { allergy: "Allergie", antecedent: "Antécédent", treatment: "Traitement", blood_group: "Groupe sanguin", city: "Ville", emergency_contact: "Contact d’urgence", height: "Taille", weight: "Poids" };
const BLOOD_GROUPS = ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−", "Inconnu"];
/* Une seule valeur active à la fois : la nouvelle remplace l’ancienne (comme côté serveur, ClinicalDeclaration.SINGLETON_KINDS). */
const SINGLETON: Kind[] = ["blood_group", "city", "emergency_contact", "height", "weight"];
/* Ce que la carte d’urgence affiche : c’est ici, dans le carnet, qu’on le modifie. */
const CARD_FIELDS: { kind: Kind; label: string }[] = [
  { kind: "blood_group", label: "Groupe sanguin" },
  { kind: "city", label: "Ville" },
  { kind: "emergency_contact", label: "Contact d’urgence" },
];
const isKind = (value: string | null): value is Kind => !!value && value in KINDS;

export function PatientCarnet() {
  const [items, setItems] = useState<Declaration[] | null>(null);
  const [form, setForm] = useState<FormState>({ kind: "allergy", label: "", details: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const itemsRef = useRef<Declaration[] | null>(null);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const current = (kind: Kind) => (items ?? []).find((item) => item.kind === kind);

  /** Ouvre le formulaire sur un type, avec la valeur actuelle pour les informations uniques (modifier plutôt que ressaisir). */
  function chooseKind(kind: Kind, source: Declaration[] | null = itemsRef.current) {
    const existing = SINGLETON.includes(kind) ? (source ?? []).find((item) => item.kind === kind) : undefined;
    setForm({ kind, label: existing?.label ?? "", details: existing?.details ?? "" });
    setMessage("");
  }

  useEffect(() => {
    let active = true;
    apiGet<Declaration[]>("/api/v1/patient/declarations/")
      .then((data) => {
        if (!active) return;
        setItems(data);
        // « Modifier ma carte » (Mon compte) arrive ici avec ?ajouter=city|emergency_contact|blood_group.
        const wanted = new URLSearchParams(window.location.search).get("ajouter");
        if (isKind(wanted)) {
          chooseKind(wanted, data);
          window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
        }
      })
      .catch((error) => { if (active) { setItems([]); setMessage(error instanceof Error ? error.message : "Impossible de charger le carnet."); } });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chargement unique ; chooseKind lit la liste via itemsRef
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.label.trim()) return;
    if (form.kind === "emergency_contact" && !form.details.trim()) { setMessage("Indiquez le téléphone du contact d’urgence."); return; }
    setBusy(true);
    setMessage("");
    try {
      const created = await apiPost<Declaration>("/api/v1/patient/declarations/", { kind: form.kind, label: form.label.trim(), details: form.details.trim() });
      const replaces = SINGLETON.includes(form.kind);
      setItems((list) => [created, ...(list ?? []).filter((item) => item.id !== created.id && (!replaces || item.kind !== form.kind))]);
      setForm(replaces ? { kind: form.kind, label: created.label, details: created.details } : { ...form, label: "", details: "" });
      setMessage(replaces ? "Enregistré. Votre carte d’urgence est à jour." : "Déclaration ajoutée. Elle reste marquée « déclarée par vous ».");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Déclaration refusée.");
    } finally { setBusy(false); }
  }

  const unique = SINGLETON.includes(form.kind);
  const freeText = form.kind === "allergy" || form.kind === "antecedent" || form.kind === "treatment";
  const physicalKind = form.kind === "height" || form.kind === "weight";
  return (
    <div className="stack-lg">
      <PageHeader eyebrow="Mon carnet" title="Ce que je déclare" lead="Chaque information garde sa provenance : déclarée par vous, jamais présentée comme confirmée tant qu’un médecin ne l’a pas validée." />

      <CollapsibleSection title="Informations de ma carte virtuelle">
      <section id="carte-urgence" className="card carnet-card-fields" aria-labelledby="card-fields-title">
        <div className="section-heading"><div><h2 id="card-fields-title">Ce que la carte affiche</h2></div></div>
        <p className="muted">Ces informations alimentent votre carte d’urgence. Modifiez-les ici : la carte et son QR se mettent à jour tout seuls.</p>
        <ul className="carnet-card-fields__list">
          {CARD_FIELDS.map((field) => {
            const value = current(field.kind);
            return <li key={field.kind}>
              <span className="carnet-card-fields__name">{field.label}</span>
              <span className={value ? "carnet-card-fields__value" : "carnet-card-fields__value is-empty"}>{value ? (field.kind === "emergency_contact" ? `${value.label} · ${value.details}` : value.label) : "À renseigner"}</span>
              <button type="button" className="button small" onClick={() => { chooseKind(field.kind); formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>{value ? "Modifier" : "Renseigner"}</button>
            </li>;
          })}
        </ul>
      </section>
      </CollapsibleSection>

      <CollapsibleSection title="Déclarations et mesures de santé">
      <div className="patient-grid">
        <form className="card" onSubmit={submit} ref={formRef} id="ajouter">
          <span className="eyebrow">{unique && current(form.kind) ? "Modifier" : "Ajouter"}</span>
          <h2>{unique ? KINDS[form.kind] : "Une déclaration"}</h2>
          <label className="field"><span>Type</span><select value={form.kind} onChange={(event) => chooseKind(event.target.value as Kind)}>{(Object.entries(KINDS) as [Kind, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {form.kind === "blood_group" && <label className="field"><span>Groupe sanguin déclaré</span><select required value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })}><option value="">Choisir un groupe</option>{BLOOD_GROUPS.map((group) => <option key={group} value={group}>{group}</option>)}</select></label>}
          {form.kind === "city" && <label className="field"><span>Ville</span><input required maxLength={120} autoComplete="address-level2" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="Ex. Abidjan" /></label>}
          {form.kind === "emergency_contact" && <>
            <label className="field"><span>Nom du contact d’urgence</span><input required maxLength={120} autoComplete="off" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="Ex. Awa Koné (sœur)" /></label>
            <label className="field"><span>Téléphone du contact</span><input required type="tel" inputMode="tel" maxLength={32} autoComplete="off" value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} placeholder="+225 07 00 00 00 00" /></label>
          </>}
          {freeText && <label className="field"><span>Nom ou libellé</span><input required maxLength={160} value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="Ex. allergie connue" /></label>}
          {physicalKind && <label className="field"><span>{form.kind === "height" ? "Taille (cm)" : "Poids (kg)"}</span><input required type="number" inputMode="decimal" min={form.kind === "height" ? "30" : "1"} max={form.kind === "height" ? "250" : "500"} step="0.1" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder={form.kind === "height" ? "Ex. 170" : "Ex. 65"} /></label>}
          {(freeText || form.kind === "blood_group") && <label className="field"><span>Détails (facultatif)</span><textarea maxLength={500} value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} /></label>}
          <button className="button primary" type="submit" disabled={busy}>{busy ? "Enregistrement…" : unique ? "Enregistrer" : "Ajouter à mon carnet"}</button>
          <p className="status" role="status" aria-live="polite">{message}</p>
        </form>

        <section className="card" aria-label="Mes déclarations">
          <div className="section-heading"><div><span className="eyebrow">Provenance visible</span><h2>Mes déclarations</h2></div><span className="count-badge">{items?.length ?? "…"}</span></div>
          {items === null ? <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /></div> : items.length === 0 ? <p className="empty">Aucune déclaration pour le moment. Vous gardez la main sur ce que vous ajoutez.</p> : (
            <div className="stack">
              {items.map((item) => (
                <article className="record declaration" key={item.id}>
                  <div className="declaration__body">
                    <span className="declaration__kind">{KINDS[item.kind as Kind] ?? "Antécédent"}</span>
                    <strong className="declaration__label">{item.label}</strong>
                    {item.details && (item.kind === "emergency_contact" ? <p className="declaration__details"><a href={`tel:${item.details.replace(/[^+\d]/g, "")}`}>{item.details}</a></p> : <p className="muted declaration__details">{item.details}</p>)}
                  </div>
                  {/* La provenance passe sous le texte et garde toujours sa forme, quelle que soit la longueur de la déclaration. */}
                  <span className="badge declared">{item.provenance.label}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      <HealthMeasurements />
      </CollapsibleSection>
      <CollapsibleSection title="Mes documents" solo><MedicalDocuments /></CollapsibleSection>
      <CollapsibleSection title="Mes vaccins" solo><Vaccinations /></CollapsibleSection>
      <CollapsibleSection title="Rappels de médicaments" solo><MedicationReminders /></CollapsibleSection>
      <CollapsibleSection title="Mes plans de suivi" solo><FollowUpPlans /></CollapsibleSection>
      <CollapsibleSection title="Rendez-vous" solo><PatientAppointments /></CollapsibleSection>
      <PatientPreconsultations />
      <CollapsibleSection title="Exporter mon carnet"><section className="card"><div className="section-heading"><div><span className="eyebrow">Portabilité</span></div></div><p className="muted">Téléchargez une copie PDF volontaire de vos déclarations, vaccinations et mesures récentes.</p><a className="button" href="/api/v1/patient/care/export/">Télécharger mon carnet PDF</a></section></CollapsibleSection>
    </div>
  );
}
