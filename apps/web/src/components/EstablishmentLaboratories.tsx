"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../infrastructure/api/client";
import { createLaboratory, isLabFeatureOff, listLaboratories, type CreatedLab, type EstablishmentLab } from "../application/lab-results";
import "./lab-results.css";

/* PRO-21 — l'administrateur de l'établissement rattache ses laboratoires : nom + e-mail de l'administrateur du laboratoire.
   Le compte est créé tout de suite, avec un mot de passe temporaire montré UNE SEULE FOIS, à transmettre hors application. Ce responsable se
   connecte ensuite et arrive directement dans l'espace laboratoire : il ne voit aucun dossier médical. */

const ACCESS_LABEL: Record<string, string> = { temporary_password: "Mot de passe temporaire : pas encore connecté", expired: "Mot de passe temporaire expiré", activated: "Compte activé", revoked: "Accès retiré" };

export function EstablishmentLaboratories({ establishmentId }: { establishmentId: string }) {
  const [labs, setLabs] = useState<EstablishmentLab[] | null>(null);
  const [off, setOff] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedLab | null>(null);

  const load = useCallback(async () => {
    try { setLabs(await listLaboratories(establishmentId)); setError(""); } catch (reason) {
      if (isLabFeatureOff(reason)) setOff(true); else setError(reason instanceof Error ? reason.message : "Laboratoires indisponibles.");
    }
  }, [establishmentId]);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setCreated(null);
    try {
      const result = await createLaboratory(establishmentId, { name: name.trim(), admin_email: email.trim(), admin_first_name: firstName.trim(), admin_last_name: lastName.trim() });
      setCreated(result);
      setName(""); setEmail(""); setFirstName(""); setLastName("");
      await load();
    } catch (reason) {
      setError(reason instanceof ApiError || reason instanceof Error ? reason.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (off) return <p className="notice" role="status">Les laboratoires ne sont pas encore activés pour votre structure.</p>;
  return <section className="card stack" aria-labelledby="labs-title">
    <div className="section-heading"><div><h2 id="labs-title">Laboratoires</h2></div><span className="count-badge">{labs?.length ?? 0}</span></div>
    <p className="muted">Un laboratoire reçoit le nom du patient et dépose ses résultats en PDF. Il n’a accès à aucun dossier médical.</p>
    {labs && labs.length > 0 && <ul className="stack" aria-label="Laboratoires rattachés">
      {labs.map((lab) => <li key={lab.id}><strong>{lab.name}</strong><br /><span className="muted">{lab.administrator ? `${lab.administrator.name || "Administrateur"} · ${lab.administrator.email}` : "Aucun administrateur"}{lab.access ? ` · ${ACCESS_LABEL[lab.access.state] ?? lab.access.state}` : ""}</span></li>)}
    </ul>}
    <form className="stack" onSubmit={(event) => void submit(event)}>
      <h3>Rattacher un laboratoire</h3>
      <label className="field"><span>Nom du laboratoire</span><input required maxLength={180} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <div className="field-row">
        <label className="field"><span>Prénom de l’administrateur</span><input maxLength={120} value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>
        <label className="field"><span>Nom de l’administrateur</span><input maxLength={120} value={lastName} onChange={(event) => setLastName(event.target.value)} /></label>
      </div>
      <label className="field"><span>E-mail de l’administrateur du laboratoire (son identifiant de connexion)</span><input required type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <div className="actions"><button className="button primary" type="submit" disabled={busy || !name.trim() || !email.trim()}>{busy ? "Création…" : "Créer le laboratoire et son accès"}</button></div>
    </form>
    {error && <p className="status" role="alert">{error}</p>}
    {created && <div className="notice stack" role="status">
      <strong>Accès créé pour {created.email}.</strong>
      {created.temporary_password
        ? <><p>Transmettez ce mot de passe temporaire à l’administrateur du laboratoire, par un canal sûr. Il ne sera plus jamais affiché ; il devra le changer à sa première connexion.</p><span className="lab-secret">{created.temporary_password}</span></>
        : <p>Le compte existant est utilisé : l’administrateur se connecte avec son mot de passe habituel.</p>}
    </div>}
  </section>;
}
