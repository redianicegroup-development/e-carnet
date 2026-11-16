"use client";

import { useState } from "react";
import { apiPost } from "../infrastructure/api/client";
import { OutcomeDialog } from "./modal/OutcomeDialog";

/* Motifs de révocation lus à la connexion : « votre rattachement a été retiré par l'établissement, pour ce motif ».
   Un avis à la fois ; une fois fermé, il est marqué lu côté serveur et ne revient plus. */
export type RevocationNotice = { id: string; kind: "membership" | "laboratory"; establishment_name: string; parent_name?: string; reason: string; revoked_at: string | null };

export function noticeCopy(notice: RevocationNotice): { title: string; message: string; note: string } {
  const reason = `Motif : ${notice.reason}`;
  if (notice.kind === "laboratory") {
    const from = notice.parent_name ? ` (${notice.parent_name})` : "";
    return { title: "Votre accès au laboratoire a été retiré", message: `L’établissement a retiré votre accès au ${notice.establishment_name}${from}. Vous ne pouvez plus y exercer.`, note: reason };
  }
  return { title: "Votre rattachement a été retiré", message: `${notice.establishment_name} a mis fin à votre rattachement. Vous ne pouvez plus y exercer.`, note: reason };
}

export function RevocationNotices({ notices }: { notices: RevocationNotice[] }) {
  const [seen, setSeen] = useState<string[]>([]);
  const current = notices.find((notice) => !seen.includes(`${notice.kind}:${notice.id}`));
  if (!current) return null;
  const copy = noticeCopy(current);
  const close = () => {
    setSeen((previous) => [...previous, `${current.kind}:${current.id}`]);
    // Échec silencieux : l'avis reviendra à la prochaine connexion, ce qui vaut mieux que de le perdre.
    void apiPost("/api/v1/establishments/revocation-notices/ack/", { id: current.id, kind: current.kind }).catch(() => undefined);
  };
  return <OutcomeDialog tone="error" title={copy.title} message={copy.message} note={copy.note} actionLabel="J’ai compris" onClose={close} />;
}
