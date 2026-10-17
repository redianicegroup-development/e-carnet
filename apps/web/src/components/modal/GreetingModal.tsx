"use client";

import { useEffect, useId, useState } from "react";
import type { SpaceId } from "../../lib/spaces";
import { WelcomeCharacter } from "../auth/WelcomeCharacter";
import { decideGreeting, firstNameOf, markGreeted, readGreetingFlags, type GreetingKind } from "./greeting";

type Props = { account: { id: string; first_name: string; date_joined?: string }; space: SpaceId };

function titleFor(kind: GreetingKind, firstName: string) {
  if (kind === "welcome") return firstName ? `Bienvenue, ${firstName} !` : "Bienvenue !";
  if (kind === "morning") return firstName ? `Bonjour ${firstName}` : "Bonjour";
  return firstName ? `Bonsoir ${firstName}` : "Bonsoir";
}

function messageFor(kind: GreetingKind) {
  if (kind === "welcome") return "Votre espace personnel est prêt. Vous gardez la main sur votre carnet.";
  return "Ravi de vous retrouver dans votre espace Mon E‑Carnet.";
}

/* Accueil bref et non modal : aucune prise de focus, aucun fond bloquant et aucune action requise. */
export function GreetingModal({ account }: Props) {
  const [kind, setKind] = useState<GreetingKind | null>(() => {
    const flags = readGreetingFlags(account.id);
    if (!flags.storageOk) return null;
    return decideGreeting({ dateJoined: account.date_joined, now: new Date(), alreadyWelcomed: flags.alreadyWelcomed, alreadyGreetedThisSession: flags.alreadyGreetedThisSession });
  });
  const titleId = useId();

  useEffect(() => { if (kind) markGreeted(account.id, kind); }, [account.id, kind]);
  useEffect(() => {
    if (!kind) return;
    const timer = window.setTimeout(() => setKind(null), 4200);
    return () => window.clearTimeout(timer);
  }, [kind]);

  if (!kind) return null;
  return <div className="greeting-toast" data-kind={kind} role="status" aria-live="polite" aria-atomic="true" aria-labelledby={titleId}>
    <span className="greeting-toast__halo" aria-hidden="true" />
    <div className="greeting-toast__character" aria-hidden="true"><WelcomeCharacter mood="greet" /></div>
    <div className="greeting-toast__copy"><span className="greeting-toast__eyebrow">Votre espace Mon E‑Carnet</span><h2 id={titleId}>{titleFor(kind, firstNameOf(account.first_name))}</h2><p>{messageFor(kind)}</p></div>
    <span className="greeting-toast__spark greeting-toast__spark--one" aria-hidden="true">✦</span><span className="greeting-toast__spark greeting-toast__spark--two" aria-hidden="true">✦</span>
  </div>;
}
