"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../infrastructure/api/client";
import { createLaboratory, isLabFeatureOff, listLaboratories, type CreatedLab, type EstablishmentLab } from "../application/lab-results";
import { accessMessage, loginUrlFor } from "../lib/share";
import { ShareCodeButton } from "./ShareCodeButton";
import "./lab-results.css";

/* PRO-21 — le laboratoire interne de l'établissement. L'administrateur de l'établissement ne saisit AUCUN nom de laboratoire : c'est son
   laboratoire interne. Il ajoute des administrateurs (prénom, nom, e-mail) ; chacun reçoit son propre accès, avec un mot de passe temporaire
   montré UNE SEULE FOIS, à transmettre hors application (icône Partager). Le responsable se connecte ensuite et arrive directement dans
   l'espace laboratoire : il ne voit aucun dossier médical. */

const ACCESS_LABEL: Record<string, string> = { temporary_password: "Mot de passe temporaire : pas encore connecté", expired: "Mot de passe temporaire expiré", activated: "Compte activé", revoked: "Accès retiré" };

export function EstablishmentLaboratories({ establishmentId }: { establishmentId: string }) {
  const [labs, setLabs] = useState<EstablishmentLab[] | null>(null);
  const [off, setOff] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedLab | null>(null);

  const failed = useCallback((reason: unknown) => {
    if (isLabFeatureOff(reason)) setOff(true); else setError(reason instanceof Error ? reason.message : "Laboratoire indisponible.");
  }, []);
  // Rechargement après un ajout d'administrateur.
  const reload = useCallback(async () => {
    try { setLabs(await listLaboratories(establishmentId)); setError(""); } catch (reason) { failed(reason); }
  }, [establishmentId, failed]);
  useEffect(() => {
    let active = true;
    listLaboratories(establishmentId).then((items) => { if (active) setLabs(items); }).catch((reason: unknown) => { if (active) failed(reason); });
    return () => { active = false; };
  }, [establishmentId, failed]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setCreated(null);
    try {
      const result = await createLaboratory(establishmentId, { admin_email: email.trim(), admin_first_name: firstName.trim(), admin_last_name: lastName.trim() });
      setCreated(result);
      setEmail(""); setFirstName(""); setLastName("");
      await reload();
    } catch (reason) {
      setError(reason instanceof ApiError || reason instanceof Error ? reason.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (off) return <p className="notice" role="status">Les laboratoires ne sont pas encore activés pour votre structure.</p>;
  const hasLab = Boolean(labs && labs.length > 0);
  const administratorCount = labs?.reduce((total, lab) => total + lab.administrators.length, 0) ?? 0;
  // Le laboratoire interne est le plus ancien ; les anciennes versions pouvaient en créer plusieurs, on les liste tous mais on ajoute au premier.
  const canAdd = !hasLab || Boolean(labs && labs[0].can_add_administrator);
  return <section className="card stack" aria-labelledby="labs-title">
    <div className="section-heading"><div><h2 id="labs-title">Laboratoire</h2></div><span className="count-badge" aria-label={`${administratorCount} administrateur${administratorCount > 1 ? "s" : ""}`}>{administratorCount}</span></div>
    <p className="muted">Un laboratoire reçoit le nom du patient et dépose ses résultats en PDF. Il n’a accès à aucun dossier médical.</p>
    {hasLab && labs && <ul className="stack" aria-label="Administrateurs du laboratoire">
      {labs.map((lab) => <li key={lab.id}><strong>{lab.name}</strong>
        {lab.administrators.length === 0
          ? <p className="muted">Aucun administrateur</p>
          : <ul className="stack lab-admins">{lab.administrators.map((admin) => <li key={admin.email}><span>{admin.name || "Administrateur"}</span><br /><span className="muted">{admin.email}{admin.access ? ` · ${ACCESS_LABEL[admin.access.state] ?? admin.access.state}` : ""}</span></li>)}</ul>}
      </li>)}
    </ul>}
    {canAdd
      ? <form className="stack" onSubmit={(event) => void submit(event)}>
        <h3>{hasLab ? "Ajouter un administrateur" : "Rattacher un laboratoire"}</h3>
        <div className="field-row">
          <label className="field"><span>Prénom de l’administrateur</span><input required maxLength={120} autoComplete="off" value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>
          <label className="field"><span>Nom de l’administrateur</span><input required maxLength={120} autoComplete="off" value={lastName} onChange={(event) => setLastName(event.target.value)} /></label>
        </div>
        <label className="field"><span>E-mail de l’administrateur du laboratoire (son identifiant de connexion)</span><input required type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <div className="actions"><button className="button primary" type="submit" disabled={busy || !firstName.trim() || !lastName.trim() || !email.trim()}>{busy ? "Création…" : hasLab ? "Créer son accès" : "Créer le laboratoire et son accès"}</button></div>
      </form>
      : <p className="notice" role="status">Le laboratoire a atteint le nombre maximum d’administrateurs.</p>}
    {error && <p className="status" role="alert">{error}</p>}
    {created && <div className="notice stack" role="status">
      <strong>Accès créé pour {created.email}.</strong>
      {created.temporary_password
        ? <>
          <p>Transmettez ce mot de passe temporaire à l’administrateur du laboratoire, par un canal sûr. Il ne sera plus jamais affiché ; il devra le changer à sa première connexion.</p>
          <div className="code-with-share">
            <span className="lab-secret">{created.temporary_password}</span>
            <ShareCodeButton title="le mot de passe temporaire du laboratoire" buildText={() => accessMessage({
              kind: "laboratory", structure: created.laboratory?.name ?? "Laboratoire", email: created.email, password: created.temporary_password ?? "",
              loginUrl: created.login_url ?? loginUrlFor(window.location.origin), expiresAt: created.expires_at,
            })} />
          </div>
        </>
        : <p>Le compte existant est utilisé : l’administrateur se connecte avec son mot de passe habituel.</p>}
    </div>}
  </section>;
}
