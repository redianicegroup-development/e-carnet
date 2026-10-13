"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "../infrastructure/api/client";
import { Encounter, listAuthorizedEncounters, listProfessionalConsultations, listProfessionalGrants, ProfessionalGrant, Consultation, validateProfessionalConsultation } from "../application/professional-access-grants";

const MOCK_CONSULTATIONS: Consultation[] = [];

export function ProfessionalConsultations() {
  const [grants, setGrants] = useState<ProfessionalGrant[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>(MOCK_CONSULTATIONS);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [grantId, setGrantId] = useState("");
  const [encounterId, setEncounterId] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [carePlan, setCarePlan] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingEncounters, setLoadingEncounters] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("Chargement des autorisations actives…");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editing = target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "");
      if (event.key === "/" && !editing && window.matchMedia("(min-width: 920px)").matches) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === searchRef.current) {
        setSearch("");
        searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([listProfessionalGrants(), listProfessionalConsultations()]).then(([allGrants, allConsultations]) => {
      if (!active) return;
      setGrants(allGrants.filter((grant) => grant.status === "active" && grant.scope.includes("preconsultation")));
      setConsultations(allConsultations);
      setMessage("Données chargées.");
    }).catch((error: unknown) => {
      if (active) setMessage(error instanceof ApiError ? error.message : "Impossible de charger les consultations.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function chooseGrant(value: string) {
    setGrantId(value);
    setEncounterId("");
    setEncounters([]);
    if (!value) return;
    setLoadingEncounters(true);
    try {
      setEncounters(await listAuthorizedEncounters(value));
      setMessage("Pré-consultations autorisées chargées.");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Pré-consultations indisponibles.");
    } finally {
      setLoadingEncounters(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!grantId || !encounterId || !conclusion.trim()) return;
    setSubmitting(true);
    try {
      const consultation = await validateProfessionalConsultation({ access_grant_id: grantId, source_encounter_id: encounterId, conclusion, care_plan: carePlan, attestation_svg: "<svg></svg>" });
      setConsultations((current) => [consultation, ...current]);
      setConclusion("");
      setCarePlan("");
      setMessage("Consultation validée et conservée dans l’historique.");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Validation impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  const filteredConsultations = consultations.filter((item) => `${item.patient_id ?? ""} ${item.facility_label} ${item.reason} ${item.professional_name}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  return <div className="stack-lg"><section className="hero-page"><span className="eyebrow">Provenance conservée</span><h1>Compléter sans ressaisir.</h1><p className="muted">La pré-consultation clôturée est reprise depuis l’AccessGrant actif. L’auteur et l’établissement sont imposés par le serveur ; le patient conserve l’original.</p><p className="notice" role="status" aria-live="polite">{message}</p></section><section className="patient-grid"><form className="card" onSubmit={submit}><span className="eyebrow">Nouvelle validation</span><h2>Créer la consultation</h2>{loading ? <p className="empty">Chargement des autorisations…</p> : grants.length === 0 ? <p className="empty">Aucune autorisation active permettant de reprendre une pré-consultation.</p> : <><label className="field"><span>Autorisation active</span><select required value={grantId} onChange={(event) => chooseGrant(event.target.value)}><option value="">Choisir une autorisation</option>{grants.map((grant) => <option key={grant.id} value={grant.id}>{grant.facility_label} · patient {grant.patient_id.slice(0, 8)}</option>)}</select></label><label className="field"><span>Pré-consultation clôturée</span><select required value={encounterId} onChange={(event) => setEncounterId(event.target.value)} disabled={!grantId || loadingEncounters}><option value="">{loadingEncounters ? "Chargement…" : "Choisir une pré-consultation"}</option>{encounters.map((encounter) => <option key={encounter.id} value={encounter.id}>{encounter.reason || "Sans motif"}</option>)}</select></label><label className="field"><span>Conclusion</span><textarea required maxLength={4000} rows={4} value={conclusion} onChange={(event) => setConclusion(event.target.value)} /></label><label className="field"><span>Conduite à tenir</span><textarea maxLength={4000} rows={4} value={carePlan} onChange={(event) => setCarePlan(event.target.value)} /></label><p className="muted">Une attestation SVG est enregistrée avec la validation. Elle ne constitue pas une signature électronique qualifiée.</p><button className="button primary" type="submit" disabled={submitting}>{submitting ? "Validation…" : "Valider la consultation"}</button></>}</form><section className="card professional-history"><div className="professional-history__heading"><div><span className="eyebrow">Historique</span><h2>Mes consultations</h2></div><label className="professional-quick-search"><span className="sr-only">Rechercher patient, établissement ou motif</span><input ref={searchRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Patient, établissement, motif…" /><kbd aria-hidden="true">/</kbd></label></div>{loading ? <p className="empty">Chargement…</p> : filteredConsultations.length === 0 ? <p className="empty">{consultations.length ? "Aucun résultat pour cette recherche." : "Aucune consultation validée."}</p> : <div className="professional-compact-list" aria-live="polite">{filteredConsultations.map((item) => <article className="professional-compact-record" key={item.id}><div><strong>{item.reason}</strong><p>{item.facility_label} · {item.provenance.label}{item.patient_id ? ` · patient ${item.patient_id.slice(0, 8)}` : ""}</p></div><span className="badge verified">Validée</span></article>)}</div>}</section></section></div>;
}
