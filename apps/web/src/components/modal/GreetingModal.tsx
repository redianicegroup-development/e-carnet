"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { SpaceId } from "../../lib/spaces";
import { WelcomeCharacter } from "../auth/WelcomeCharacter";
import { GooLayer } from "../ui/GooLayer";
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
  const toast = useRef<HTMLDivElement>(null);

  useEffect(() => { if (kind) markGreeted(account.id, kind); }, [account.id, kind]);
  useEffect(() => {
    if (!kind) return;
    const timer = window.setTimeout(() => setKind(null), 4200);
    return () => window.clearTimeout(timer);
  }, [kind]);

  if (!kind) return null;
  return <div className="greeting-stage"><div className="greeting-toast" ref={toast} data-kind={kind} role="status" aria-live="polite" aria-atomic="true" aria-labelledby={titleId}>
    <span className="greeting-toast__halo" aria-hidden="true" />
    <div className="greeting-toast__character" aria-hidden="true"><WelcomeCharacter mood="greet" /></div>
    <div className="greeting-toast__copy"><span className="greeting-toast__eyebrow">Votre espace <span className="notranslate" translate="no">Mon E‑Carnet</span></span><h2 id={titleId}>{titleFor(kind, firstNameOf(account.first_name))}</h2><p>{messageFor(kind)}</p></div>
    {/* Le même astérisque jaune que le héro de la landing et la page de connexion (trois traits, bouts arrondis), à la place des étoiles vertes. */}
    <svg className="greeting-toast__spark greeting-toast__spark--one" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2 3.8 16.8" /></svg><svg className="greeting-toast__spark greeting-toast__spark--two" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2 3.8 16.8" /></svg>
  </div>
  <GooLayer target={toast} />
  </div>;
}
