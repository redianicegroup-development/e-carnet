"use client";

import { useEffect, useRef, useState } from "react";
import { apiDelete, apiUploadPatch } from "../infrastructure/api/client";
import { InkCapture } from "./InkCapture";
import { useConfirm } from "./modal/ConfirmProvider";
import { useSealImage, type SealKind } from "./useSealImage";
import { OnboardingNav } from "./onboarding/OnboardingChrome";
import "./ink-capture.css";

export type Credentials = {
  professional_identifier: string;
  stamp_uploaded: boolean;
  signature_uploaded: boolean;
};

type Pending = { file: File; url: string };
type Props = {
  profile: Credentials;
  onSaved: (profile: Credentials) => void;
  /** « onboarding » : étape facultative avec « Passer » ; « settings » : modale des paramètres. */
  variant?: "settings" | "onboarding";
  /** Appelé en onboarding après l'enregistrement ou « Passer ». */
  onDone?: () => void;
  /** Libellé de l'étiquette en onboarding (par défaut « Étape facultative »). */
  eyebrow?: string;
  /** Page du bouton « Retour » en onboarding. */
  backHref?: string;
};

const COPY: Record<SealKind, { title: string; add: string; replace: string; saved: string; none: string; removeTitle: string }> = {
  stamp: { title: "Cachet personnel", add: "Ajouter mon cachet", replace: "Remplacer le cachet", saved: "Cachet enregistré.", none: "Aucun cachet", removeTitle: "Retirer votre cachet ?" },
  signature: { title: "Signature personnelle", add: "Ajouter ma signature", replace: "Remplacer la signature", saved: "Signature enregistrée.", none: "Aucune signature", removeTitle: "Retirer votre signature ?" },
};

function SealField({ kind, uploaded, pending, refreshKey, busy, open, onOpen, onClose, onPick, onDiscard, onRemoveSaved }: {
  kind: SealKind; uploaded: boolean; pending: Pending | undefined; refreshKey: number; busy: boolean; open: boolean;
  onOpen: () => void; onClose: () => void; onPick: (file: File) => void; onDiscard: () => void; onRemoveSaved: () => void;
}) {
  const saved = useSealImage(kind, uploaded && !pending, refreshKey);
  const shown = pending?.url ?? saved;
  const copy = COPY[kind];
  return <div className="seal-field">
    <span className="seal-field__label">{copy.title}</span>
    <div className="seal-field__row">
      {shown ? <div className="seal-preview"><img src={shown} alt={`${copy.title}, aperçu`} /></div> : <div className="seal-preview seal-preview--empty">{uploaded ? "Chargement de l’aperçu…" : copy.none}</div>}
      <div className="seal-field__actions">
        <button type="button" className="button" onClick={onOpen} disabled={busy || open}>{pending || uploaded ? copy.replace : copy.add}</button>
        {pending && <button type="button" className="button" onClick={onDiscard} disabled={busy}>Annuler ce choix</button>}
        {!pending && uploaded && <button type="button" className="button danger" onClick={onRemoveSaved} disabled={busy}>Retirer</button>}
      </div>
    </div>
    <small className="muted">{pending ? "Nouveau fichier prêt : cliquez sur « Enregistrer » pour l’ajouter à vos ordonnances." : uploaded ? copy.saved : "Facultatif. Vous pouvez l’ajouter plus tard."}</small>
    {open && <InkCapture kind={kind} onCancel={onClose} onUse={(file) => { onPick(file); onClose(); }} />}
  </div>;
}

/** Brouillon des informations d'ordonnance : numéro d'ordre, cachet et signature en attente d'enregistrement.
    Commun aux paramètres, à l'étape facultative « cachet et signature » et au bloc unique de l'étape 3 d'un professionnel. */
