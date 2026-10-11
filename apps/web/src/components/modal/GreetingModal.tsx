"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { SpaceId } from "../../lib/spaces";
import { decideGreeting, firstNameOf, markGreeted, readGreetingFlags, type GreetingKind } from "./greeting";
import { ModalIllustration } from "./ModalIllustration";
import { useDialogBehavior } from "./useDialogBehavior";

type Props = { account: { id: string; first_name: string; date_joined?: string }; space: SpaceId };

/* Texte du message de bienvenue : repris du discours produit déjà présent sur le site
   (consentement du patient, administration sans accès clinique). */
const WELCOME_TEXT: Record<SpaceId, string> = {
  patient: "Votre carnet est prêt. Vous gardez la main : rien n’est partagé sans votre accord, et vous pouvez retirer un accès à tout moment.",
  professional: "Votre espace professionnel est prêt. Un dossier ne s’ouvre qu’avec le consentement du patient, pour une durée limitée.",
  establishment: "Votre espace établissement est prêt. Vous administrez les rattachements des médecins, sans accès aux dossiers cliniques.",
};

function copyFor(kind: GreetingKind, firstName: string, space: SpaceId) {
  if (kind === "welcome") return { title: firstName ? `Bienvenue, ${firstName} !` : "Bienvenue !", text: WELCOME_TEXT[space], cta: "Découvrir mon espace", eyebrow: "E‑Carnet" };
  if (kind === "morning") return { title: firstName ? `Bonjour ${firstName}` : "Bonjour", text: "Bon retour parmi nous. Votre espace est prêt.", cta: "Continuer", eyebrow: "Content de vous voir" };
  return { title: firstName ? `Bonsoir ${firstName}` : "Bonsoir", text: "Bon retour parmi nous ce soir. Votre espace est prêt.", cta: "Continuer", eyebrow: "Content de vous voir" };
}

/* Modal d'accueil des espaces connectés : « Bienvenue » une seule fois pour un compte récent, puis
   « Bonjour / Bonsoir » une fois par session. Aucune donnée n'est envoyée au serveur (drapeaux locaux). */
export function GreetingModal({ account, space }: Props) {
  // Ce composant n'est monté qu'une fois le compte chargé côté client (SpaceShell) : lire le stockage dans l'initialiseur
  // est donc sans risque d'hydratation, et évite un setState synchrone dans un effet.
  const [kind, setKind] = useState<GreetingKind | null>(() => {
    const flags = readGreetingFlags(account.id);
    if (!flags.storageOk) return null; // stockage bloqué : on ne risque pas d'afficher la modal à chaque page
    return decideGreeting({ dateJoined: account.date_joined, now: new Date(), alreadyWelcomed: flags.alreadyWelcomed, alreadyGreetedThisSession: flags.alreadyGreetedThisSession });
  });
  const dialog = useRef<HTMLElement>(null);
  const cta = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const textId = useId();

  // Le drapeau est posé dès l'affichage : un rechargement ou un second onglet ne ré-affiche pas la modal.
  useEffect(() => { if (kind) markGreeted(account.id, kind); }, [account.id, kind]);

  const close = () => setKind(null);
  useDialogBehavior({ open: kind !== null, container: dialog, initialFocus: cta, onEscape: close });

  if (!kind) return null;
  const copy = copyFor(kind, firstNameOf(account.first_name), space);
  return (
    <div className="modal-backdrop modal-backdrop--greeting" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section ref={dialog} className="modal-dialog modal-greeting" data-kind={kind} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={textId}>
        <ModalIllustration mood={kind} size="lg" />
        <div className="modal-copy">
          <span className="eyebrow">{copy.eyebrow}</span>
          <h2 id={titleId}>{copy.title}</h2>
          <p id={textId} className="modal-message">{copy.text}</p>
        </div>
        <div className="modal-actions modal-actions--single">
          <button ref={cta} type="button" className="button primary" onClick={close}>{copy.cta}</button>
        </div>
      </section>
    </div>
  );
}
