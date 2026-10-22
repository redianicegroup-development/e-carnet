"use client";

import { useEffect, useState } from "react";
import { confirmProfessionalVaccination, listProfessionalGrants, listProfessionalVaccinations, type ProfessionalGrant, type ProfessionalVaccination } from "../application/professional-access-grants";

const date = (value: string | null) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR") : "Non renseignée";

export function ProfessionalVaccinations() {
  const [grants, setGrants] = useState<ProfessionalGrant[] | null>(null);
  const [grantId, setGrantId] = useState("");
  const [result, setResult] = useState<{ grantId: string; items: ProfessionalVaccination[] } | null>(null);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    listProfessionalGrants().then((all) => {
      if (!active) return;
      const eligible = all.filter((grant) => grant.status === "active" && grant.scope.includes("declarations"));
      setGrants(eligible);
      setGrantId((current) => eligible.some((grant) => grant.id === current) ? current : eligible[0]?.id ?? "");
    }).catch((reason) => {
      if (active) { setGrants([]); setError(reason instanceof Error ? reason.message : "Autorisations indisponibles."); }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!grantId) return;
    let active = true;
    listProfessionalVaccinations(grantId).then((items) => { if (active) setResult({ grantId, items }); }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : "Vaccinations indisponibles pour cette autorisation.");
    });
    return () => { active = false; };
  }, [grantId]);

  async function confirm(item: ProfessionalVaccination) {
    const message = item.document_id
      ? "Confirmez uniquement après avoir consulté le justificatif joint ou vérifié le carnet papier. Cette action enregistrera votre compte professionnel, la date et l’autorisation utilisée."
      : "Confirmez uniquement après avoir vérifié le carnet papier ou une preuve présentée par le patient. Cette action enregistrera votre compte professionnel, la date et l’autorisation utilisée.";
    if (!window.confirm(message)) return;
    setBusyId(item.id); setError(""); setMessage("");
    try {
      const updated = await confirmProfessionalVaccination(grantId, item.id);
      setResult((current) => current?.grantId === grantId ? { ...current, items: current.items.map((row) => row.id === updated.id ? updated : row) } : current);
      setMessage("Vaccination confirmée et action inscrite au journal d’audit.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Confirmation impossible.");
    } finally {
      setBusyId("");
    }
  }

  const selected = grants?.find((grant) => grant.id === grantId);
  const canReadDocuments = Boolean(selected?.scope.includes("documents"));
  const items = result?.grantId === grantId ? result.items : null;

  /* Rendu dans une rubrique pliable « Vaccinations à confirmer » (page Suivi) : le titre est celui du bouton de la rubrique. */
  return <div className="stack" id="vaccinations">
    <p className="muted">Le patient peut déclarer une vaccination et joindre un justificatif. Confirmez uniquement après vérification du carnet ou de la pièce, dans le périmètre de son autorisation active.</p>
    {grants === null ? <p className="empty">Chargement des autorisations…</p> : grants.length === 0 ? <p className="empty">Aucun accès actif avec le périmètre déclarations.</p> : <label className="field"><span>Autorisation patient active</span><select value={grantId} onChange={(event) => { setError(""); setMessage(""); setGrantId(event.target.value); }}>{grants.map((grant) => <option key={grant.id} value={grant.id}>{grant.facility_label} · accès {grant.reference}</option>)}</select></label>}
    {error && <p className="status error" role="alert">{error}</p>}
    {message && <p className="status success" role="status" aria-live="polite">{message}</p>}
    {items === null && grantId && <p className="empty">Chargement du carnet partagé…</p>}
    {items && grantId && items.length === 0 && <p className="empty">Aucune vaccination renseignée pour cette autorisation.</p>}
    {items && items.length > 0 && <div className="stack" aria-live="polite">{items.map((item) => <article className="record" key={item.id}>
      <div><strong>{item.vaccine_name}{item.dose_number ? ` · dose ${item.dose_number}` : ""}</strong><p className="muted">Administration : {date(item.administered_on)}{item.facility ? ` · ${item.facility}` : ""}</p>
        {item.next_due_on && <small className="muted">Rappel indiqué : {date(item.next_due_on)}</small>}
        {item.document_id && (canReadDocuments
          ? <small className="muted"><br /><a href={`/api/v1/patient/care/professional/access-grants/${grantId}/documents/${item.document_id}/download/`} target="_blank" rel="noreferrer">Consulter le justificatif partagé</a></small>
          : <small className="muted"><br />Justificatif joint, mais le périmètre documents n’est pas accordé.</small>)}
        {item.confirmed_by_name && item.confirmed_at && <small className="muted"><br />Confirmée par {item.confirmed_by_name} le {new Date(item.confirmed_at).toLocaleDateString("fr-FR")}</small>}
        {item.status !== "confirmed" && <div className="actions"><button className="button small" type="button" disabled={busyId === item.id || Boolean(item.document_id && !canReadDocuments)} title={item.document_id && !canReadDocuments ? "Le patient doit aussi autoriser le périmètre documents pour que vous puissiez consulter la pièce." : undefined} onClick={() => confirm(item)}>{busyId === item.id ? "Confirmation…" : "Confirmer après vérification"}</button></div>}
      </div><span className={`badge ${item.status === "confirmed" ? "verified" : item.status === "documented" ? "pending" : "declared"}`}>{item.status_label}</span>
    </article>)}</div>}
  </div>;
}