export function useCredentialsDraft(profile: Credentials, onSaved: (profile: Credentials) => void) {
  const confirm = useConfirm();
  const [identifier, setIdentifier] = useState(profile.professional_identifier ?? "");
  const [pending, setPending] = useState<Partial<Record<SealKind, Pending>>>({});
  const [open, setOpen] = useState<SealKind | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const urls = useRef<string[]>([]);

  useEffect(() => () => { urls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);

  const changed = identifier.trim() !== (profile.professional_identifier ?? "") || Boolean(pending.stamp) || Boolean(pending.signature);

  function pick(kind: SealKind, file: File) {
    const previous = pending[kind];
    if (previous) URL.revokeObjectURL(previous.url);
    const url = URL.createObjectURL(file);
    urls.current.push(url);
    setPending((current) => ({ ...current, [kind]: { file, url } }));
    setMessage("");
  }

  function discard(kind: SealKind) {
    const previous = pending[kind];
    if (previous) URL.revokeObjectURL(previous.url);
    setPending((current) => ({ ...current, [kind]: undefined }));
  }

  async function removeSaved(kind: SealKind) {
    const ok = await confirm({
      title: COPY[kind].removeTitle,
      message: "Il ne sera plus ajouté à vos prochaines ordonnances.",
      note: "Les ordonnances déjà signées gardent ce qui y figurait au moment de la signature. Vous pourrez en déposer un nouveau à tout moment.",
      confirmLabel: "Retirer",
      cancelLabel: "Garder",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    setMessage("");
    try {
      const next = await apiDelete<Credentials>(`/api/v1/professionals/credentials/${kind}/`);
      onSaved(next);
      setVersion((value) => value + 1);
      setMessage(kind === "stamp" ? "Cachet retiré." : "Signature retirée.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Retrait impossible.");
    } finally {
      setBusy(false);
    }
  }

  /** Envoie le numéro d'ordre et les images choisies (espace professionnel). Lève l'erreur de l'API ; à l'appelant d'afficher le message. */
  async function upload() {
    const form = new FormData();
    form.append("professional_identifier", identifier.trim());
    if (pending.stamp) form.append("stamp", pending.stamp.file);
    if (pending.signature) form.append("signature", pending.signature.file);
    const saved = await apiUploadPatch<Credentials>("/api/v1/professionals/credentials/", form);
    onSaved(saved);
    setPending({});
    setOpen(null);
    setVersion((value) => value + 1);
    return saved;
  }

  return { identifier, setIdentifier, pending, open, setOpen, version, busy, setBusy, message, setMessage, changed, pick, discard, removeSaved, upload };
}
export type CredentialsDraft = ReturnType<typeof useCredentialsDraft>;

/** Numéro d'ordre, cachet et signature. À mettre dans un <form>. */
export function CredentialFields({ draft, profile }: { draft: CredentialsDraft; profile: Credentials }) {
  const { pending, open, setOpen, version, busy } = draft;
  return <>
    <label className="field"><span>Numéro d’ordre professionnel déclaré</span><input maxLength={120} value={draft.identifier} onChange={(event) => draft.setIdentifier(event.target.value)} placeholder="Votre numéro professionnel déclaré" disabled={busy} /></label>
    <SealField kind="stamp" uploaded={profile.stamp_uploaded} pending={pending.stamp} refreshKey={version} busy={busy} open={open === "stamp"} onOpen={() => setOpen("stamp")} onClose={() => setOpen(null)} onPick={(file) => draft.pick("stamp", file)} onDiscard={() => draft.discard("stamp")} onRemoveSaved={() => void draft.removeSaved("stamp")} />
    <SealField kind="signature" uploaded={profile.signature_uploaded} pending={pending.signature} refreshKey={version} busy={busy} open={open === "signature"} onOpen={() => setOpen("signature")} onClose={() => setOpen(null)} onPick={(file) => draft.pick("signature", file)} onDiscard={() => draft.discard("signature")} onRemoveSaved={() => void draft.removeSaved("signature")} />
  </>;
}

export function ProfessionalCredentialsSettings({ profile, onSaved, variant = "settings", onDone, eyebrow, backHref = "/professionnel/onboarding" }: Props) {
  const onboarding = variant === "onboarding";
  const draft = useCredentialsDraft(profile, onSaved);
  const { busy, message } = draft;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.changed) {
      if (onboarding) onDone?.();
      else draft.setMessage("Aucun changement à enregistrer.");
      return;
    }
    draft.setBusy(true);
    draft.setMessage("");
    try {
      await draft.upload();
      draft.setMessage("Informations d’ordonnance enregistrées.");
      if (onboarding) onDone?.();
    } catch (error) {
      draft.setMessage(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      draft.setBusy(false);
    }
  }

  return <form className="settings-modal-section" onSubmit={submit}>
    <span className="eyebrow">{onboarding ? eyebrow ?? "Étape facultative" : "Ordonnance"}</span>
    <h3>{onboarding ? "Votre cachet et votre signature" : "Coordonnées du prescripteur"}</h3>
    <p className="muted">Le numéro d’ordre, le cachet et la signature figurent sur vos ordonnances. Le cachet et la signature sont facultatifs.</p>
    <CredentialFields draft={draft} profile={profile} />
    {onboarding
      ? <OnboardingNav backHref={backHref} busy={busy} />
      : <div className="actions"><button className="button primary" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button></div>}
    {onboarding && <p className="muted">Vous pourrez les ajouter plus tard dans vos paramètres.</p>}
    <p className="status" role="status" aria-live="polite">{message}</p>
  </form>;
}
