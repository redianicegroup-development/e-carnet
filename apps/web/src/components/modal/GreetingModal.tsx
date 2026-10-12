"use client";

import { useEffect, useId, useState } from "react";
import type { SpaceId } from "../../lib/spaces";
import { decideGreeting, firstNameOf, markGreeted, readGreetingFlags, type GreetingKind } from "./greeting";
import { ModalIllustration } from "./ModalIllustration";

type Props = { account: { id: string; first_name: string; date_joined?: string }; space: SpaceId };

function titleFor(kind: GreetingKind, firstName: string) {
  if (kind === "welcome") return firstName ? `Bienvenue, ${firstName} !` : "Bienvenue !";
  if (kind === "morning") return firstName ? `Bonjour ${firstName}` : "Bonjour";
  return firstName ? `Bonsoir ${firstName}` : "Bonsoir";
}

/* Notification d'accueil non bloquante : affichée brièvement, sans action à confirmer ni description. */
export function GreetingModal({ account }: Props) {
  const [kind, setKind] = useState<GreetingKind | null>(() => {
    const flags = readGreetingFlags(account.id);
    if (!flags.storageOk) return null;
    return decideGreeting({ dateJoined: account.date_joined, now: new Date(), alreadyWelcomed: flags.alreadyWelcomed, alreadyGreetedThisSession: flags.alreadyGreetedThisSession });
  });
  const titleId = useId();

  // Marquer dès l'affichage évite de répéter le salut lors d'un rechargement ou dans un autre onglet.
  useEffect(() => { if (kind) markGreeted(account.id, kind); }, [account.id, kind]);
  useEffect(() => {
    if (!kind) return;
    const timer = window.setTimeout(() => setKind(null), 3000);
    return () => window.clearTimeout(timer);
  }, [kind]);

  if (!kind) return null;
  return (
    <div className="modal-backdrop modal-backdrop--greeting" role="presentation">
      <section className="modal-dialog modal-greeting" data-kind={kind} role="status" aria-live="polite" aria-atomic="true" aria-labelledby={titleId}>
        <ModalIllustration mood={kind} size="md" />
        <div className="modal-copy"><h2 id={titleId}>{titleFor(kind, firstNameOf(account.first_name))}</h2></div>
      </section>
    </div>
  );
}
