"use client";

import { useEffect, useRef, useState } from "react";
import { apiDelete, apiUploadPatch } from "../infrastructure/api/client";
import { InkCapture } from "./InkCapture";
import { useConfirm } from "./modal/ConfirmProvider";
import { useSealImage, type SealKind } from "./useSealImage";
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

export function ProfessionalCredentialsSettings({ profile, onSaved, variant = "settings", onDone }: Props) {
  const confirm = useConfirm();
  const onboarding = variant === "onboarding";
  const [identifier, setIdentifier] = useState(profile.professional_identifier ?? "");
  const [pending, setPending] = useState<Partial<Record<SealKind, Pending>>>({});
  const [open, setOpen] = useState<SealKind | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const urls = useRef<string[]>([]);

  useEffect(() => () => { urls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const changed = identifier.trim() !== (profile.professional_identifier ?? "") || Boolean(pending.stamp) || Boolean(pending.signature);
    if (!changed) {
      if (onboarding) onDone?.();
      else setMessage("Aucun changement à enregistrer.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.append("professional_identifier", identifier.trim());
      if (pending.stamp) form.append("stamp", pending.stamp.file);
      if (pending.signature) form.append("signature", pending.signature.file);
      const saved = await apiUploadPatch<Credentials>("/api/v1/professionals/credentials/", form);
      onSaved(saved);
      setPending({});
      setOpen(null);
      setVersion((value) => value + 1);
      setMessage("Informations d’ordonnance enregistrées.");
      if (onboarding) onDone?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="settings-modal-section" onSubmit={submit}>
    <span className="eyebrow">{onboarding ? "Étape facultative" : "Ordonnance"}</span>
    <h3>{onboarding ? "Votre cachet et votre signature" : "Coordonnées du prescripteur"}</h3>
    <p className="muted">Le numéro d’ordre est imprimé sur vos ordonnances. Le cachet et la signature sont facultatifs : s’ils sont enregistrés, ils sont ajoutés automatiquement en bas de l’ordonnance quand vous signez une consultation, avec la mention « Signé électroniquement dans Mon E‑Carnet ».</p>
    <label className="field"><span>Numéro d’ordre professionnel déclaré</span><input maxLength={120} value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Votre numéro professionnel déclaré" disabled={busy} /></label>
    <SealField kind="stamp" uploaded={profile.stamp_uploaded} pending={pending.stamp} refreshKey={version} busy={busy} open={open === "stamp"} onOpen={() => setOpen("stamp")} onClose={() => setOpen(null)} onPick={(file) => pick("stamp", file)} onDiscard={() => discard("stamp")} onRemoveSaved={() => void removeSaved("stamp")} />
    <SealField kind="signature" uploaded={profile.signature_uploaded} pending={pending.signature} refreshKey={version} busy={busy} open={open === "signature"} onOpen={() => setOpen("signature")} onClose={() => setOpen(null)} onPick={(file) => pick("signature", file)} onDiscard={() => discard("signature")} onRemoveSaved={() => void removeSaved("signature")} />
    <div className={onboarding ? "onboarding-skip" : "actions"}>
      <button className="button primary" type="submit" disabled={busy}>{busy ? "Enregistrement…" : onboarding ? "Enregistrer et continuer" : "Enregistrer"}</button>
      {onboarding && <button className="button" type="button" onClick={() => onDone?.()} disabled={busy}>Passer pour le moment</button>}
    </div>
    {onboarding && <p className="muted">Vous pourrez les ajouter ou les modifier plus tard dans Paramètres › Informations professionnelles.</p>}
    <p className="status" role="status" aria-live="polite">{message}</p>
  </form>;
}
