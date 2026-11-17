"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { apiDelete, apiGet, apiPatch, apiPost } from "../infrastructure/api/client";
import { errorReason } from "../lib/access-outcome";
import { PROFILE_CHANGED_EVENT, PROFILES_UPDATED_EVENT, profileInitials, profileName, runAsProfile, type PatientProfileEntry } from "../lib/patient-profiles";
import { useConfirm } from "./modal/ConfirmProvider";
import { OutcomeDialog, type OutcomeDialogProps } from "./modal/OutcomeDialog";
import { PanelDialog } from "./modal/PanelDialog";
import { Icon } from "./ui/Icon";
import { EMPTY_PATIENT_FORM, PatientIdentityFields, onboardingErrorMessage, patientFormProblem, saveChildIdentity, type PatientForm } from "./PatientIdentityFields";
import "./patient-profiles.css";

/* « Profils » (Paramètres > Compte patient) : les profils d'enfants rattachés au compte.
   - la liste : un clic sur un profil ouvre sa fiche (prénom, nom, identifiant, copier l'identifiant, révoquer) ;
   - la création en deux étapes : 1) le profil, 2) l'onboarding patient de l'enfant (ville, contact, couverture), repris plus tard si besoin ;
   - on ne change PAS de profil ici : le switch est dans Paramètres, sur la carte « Compte patient » (flèche). */

const CREATE_ERROR_FALLBACK = "Le profil n’a pas pu être créé. Vérifiez les informations saisies et réessayez.";
const STATUS_LABELS: Record<PatientProfileEntry["status"], string> = { active: "Lien actif", revoked: "Lien révoqué", transferred: "Dossier transféré" };
const birthLabel = (value: string | null) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR") : "—";

