"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiDelete, apiGet, apiPatch } from "../infrastructure/api/client";
import { PROFILE_CHANGED_EVENT, PROFILES_UPDATED_EVENT, profileName, type PatientProfileEntry } from "../lib/patient-profiles";
import { useConfirm } from "./modal/ConfirmProvider";
import { Profile, ProfileGrid } from "./ui/Profile";
import type { ProfileAction, ProfileRow } from "./ui/ProfileSheet";
import { ChildOnboarding } from "./ChildOnboarding";
import { ChildPhotoForm } from "./ChildPhotoForm";
import { DeleteChildProfileDialog } from "./DeleteChildProfileDialog";
import { PanelDialog } from "./modal/PanelDialog";
import "./patient-profiles.css";

/* « Profils » (Paramètres > Compte patient) : les profils d'enfants rattachés au compte.
   - la liste : la photo ronde de chaque enfant (composant « Profil », comme partout) ; un toucher ouvre sa fiche (prénom, nom, identifiant, Fermer,
     Copier l'identifiant, Révoquer) ;
   - « Ajouter un carnet enfant » ouvre l'onboarding de l'enfant (ChildOnboarding : photo, date de naissance, carnet) ;
   - on ne change PAS de profil ici : le switch est dans Paramètres, sur la carte « Compte patient » (flèche). */

const STATUS_LABELS: Record<PatientProfileEntry["status"], string> = { active: "Lien actif", revoked: "Lien révoqué", transferred: "Dossier transféré" };
const birthLabel = (value: string | null) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR") : "—";

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
  const [items, setItems] = useState<PatientProfileEntry[]>([]);
  const [adding, setAdding] = useState(false);
  const [photoTarget, setPhotoTarget] = useState<PatientProfileEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PatientProfileEntry | null>(null);
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

  /* Boutons de la fiche (toujours en bas, après « Fermer ») : modifier la photo ; copier l'identifiant ; révoquer un lien actif ou réactiver un lien
     révoqué ; supprimer le profil, avec motif (définitif). */
  function profileActions(item: PatientProfileEntry): ProfileAction[] {
    return [
      ...(item.status === "active" ? [{ label: item.avatar_url ? "Modifier la photo" : "Ajouter une photo", disabled: busy, onClick: ({ close }: { close: () => void }) => { close(); setPhotoTarget(item); } }] : []),
      { label: "Copier l’identifiant", disabled: busy, onClick: () => copyId(item) },
      ...(item.status === "active" ? [{ label: "Révoquer", tone: "danger" as const, disabled: busy, onClick: async ({ close }: { close: () => void }) => { if (await revoke(item)) close(); } }] : []),
      ...(item.status === "revoked" ? [{ label: "Réactiver le lien", disabled: busy, onClick: () => reactivate(item) }] : []),
      { label: "Supprimer le profil", tone: "danger" as const, disabled: busy, onClick: ({ close }: { close: () => void }) => { close(); setDeleteTarget(item); } },
    ];
  }

  /** L'onboarding vient de créer un profil : la liste se recharge tout de suite et le sélecteur de profil de la carte « Compte patient » aussi. */
  async function onCreated() {
    await load();
    listChanged();
    setMessage("Profil créé. Son dossier est distinct et les accès du représentant sont journalisés.");
  }

  return (
    <section className="settings-form">
      <p className="muted">Un profil est le dossier distinct d’un enfant mineur sans compte. Pour donner accès à un adulte, utilisez « Proches de confiance » : un adulte autorise lui-même la délégation. <Link href="/proches-et-enfants">Comment ça marche ?</Link> Le lien ne crée pas un compte de connexion et n’accorde pas d’accès clinique à un professionnel.</p>

      <div className="stack">
        <h3>Mes carnets enfants</h3>
        {loading ? <p role="status">{message}</p> : items.length === 0 ? <p className="muted">Aucun carnet enfant n’est rattaché à votre compte.</p> : (
          <ProfileGrid label="Profils d’enfants">
            {items.map((item) => (
              <Profile
                key={item.id}
                name={profileName(item)}
                label={item.first_name}
                photo={item.avatar_url}
                subtitle="Profil d’enfant rattaché à votre compte"
                status={{ label: STATUS_LABELS[item.status], tone: item.status === "active" ? "ok" : "off" }}
                rows={profileRows(item)}
                note="L’identifiant ne se communique que pour une demande de transfert, à la personne concernée. Le dossier de l’enfant est distinct du vôtre."
                actions={profileActions(item)}
              >
                {item.transfer_status === "pending" && <p className="notice">Demande de transfert en attente de vérification manuelle.</p>}
                {item.transfer_status === "rejected" && <p className="notice">La demande de transfert précédente a été refusée.</p>}
              </Profile>
            ))}
          </ProfileGrid>
        )}
        <p className="muted">Pour ouvrir le dossier d’un profil, utilisez la flèche de la carte « Compte patient », en haut des paramètres.</p>
      </div>

      <div className="actions"><button className="button primary" type="button" disabled={busy || loading} onClick={() => setAdding(true)}>Ajouter un carnet enfant</button></div>

      <p className="muted">La personne devenue adulte doit créer ou ouvrir son propre compte, puis faire elle-même la <Link href="/patient/transfert">demande de transfert</Link> avant de créer un autre dossier patient. La demande sera examinée manuellement. Aucun dossier n’est fusionné.</p>
      <p className="status" role="status" aria-live="polite">{message}</p>

      {adding && <ChildOnboarding onClose={() => setAdding(false)} onCreated={() => void onCreated()} />}
      {photoTarget && <PanelDialog title={`Photo de ${photoTarget.first_name}`} lead="La photo apparaît dans votre liste de profils et partout où vous choisissez ce profil." onClose={() => setPhotoTarget(null)}><ChildPhotoForm profile={photoTarget} onSaved={() => void load()} /></PanelDialog>}
      {deleteTarget && <DeleteChildProfileDialog profile={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={() => { setMessage(`Profil de ${deleteTarget.first_name} supprimé.`); void load(); }} />}
    </section>
  );
}
