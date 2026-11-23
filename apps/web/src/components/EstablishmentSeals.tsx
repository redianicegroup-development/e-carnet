"use client";

import { useEffect, useRef, useState } from "react";
import { apiDelete, apiUploadPatch } from "../infrastructure/api/client";
import { useConfirm } from "./modal/ConfirmProvider";
import { ESTABLISHMENT_SEAL_COPY, SealField, type Pending } from "./ProfessionalCredentialsSettings";
import type { SealKind } from "./useSealImage";

export type EstablishmentSealState = { stamp_uploaded: boolean; signature_uploaded: boolean };

const KINDS: SealKind[] = ["stamp", "signature"];
const HINT = {
  pending: "Nouveau fichier prêt : cliquez sur « Enregistrer l’identité » pour l’utiliser sur les consultations et les ordonnances.",
  none: "Facultatif. Sans scan, un cachet électronique est dessiné automatiquement.",
};

/** Brouillon du cachet et de la signature de la structure (« Informations administratives »).
    Même geste que pour le professionnel : photo ou fichier, ou dessin à l'écran pour la signature. Les fichiers choisis restent en attente
    jusqu'à `upload()` (appelé par le bouton « Enregistrer l'identité ») ; le retrait, lui, est immédiat après confirmation.
    Les consultations déjà signées gardent ce qui y figurait au moment de la signature. */
export function useEstablishmentSealsDraft(establishmentId: string, initial: EstablishmentSealState) {
  const confirm = useConfirm();
  // Dernier état renvoyé par l'API après un dépôt ou un retrait ; sinon, celui de la fiche chargée.
  const [latest, setState] = useState<EstablishmentSealState | null>(null);
  const state = latest ?? initial;
  const [pending, setPending] = useState<Partial<Record<SealKind, Pending>>>({});
  const [open, setOpen] = useState<SealKind | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const urls = useRef<string[]>([]);
  const endpoint = `/api/v1/establishments/${establishmentId}/credentials`;

  useEffect(() => () => { urls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);

  const changed = Boolean(pending.stamp || pending.signature);

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
      title: ESTABLISHMENT_SEAL_COPY[kind].removeTitle,
      message: "Il ne sera plus apposé sur les prochaines consultations et ordonnances de votre établissement ; un cachet électronique sera dessiné à la place.",
      note: "Les consultations et ordonnances déjà signées gardent ce qui y figurait au moment de la signature, pour toujours. Vous pourrez en déposer un nouveau à tout moment.",
      confirmLabel: "Retirer",
      cancelLabel: "Garder",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    setMessage("");
    try {
      setState(await apiDelete<EstablishmentSealState>(`${endpoint}/${kind}/`));
      setVersion((value) => value + 1);
      setMessage(kind === "stamp" ? "Cachet retiré." : "Signature retirée.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Retrait impossible.");
    } finally {
      setBusy(false);
    }
  }

  /** Envoie les fichiers choisis. Lève l'erreur de l'API ; à l'appelant d'afficher le message. Sans fichier en attente : ne fait rien. */
  async function upload() {
    if (!changed) return;
    const form = new FormData();
    if (pending.stamp) form.append("stamp", pending.stamp.file);
    if (pending.signature) form.append("signature", pending.signature.file);
    setState(await apiUploadPatch<EstablishmentSealState>(`${endpoint}/`, form));
    setPending({});
    setOpen(null);
    setVersion((value) => value + 1);
  }

  return { state, pending, open, setOpen, version, busy, message, changed, pick, discard, removeSaved, upload, endpoint };
}
export type EstablishmentSealsDraft = ReturnType<typeof useEstablishmentSealsDraft>;

/** Cachet et signature de la structure : deux champs « aperçu + Ajouter / Remplacer / Retirer », à mettre dans un <form>. */
export function EstablishmentSealFields({ draft }: { draft: EstablishmentSealsDraft }) {
  const { pending, open, setOpen, version, busy, state } = draft;
  return <fieldset className="establishment-seals">
    <legend>Cachet et signature</legend>
    <p className="muted">Ils sont apposés sur les consultations validées et sur les ordonnances de votre établissement, à côté de ceux du professionnel.</p>
    {KINDS.map((kind) => <SealField
      key={kind}
      kind={kind}
      uploaded={kind === "stamp" ? state.stamp_uploaded : state.signature_uploaded}
      pending={pending[kind]}
      refreshKey={version}
      busy={busy}
      open={open === kind}
      onOpen={() => setOpen(kind)}
      onClose={() => setOpen(null)}
      onPick={(file) => draft.pick(kind, file)}
      onDiscard={() => draft.discard(kind)}
      onRemoveSaved={() => void draft.removeSaved(kind)}
      endpoint={draft.endpoint}
      copy={ESTABLISHMENT_SEAL_COPY[kind]}
      hint={HINT}
    />)}
    {draft.message && <p className="notice" role="status" aria-live="polite">{draft.message}</p>}
  </fieldset>;
}
