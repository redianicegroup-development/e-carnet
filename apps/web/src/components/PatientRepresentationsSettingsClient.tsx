"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiDelete, apiGet, apiPatch, apiPost } from "../infrastructure/api/client";
import { errorReason } from "../lib/access-outcome";
import { useConfirm } from "./modal/ConfirmProvider";
import { OutcomeDialog, type OutcomeDialogProps } from "./modal/OutcomeDialog";

type Representation = {
  id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  relationship: string;
  status: "active" | "revoked" | "transferred";
  transfer_status: string | null;
  is_active: boolean;
};

const CREATE_ERROR_FALLBACK = "Le profil n’a pas pu être créé. Vérifiez les informations saisies et réessayez.";

export function PatientRepresentationsSettingsClient() {
  const confirm = useConfirm();
  const [outcome, setOutcome] = useState<Omit<OutcomeDialogProps, "onClose"> | null>(null);
  const [items, setItems] = useState<Representation[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [relationship, setRelationship] = useState("child");
  const [legalRepresentativeConfirmed, setLegalRepresentativeConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Chargement des profils représentés…");

  async function load() {
    const data = await apiGet<Representation[]>("/api/v1/patient/representations/");
    setItems(data);
  }

  useEffect(() => {
    let active = true;
    apiGet<Representation[]>("/api/v1/patient/representations/")
      .then((data) => { if (active) { setItems(data); setMessage("Les profils représentés ont leur propre dossier, séparé du vôtre."); } })
      .catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "Impossible de charger les profils."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("Création du profil séparé…");
    const created = { first: firstName.trim(), last: lastName.trim() };
    try {
      await apiPost("/api/v1/patient/representations/", {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        birth_date: birthDate,
        relationship,
        legal_representative_confirmed: legalRepresentativeConfirmed,
      });
      setFirstName("");
      setLastName("");
      setBirthDate("");
      setLegalRepresentativeConfirmed(false);
      await load();
      setMessage("Profil créé. Son dossier est distinct et les accès du représentant sont journalisés.");
      setOutcome({ tone: "success", title: "Profil créé", message: `Le profil de ${created.first} ${created.last} a été créé. Son dossier est distinct du vôtre.`, note: "Vous pouvez l’ouvrir depuis « Profils représentés ». Chacun de vos accès à ce dossier est journalisé." });
    } catch (error) {
      const reason = errorReason(error, CREATE_ERROR_FALLBACK);
      setMessage(reason);
      setOutcome({ tone: "error", title: "Profil non créé", message: reason });
    } finally {
      setBusy(false);
    }
  }

  async function selectProfile(patientId: string | null) {
    setBusy(true);
    try {
      if (patientId) await apiPost("/api/v1/patient/representations/active/", { patient_id: patientId });
      else await apiDelete("/api/v1/patient/representations/active/");
      window.dispatchEvent(new Event("ecarnet:patient-profile-changed"));
      await load();
      setMessage(patientId ? "Dossier représenté sélectionné. Les actions suivantes seront journalisées." : "Votre propre dossier est de nouveau sélectionné.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de changer de dossier.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(item: Representation) {
    const accepted = await confirm({ title: "Révoquer ce lien ?", message: `Le lien de représentation pour ${item.first_name} ${item.last_name} sera révoqué.`, note: "Son dossier et son historique sont conservés. Vous pourrez réactiver le lien.", confirmLabel: "Révoquer le lien", cancelLabel: "Garder", tone: "danger" });
    if (!accepted) return;
    setBusy(true);
    try {
      await apiDelete(`/api/v1/patient/representations/${item.id}/`);
      await load();
      setMessage("Lien révoqué. Le dossier et son historique sont conservés.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de révoquer ce lien.");
    } finally {
      setBusy(false);
    }
  }

  async function reactivate(item: Representation) {
    setBusy(true);
    try {
      await apiPatch(`/api/v1/patient/representations/${item.id}/`, {});
      await load();
      setMessage("Lien réactivé. Le dossier et son historique sont conservés.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de réactiver ce lien.");
    } finally {
      setBusy(false);
    }
  }

  async function copyTransferId(patientId: string) {
    try {
      await navigator.clipboard.writeText(patientId);
      setMessage("Identifiant de transfert copié. Partagez-le uniquement avec la personne concernée.");
    } catch {
      setMessage("Copie impossible sur cet appareil. L’identifiant de transfert est affiché dans le profil.");
    }
  }

  return (
    <section className="settings-form">
      <p className="muted">Créez un dossier distinct pour un enfant mineur sans compte. Pour donner accès à un adulte, utilisez « Proches de confiance » : un adulte autorise lui-même la délégation. <Link href="/proches-et-enfants">Comment ça marche ?</Link> Le lien ne crée pas un compte de connexion et n’accorde pas d’accès clinique à un professionnel.</p>
      <form className="settings-form" onSubmit={(event) => void create(event)}>
        <div className="auth-name-grid">
          <label className="field"><span>Prénom</span><input required maxLength={80} value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={busy} /></label>
          <label className="field"><span>Nom</span><input required maxLength={80} value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={busy} /></label>
        </div>
        <div className="settings-form-grid">
          <label className="field"><span>Date de naissance</span><input required type="date" max={new Date().toISOString().slice(0, 10)} value={birthDate} onChange={(event) => setBirthDate(event.target.value)} disabled={busy} /></label>
          <label className="field"><span>Lien avec vous</span><select value={relationship} onChange={(event) => setRelationship(event.target.value)} disabled={busy}><option value="child">Enfant</option></select></label>
        </div>
        <label className="check"><input required type="checkbox" checked={legalRepresentativeConfirmed} onChange={(event) => setLegalRepresentativeConfirmed(event.target.checked)} disabled={busy} /> <span>Je confirme être autorisé(e) à représenter légalement cet enfant.</span></label>
        <button className="button primary" type="submit" disabled={busy || loading}>{busy ? "Enregistrement…" : "Créer un profil séparé"}</button>
      </form>
      <div className="stack">
        <h3>Profils représentés</h3>
        {loading ? <p role="status">{message}</p> : items.length === 0 ? <p className="muted">Aucun proche n’est rattaché à votre compte.</p> : items.map((item) => (
          <article className="record" key={item.id}>
            <div>
              <strong>{item.first_name} {item.last_name}</strong>
              <p className="muted">Enfant · Né(e) le {item.birth_date} · {item.status === "active" ? "Lien actif" : item.status === "revoked" ? "Lien révoqué" : "Dossier transféré"}</p>
              <p className="muted">Identifiant à communiquer uniquement pour une demande de transfert : <code>{item.patient_id}</code></p>
              {item.transfer_status === "pending" && <p className="notice">Demande de transfert en attente de vérification manuelle.</p>}
              {item.transfer_status === "rejected" && <p className="notice">La demande de transfert précédente a été refusée.</p>}
            </div>
            <div className="actions">
              <button type="button" className="button small" disabled={busy} onClick={() => void copyTransferId(item.patient_id)}>Copier l’identifiant</button>
              {item.status === "active" && <>
                <button type="button" className="button small" disabled={busy || item.is_active} onClick={() => void selectProfile(item.patient_id)}>{item.is_active ? "Dossier actif" : "Ouvrir ce dossier"}</button>
                <button type="button" className="button small" disabled={busy} onClick={() => void revoke(item)}>Révoquer le lien</button>
              </>}
              {item.status === "revoked" && <button type="button" className="button small" disabled={busy} onClick={() => void reactivate(item)}>Réactiver le lien</button>}
            </div>
          </article>
        ))}
        <button type="button" className="button" disabled={busy} onClick={() => void selectProfile(null)}>Revenir à mon dossier</button>
      </div>
      <p className="muted">La personne devenue adulte doit créer ou ouvrir son propre compte, puis faire elle-même la <Link href="/patient/transfert">demande de transfert</Link> avant de créer un autre dossier patient. La demande sera examinée manuellement. Aucun dossier n’est fusionné.</p>
      <p className="status" role="status" aria-live="polite">{message}</p>
      {outcome && <OutcomeDialog {...outcome} onClose={() => setOutcome(null)} />}
    </section>
  );
}