function ChildOnboardingStep({ child, onDone, onLater }: { child: PatientProfileEntry; onDone: () => void; onLater: () => void }) {
  const [form, setForm] = useState<PatientForm>(EMPTY_PATIENT_FORM);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const update = (field: keyof PatientForm, value: string) => setForm((current) => ({ ...current, [field]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = patientFormProblem(form);
    if (problem) { setMessage(problem); return; }
    setBusy(true);
    setMessage("");
    try {
      await runAsProfile(child.patient_id, () => saveChildIdentity(form));
      onDone();
    } catch (error) {
      setMessage(onboardingErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PanelDialog title={`Carnet de ${child.first_name}`} lead={`Étape 2 sur 2 · Complétez le carnet de ${profileName(child)}. Seule la ville est obligatoire : le reste pourra être ajouté plus tard.`} onClose={onLater}>
      <form className="settings-form" onSubmit={(event) => void submit(event)}>
        <PatientIdentityFields form={form} update={update} issuedAt={new Date()} showProfession={false} showBirthDate={false} />
        <div className="actions">
          <button className="button primary" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer le carnet"}</button>
          <button className="button" type="button" disabled={busy} onClick={onLater}>Plus tard</button>
        </div>
        <p className="status" role="status" aria-live="polite">{message}</p>
      </form>
    </PanelDialog>
  );
}

function ProfileDetail({ item, busy, onClose, onCopy, onRevoke, onReactivate }: { item: PatientProfileEntry; busy: boolean; onClose: () => void; onCopy: (item: PatientProfileEntry) => void; onRevoke: (item: PatientProfileEntry) => void; onReactivate: (item: PatientProfileEntry) => void }) {
  return (
    <PanelDialog title={profileName(item)} lead="Profil d’enfant rattaché à votre compte. Son dossier est distinct du vôtre." onClose={onClose}>
      <dl className="profile-detail">
        <div><dt>Prénom</dt><dd>{item.first_name}</dd></div>
        <div><dt>Nom</dt><dd>{item.last_name}</dd></div>
        <div><dt>Identifiant</dt><dd><code>{item.patient_id}</code></dd></div>
        <div><dt>Né(e) le</dt><dd>{birthLabel(item.birth_date)}</dd></div>
        <div><dt>Lien</dt><dd>Enfant · {STATUS_LABELS[item.status]}</dd></div>
      </dl>
      <p className="muted">L’identifiant ne se communique que pour une demande de transfert, à la personne concernée.</p>
      {item.transfer_status === "pending" && <p className="notice">Demande de transfert en attente de vérification manuelle.</p>}
      {item.transfer_status === "rejected" && <p className="notice">La demande de transfert précédente a été refusée.</p>}
      <div className="actions">
        <button type="button" className="button" disabled={busy} onClick={() => onCopy(item)}>Copier l’identifiant</button>
        {item.status === "active" && <button type="button" className="button danger" disabled={busy} onClick={() => onRevoke(item)}>Révoquer</button>}
        {item.status === "revoked" && <button type="button" className="button" disabled={busy} onClick={() => onReactivate(item)}>Réactiver le lien</button>}
      </div>
    </PanelDialog>
  );
}

export function PatientRepresentationsSettingsClient() {
  const confirm = useConfirm();
  const [outcome, setOutcome] = useState<Omit<OutcomeDialogProps, "onClose"> | null>(null);
  const [items, setItems] = useState<PatientProfileEntry[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<PatientProfileEntry | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [relationship, setRelationship] = useState("child");
  const [legalRepresentativeConfirmed, setLegalRepresentativeConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Chargement des profils…");

  async function load() {
    setItems(await apiGet<PatientProfileEntry[]>("/api/v1/patient/representations/"));
  }
  const listChanged = () => window.dispatchEvent(new Event(PROFILES_UPDATED_EVENT));

  useEffect(() => {
    let active = true;
    apiGet<PatientProfileEntry[]>("/api/v1/patient/representations/")
      .then((data) => { if (active) { setItems(data); setMessage("Chaque profil a son propre dossier, séparé du vôtre."); } })
      .catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "Impossible de charger les profils."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("Création du profil…");
    try {
      const created = await apiPost<PatientProfileEntry>("/api/v1/patient/representations/", {
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
      listChanged();
      setMessage("Profil créé. Son dossier est distinct et les accès du représentant sont journalisés.");
      setOnboarding(created); // étape 2 : l'onboarding patient de l'enfant
    } catch (error) {
      const reason = errorReason(error, CREATE_ERROR_FALLBACK);
      setMessage(reason);
      setOutcome({ tone: "error", title: "Profil non créé", message: reason });
    } finally {
      setBusy(false);
    }
  }

  async function revoke(item: PatientProfileEntry) {
    const accepted = await confirm({ title: "Révoquer ce lien ?", message: `Le lien de représentation pour ${profileName(item)} sera révoqué.`, note: "Son dossier et son historique sont conservés. Vous pourrez réactiver le lien.", confirmLabel: "Révoquer le lien", cancelLabel: "Garder", tone: "danger" });
    if (!accepted) return;
    setBusy(true);
    try {
      await apiDelete(`/api/v1/patient/representations/${item.id}/`);
      setOpenId(null);
      await load();
      // Si c'était le profil ouvert, le serveur est revenu au titulaire : les écrans se rechargent. Sinon seule la liste change.
      window.dispatchEvent(new Event(item.is_active ? PROFILE_CHANGED_EVENT : PROFILES_UPDATED_EVENT));
      setMessage(`Lien révoqué pour ${item.first_name}. Le dossier et son historique sont conservés.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de révoquer ce lien.");
    } finally {
      setBusy(false);
    }
  }

  async function reactivate(item: PatientProfileEntry) {
    setBusy(true);
    try {
      await apiPatch(`/api/v1/patient/representations/${item.id}/`, {});
      await load();
      listChanged();
      setMessage(`Lien réactivé pour ${item.first_name}. Le dossier et son historique sont conservés.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de réactiver ce lien.");
    } finally {
      setBusy(false);
    }
  }

  async function copyId(item: PatientProfileEntry) {
    try {
      await navigator.clipboard.writeText(item.patient_id);
      setMessage("Identifiant copié. Partagez-le uniquement avec la personne concernée.");
    } catch {
      setMessage("Copie impossible sur cet appareil. L’identifiant est affiché dans la fiche du profil.");
    }
  }

  const open = items.find((item) => item.id === openId) ?? null;

  return (
    <section className="settings-form">
      <p className="muted">Un profil est le dossier distinct d’un enfant mineur sans compte. Pour donner accès à un adulte, utilisez « Proches de confiance » : un adulte autorise lui-même la délégation. <Link href="/proches-et-enfants">Comment ça marche ?</Link> Le lien ne crée pas un compte de connexion et n’accorde pas d’accès clinique à un professionnel.</p>

      <div className="stack">
        <h3>Mes profils</h3>
        {loading ? <p role="status">{message}</p> : items.length === 0 ? <p className="muted">Aucun profil d’enfant n’est rattaché à votre compte.</p> : (
          <ul className="profile-list">
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" className="profile-row" aria-haspopup="dialog" onClick={() => setOpenId(item.id)}>
                  <span className="profile-row__avatar" aria-hidden="true">{profileInitials(item)}</span>
                  <span className="profile-row__text"><strong>{profileName(item)}</strong><small>Enfant · {STATUS_LABELS[item.status]}</small></span>
                  <Icon name="chevron" size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="muted">Pour ouvrir le dossier d’un profil, utilisez la flèche de la carte « Compte patient », en haut des paramètres.</p>
      </div>

      <form className="settings-form" onSubmit={(event) => void create(event)}>
        <h3>Ajouter un profil</h3>
        <p className="eyebrow">Étape 1 sur 2 · Le profil</p>
        <div className="auth-name-grid">
          <label className="field"><span>Prénom</span><input required maxLength={80} value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={busy} /></label>
          <label className="field"><span>Nom</span><input required maxLength={80} value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={busy} /></label>
        </div>
        <div className="settings-form-grid">
          <label className="field"><span>Date de naissance</span><input required type="date" max={new Date().toISOString().slice(0, 10)} value={birthDate} onChange={(event) => setBirthDate(event.target.value)} disabled={busy} /></label>
          <label className="field"><span>Lien avec vous</span><select value={relationship} onChange={(event) => setRelationship(event.target.value)} disabled={busy}><option value="child">Enfant</option></select></label>
        </div>
        <label className="check"><input required type="checkbox" checked={legalRepresentativeConfirmed} onChange={(event) => setLegalRepresentativeConfirmed(event.target.checked)} disabled={busy} /> <span>Je confirme être autorisé(e) à représenter légalement cet enfant.</span></label>
        <button className="button primary" type="submit" disabled={busy || loading}>{busy ? "Enregistrement…" : "Créer le profil et continuer"}</button>
      </form>

      <p className="muted">La personne devenue adulte doit créer ou ouvrir son propre compte, puis faire elle-même la <Link href="/patient/transfert">demande de transfert</Link> avant de créer un autre dossier patient. La demande sera examinée manuellement. Aucun dossier n’est fusionné.</p>
      <p className="status" role="status" aria-live="polite">{message}</p>

      {open && <ProfileDetail item={open} busy={busy} onClose={() => setOpenId(null)} onCopy={(item) => void copyId(item)} onRevoke={(item) => void revoke(item)} onReactivate={(item) => void reactivate(item)} />}
      {onboarding && <ChildOnboardingStep child={onboarding} onLater={() => setOnboarding(null)} onDone={() => {
        const child = onboarding;
        setOnboarding(null);
        setOutcome({ tone: "success", title: "Profil créé", message: `Le carnet de ${profileName(child)} est ouvert. Son dossier est distinct du vôtre.`, note: "Pour le consulter, changez de profil avec la flèche de la carte « Compte patient ». Chacun de vos accès à ce dossier est journalisé." });
      }} />}
      {outcome && <OutcomeDialog {...outcome} onClose={() => setOutcome(null)} />}
    </section>
  );
}
