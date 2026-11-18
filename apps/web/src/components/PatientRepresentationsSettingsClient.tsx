"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { apiDelete, apiGet, apiPatch, apiPost } from "../infrastructure/api/client";
import { errorReason } from "../lib/access-outcome";
import { PROFILE_CHANGED_EVENT, PROFILES_UPDATED_EVENT, profileName, runAsProfile, type PatientProfileEntry } from "../lib/patient-profiles";
import { useConfirm } from "./modal/ConfirmProvider";
import { OutcomeDialog, type OutcomeDialogProps } from "./modal/OutcomeDialog";
import { PanelDialog } from "./modal/PanelDialog";
import { Profile } from "./ui/Profile";
import type { ProfileAction, ProfileRow } from "./ui/ProfileSheet";
import { EMPTY_PATIENT_FORM, PatientIdentityFields, onboardingErrorMessage, patientFormProblem, saveChildIdentity, type PatientForm } from "./PatientIdentityFields";
import "./patient-profiles.css";

/* « Profils » (Paramètres > Compte patient) : les profils d'enfants rattachés au compte.
   - la liste : un clic sur un profil ouvre sa fiche (composant « Profil » : prénom, nom, identifiant, Fermer, Copier l'identifiant, Révoquer) ;
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

/* Lignes de la fiche d'un profil enfant : identité, identifiant (à ne communiquer que pour un transfert), date de naissance, état du lien. */
function profileRows(item: PatientProfileEntry): ProfileRow[] {
  return [
    { label: "Prénom", value: item.first_name },
    { label: "Nom", value: item.last_name },
    { label: "Identifiant", value: <code>{item.patient_id}</code> },
    { label: "Né(e) le", value: birthLabel(item.birth_date) },
    { label: "Lien", value: `Enfant · ${STATUS_LABELS[item.status]}` },
  ];
}

export function PatientRepresentationsSettingsClient() {
  const confirm = useConfirm();
  const [outcome, setOutcome] = useState<Omit<OutcomeDialogProps, "onClose"> | null>(null);
  const [items, setItems] = useState<PatientProfileEntry[]>([]);
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

  /** Vrai si le lien a été révoqué (la fiche se ferme alors) ; faux si le titulaire a gardé le lien ou si l'appel a échoué. */
  async function revoke(item: PatientProfileEntry): Promise<boolean> {
    const accepted = await confirm({ title: "Révoquer ce lien ?", message: `Le lien de représentation pour ${profileName(item)} sera révoqué.`, note: "Son dossier et son historique sont conservés. Vous pourrez réactiver le lien.", confirmLabel: "Révoquer le lien", cancelLabel: "Garder", tone: "danger" });
    if (!accepted) return false;
    setBusy(true);
    try {
      await apiDelete(`/api/v1/patient/representations/${item.id}/`);
      await load();
      // Si c'était le profil ouvert, le serveur est revenu au titulaire : les écrans se rechargent. Sinon seule la liste change.
      window.dispatchEvent(new Event(item.is_active ? PROFILE_CHANGED_EVENT : PROFILES_UPDATED_EVENT));
      setMessage(`Lien révoqué pour ${item.first_name}. Le dossier et son historique sont conservés.`);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de révoquer ce lien.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Renvoie la phrase à afficher dans la fiche (réussite ou échec). */
  async function reactivate(item: PatientProfileEntry): Promise<string> {
    setBusy(true);
    try {
      await apiPatch(`/api/v1/patient/representations/${item.id}/`, {});
      await load();
      listChanged();
      const done = `Lien réactivé pour ${item.first_name}. Le dossier et son historique sont conservés.`;
      setMessage(done);
      return done;
    } catch (error) {
      const failed = error instanceof Error ? error.message : "Impossible de réactiver ce lien.";
      setMessage(failed);
      return failed;
    } finally {
      setBusy(false);
    }
  }

  /** Renvoie la phrase à afficher dans la fiche. */
  async function copyId(item: PatientProfileEntry): Promise<string> {
    try {
      await navigator.clipboard.writeText(item.patient_id);
      return "Identifiant copié. Partagez-le uniquement avec la personne concernée.";
    } catch {
      return "Copie impossible sur cet appareil. L’identifiant est affiché ci-dessus.";
    }
  }

  /* Boutons de la fiche (toujours en bas, après « Fermer ») : copier l'identifiant ; révoquer un lien actif ou réactiver un lien révoqué. */
  function profileActions(item: PatientProfileEntry): ProfileAction[] {
    return [
      { label: "Copier l’identifiant", disabled: busy, onClick: () => copyId(item) },
      ...(item.status === "active" ? [{ label: "Révoquer", tone: "danger" as const, disabled: busy, onClick: async ({ close }: { close: () => void }) => { if (await revoke(item)) close(); } }] : []),
      ...(item.status === "revoked" ? [{ label: "Réactiver le lien", disabled: busy, onClick: () => reactivate(item) }] : []),
    ];
  }

  return (
    <section className="settings-form">
      <p className="muted">Un profil est le dossier distinct d’un enfant mineur sans compte. Pour donner accès à un adulte, utilisez « Proches de confiance » : un adulte autorise lui-même la délégation. <Link href="/proches-et-enfants">Comment ça marche ?</Link> Le lien ne crée pas un compte de connexion et n’accorde pas d’accès clinique à un professionnel.</p>

      <div className="stack">
        <h3>Mes profils</h3>
        {loading ? <p role="status">{message}</p> : items.length === 0 ? <p className="muted">Aucun profil d’enfant n’est rattaché à votre compte.</p> : (
          <ul className="profile-list">
            {items.map((item) => (
              <li key={item.id}>
                <Profile
                  variant="row"
                  name={profileName(item)}
                  subtitle="Profil d’enfant rattaché à votre compte"
                  meta={`Enfant · ${STATUS_LABELS[item.status]}`}
                  rows={profileRows(item)}
                  note="L’identifiant ne se communique que pour une demande de transfert, à la personne concernée. Le dossier de l’enfant est distinct du vôtre."
                  actions={profileActions(item)}
                >
                  {item.transfer_status === "pending" && <p className="notice">Demande de transfert en attente de vérification manuelle.</p>}
                  {item.transfer_status === "rejected" && <p className="notice">La demande de transfert précédente a été refusée.</p>}
                </Profile>
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

      {onboarding && <ChildOnboardingStep child={onboarding} onLater={() => setOnboarding(null)} onDone={() => {
        const child = onboarding;
        setOnboarding(null);
        setOutcome({ tone: "success", title: "Profil créé", message: `Le carnet de ${profileName(child)} est ouvert. Son dossier est distinct du vôtre.`, note: "Pour le consulter, changez de profil avec la flèche de la carte « Compte patient ». Chacun de vos accès à ce dossier est journalisé." });
      }} />}
      {outcome && <OutcomeDialog {...outcome} onClose={() => setOutcome(null)} />}
    </section>
  );
}
