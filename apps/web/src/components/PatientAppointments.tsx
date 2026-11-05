"use client";
import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../infrastructure/api/client";

type Appointment = { id: string; reason: string; starts_at: string; status_label: string; status: string; establishment_name: string | null; professional_name: string | null; proposed_starts_at: string | null };
type Establishment = { id: string; name: string; city: string; type: string };
type Professional = { id: string; name: string; specialty: string };
type Options = { establishments: Establishment[]; professionals: Professional[] };

export function PatientAppointments() {
  const [items, setItems] = useState<Appointment[] | null>(null);
  const [options, setOptions] = useState<Options>({ establishments: [], professionals: [] });
  const [establishmentId, setEstablishmentId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [reason, setReason] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([apiGet<Appointment[]>("/api/v1/patient/care/appointments/"), apiGet<Options>("/api/v1/patient/care/appointments/options/")])
      .then(([appointments, catalog]) => { if (active) { setItems(appointments); setOptions(catalog); } })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Rendez-vous indisponibles."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!establishmentId) { setOptions((current) => ({ ...current, professionals: [] })); return; }
    apiGet<Options>(`/api/v1/patient/care/appointments/options/?establishment_id=${encodeURIComponent(establishmentId)}`)
      .then((catalog) => setOptions(catalog)).catch(() => setOptions((current) => ({ ...current, professionals: [] })));
    setProfessionalId("");
  }, [establishmentId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const created = await apiPost<Appointment>("/api/v1/patient/care/appointments/", { establishment: establishmentId, professional: professionalId, reason, starts_at: new Date(startsAt).toISOString() });
      setItems((current) => [created, ...(current ?? [])]); setReason(""); setStartsAt(""); setMessage("Demande enregistrée. Elle sera confirmée par le professionnel.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Demande impossible."); }
    finally { setBusy(false); }
  }

  async function cancel(id: string) {
    const reason = window.prompt("Motif de l’annulation");
    if (!reason?.trim()) return;
    try { const updated = await apiPost<Appointment>(`/api/v1/patient/care/appointments/${id}/`, { action: "cancel", reason }); setItems((current) => (current ?? []).map((item) => item.id === id ? updated : item)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Annulation impossible."); }
  }

  async function confirmProposal(id: string) {
    try { const updated = await apiPost<Appointment>(`/api/v1/patient/care/appointments/${id}/`, { action: "confirm-proposal" }); setItems((current) => (current ?? []).map((item) => item.id === id ? updated : item)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Confirmation impossible."); }
  }

  return <section className="card" aria-labelledby="appointments-title">
    <div className="section-heading"><div><span className="eyebrow">Organisation des soins</span><h2 id="appointments-title">Rendez-vous</h2></div></div>
    <form className="patient-grid" onSubmit={submit}>
      <label className="field"><span>Établissement</span><select required value={establishmentId} onChange={(event) => setEstablishmentId(event.target.value)}><option value="">Choisir un établissement</option>{options.establishments.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.city}</option>)}</select></label>
      <label className="field"><span>Professionnel</span><select required disabled={!establishmentId} value={professionalId} onChange={(event) => setProfessionalId(event.target.value)}><option value="">Choisir un professionnel</option>{options.professionals.map((item) => <option key={item.id} value={item.id}>{item.name}{item.specialty ? ` · ${item.specialty}` : ""}</option>)}</select></label>
      <label className="field"><span>Motif</span><input required maxLength={240} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <label className="field"><span>Date et heure souhaitées</span><input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
      <button className="button primary" disabled={busy}>Demander un rendez-vous</button>
    </form>
    <p className="status" role="status">{message}</p>
    <div className="stack">{items?.map((item) => <article className="record" key={item.id}><div><strong>{item.reason}</strong><p className="muted">{new Date(item.starts_at).toLocaleString("fr-FR")} · {item.status_label} · {item.professional_name ?? "Professionnel à confirmer"}</p>{item.proposed_starts_at && <p className="notice">Nouveau créneau proposé : {new Date(item.proposed_starts_at).toLocaleString("fr-FR")}</p>}</div><div className="cluster">{item.proposed_starts_at && item.status === "requested" && <button className="button small" onClick={() => confirmProposal(item.id)}>Confirmer le créneau</button>}{["requested", "confirmed"].includes(item.status) && <button className="button small" onClick={() => cancel(item.id)}>Annuler</button>}</div></article>)}</div>
  </section>;
}
