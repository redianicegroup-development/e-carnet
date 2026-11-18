"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../infrastructure/api/client";
import { createLaboratory, isLabFeatureOff, listLaboratories, revokeLaboratoryAdministrator, type CreatedLab, type EstablishmentLab, type LabAdministrator } from "../application/lab-results";
import { accessMessage, loginUrlFor } from "../lib/share";
import { ShareCodeButton } from "./ShareCodeButton";
import { ProfileSheet, type ProfileRow } from "./ui/ProfileSheet";
import { RevocationReasonDialog } from "./modal/RevocationReasonDialog";
import "./lab-results.css";

/* PRO-21 — le laboratoire interne de l'établissement. L'administrateur de l'établissement ne saisit AUCUN nom de laboratoire : c'est son
   laboratoire interne. Il ajoute des administrateurs (prénom, nom, e-mail) ; chacun reçoit son propre accès, avec un mot de passe temporaire
   montré UNE SEULE FOIS, à transmettre hors application (icône Partager). Le responsable se connecte ensuite et arrive directement dans
   l'espace laboratoire : il ne voit aucun dossier médical. */

const ACCESS_LABEL: Record<string, string> = { temporary_password: "Mot de passe temporaire : pas encore connecté", expired: "Mot de passe temporaire expiré", activated: "Compte activé", revoked: "Accès retiré" };

type ProfileTarget = { lab: EstablishmentLab; admin: LabAdministrator };

/* Fiche « Profil » d'un administrateur du laboratoire : prénom, nom, e-mail, état de l'accès. L'établissement peut y révoquer l'accès (avec motif).
   Même fiche que partout ailleurs (ProfileSheet) : les boutons d'action restent en bas. */
function AdministratorProfile({ admin, onClose, onRevoke }: { admin: LabAdministrator; onClose: () => void; onRevoke: () => void }) {
  const rows: ProfileRow[] = [
    { label: "Prénom", value: admin.first_name || "Non renseigné" },
    { label: "Nom", value: admin.last_name || "Non renseigné" },
    { label: "E-mail (identifiant de connexion)", value: admin.email },
    { label: "Accès", value: admin.access ? ACCESS_LABEL[admin.access.state] ?? admin.access.state : "Compte activé" },
  ];
  return <ProfileSheet name={admin.name || "Administrateur"} subtitle="Administrateur du laboratoire" rows={rows} onClose={onClose} actions={[{ label: "Révoquer", tone: "danger", onClick: () => onRevoke() }]} />;
}

export function EstablishmentLaboratories({ establishmentId }: { establishmentId: string }) {
  const [labs, setLabs] = useState<EstablishmentLab[] | null>(null);
  const [off, setOff] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedLab | null>(null);
  const [profile, setProfile] = useState<ProfileTarget | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ProfileTarget | null>(null);
  const [revokedNotice, setRevokedNotice] = useState("");

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
          : <ul className="stack lab-admins">{lab.administrators.map((admin) => <li key={admin.id} className="lab-admin-row"><span>{admin.name || "Administrateur"}</span><button type="button" className="button small" onClick={() => setProfile({ lab, admin })}>Profil</button></li>)}</ul>}
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
    {revokedNotice && <p className="notice" role="status">{revokedNotice}</p>}
    {profile && !revokeTarget && <AdministratorProfile admin={profile.admin} onClose={() => setProfile(null)} onRevoke={() => { setRevokeTarget(profile); setProfile(null); }} />}
    {revokeTarget && <RevocationReasonDialog
      title="Révoquer cet administrateur ?"
      message={`${revokeTarget.admin.name || "Cet administrateur"} ne pourra plus utiliser l’espace du ${revokeTarget.lab.name}.`}
      note="L’historique des résultats déposés est conservé."
      onCancel={() => setRevokeTarget(null)}
      onSubmit={async (reason) => {
        await revokeLaboratoryAdministrator(establishmentId, revokeTarget.lab.id, revokeTarget.admin.id, reason);
        setRevokeTarget(null);
        setRevokedNotice("Accès retiré. L’administrateur verra le motif à sa prochaine connexion.");
        setCreated(null);
        await reload();
      }}
    />}
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
