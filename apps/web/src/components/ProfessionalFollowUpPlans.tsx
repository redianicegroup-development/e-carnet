"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "../infrastructure/api/client";
import { listProfessionalGrants, type ProfessionalGrant } from "../application/professional-access-grants";

type Item = { id: string; measurement_kind_label: string; frequency: string; target: string; notes: string };
type Revision = { action: string; snapshot: { objective?: string; status?: string }; created_at: string };
type Plan = { id: string; access_grant: string | null; objective: string; title: string; instructions: string; status: "active" | "paused" | "completed" | "cancelled"; items: Item[]; history: Revision[]; professional_name: string | null; establishment_name: string | null };

const STATUS_LABELS = { active: "Actif", paused: "En pause", completed: "Terminé", cancelled: "Annulé" } as const;

export function ProfessionalFollowUpPlans() {
  const [grants, setGrants] = useState<ProfessionalGrant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [grantId, setGrantId] = useState("");
  const [objective, setObjective] = useState("");
  const [frequency, setFrequency] = useState("");
  const [measurementKind, setMeasurementKind] = useState("weight");
  const [status, setStatus] = useState<Plan["status"]>("active");
  const [message, setMessage] = useState("Chargement des plans de suivi…");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([listProfessionalGrants(), apiGet<Plan[]>("/api/v1/patient/care/professional/follow-up-plans/")]).then(([allGrants, allPlans]) => {
      if (!active) return;
      setGrants(allGrants.filter((grant) => grant.status === "active" && grant.scope.includes("consultations")));
      setPlans(allPlans);
      setMessage("Les plans de suivi sont à jour.");
    }).catch(() => active && setMessage("Impossible de charger les plans de suivi."));
    return () => { active = false; };
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!grantId || !objective.trim() || !frequency.trim()) { setMessage("Choisissez une autorisation et renseignez l’objectif et la fréquence."); return; }
    setBusy(true);
    try {
      const plan = await apiPost<Plan>("/api/v1/patient/care/professional/follow-up-plans/", {
        access_grant_id: grantId,
        objective: objective.trim(),
        status,
        items: [{ measurement_kind: measurementKind, frequency: frequency.trim() }],
      });
      setPlans((current) => [plan, ...current]);
      setObjective(""); setFrequency(""); setGrantId("");
      setMessage("Plan de suivi créé. Son historique est conservé.");
    } catch { setMessage("Création impossible : vérifiez l’autorisation et le périmètre consultations."); }
    finally { setBusy(false); }
  }

  async function updateStatus(plan: Plan, next: Plan["status"]) {
    const grant = grants.find((item) => item.id === plan.access_grant);
    if (!grant) { setMessage("Aucune autorisation active ne permet de modifier ce plan."); return; }
    try {
      const updated = await apiPatch<Plan>(`/api/v1/patient/care/professional/follow-up-plans/${plan.id}/`, { access_grant_id: grant.id, status: next });
      setPlans((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch { setMessage("Mise à jour du statut impossible."); }
  }

  return <section className="card" aria-labelledby="professional-follow-up-title">
    <div className="section-heading"><div><span className="eyebrow">PRO-12 · PAT-15</span><h2 id="professional-follow-up-title">Plans de suivi</h2></div><span className="count-badge">{plans.length}</span></div>
    <p className="muted">Créez un objectif de suivi pour un patient autorisé. La fréquence, le statut et chaque évolution restent visibles dans l’historique.</p>
    <form className="stack" onSubmit={create}>
      <label className="field"><span>Patient / autorisation active</span><select value={grantId} onChange={(event) => setGrantId(event.target.value)}><option value="">Choisir une autorisation</option>{grants.map((grant) => <option key={grant.id} value={grant.id}>{grant.facility_label} · accès {grant.reference}</option>)}</select></label>
      <label className="field"><span>Objectif du plan</span><input maxLength={500} value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="Ex. Suivre le poids et la tension" /></label>
      <div className="patient-grid"><label className="field"><span>Mesure suivie</span><select value={measurementKind} onChange={(event) => setMeasurementKind(event.target.value)}><option value="weight">Poids</option><option value="blood_pressure">Tension</option><option value="glycemia">Glycémie</option><option value="temperature">Température</option><option value="heart_rate">Pouls</option><option value="spo2">Saturation SpO₂</option></select></label><label className="field"><span>Fréquence</span><input maxLength={120} value={frequency} onChange={(event) => setFrequency(event.target.value)} placeholder="Ex. chaque semaine" /></label><label className="field"><span>Statut initial</span><select value={status} onChange={(event) => setStatus(event.target.value as Plan["status"])}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <button className="button primary" type="submit" disabled={busy}>{busy ? "Création…" : "Créer le plan de suivi"}</button>
    </form>
    <p className="notice" role="status" aria-live="polite">{message}</p>
    {plans.length > 0 && <div className="stack">{plans.map((plan) => <article className="record" key={plan.id}><div><strong>{plan.objective || plan.title}</strong><p className="muted">{plan.items.map((item) => `${item.measurement_kind_label} · ${item.frequency}`).join(" · ")}</p><small className="muted">Historique : {plan.history.length} événement(s) · dernière mise à jour {plan.history[0] ? new Date(plan.history[0].created_at).toLocaleString("fr-FR") : "—"}</small></div><label className="field"><span className="sr-only">Statut</span><select value={plan.status} onChange={(event) => updateStatus(plan, event.target.value as Plan["status"])}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></article>)}</div>}
  </section>;
}
