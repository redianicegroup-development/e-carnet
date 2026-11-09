"use client";

import { useState } from "react";

type DemoState = "pending" | "granted" | "revoked" | "refused";

const TEXTS: Record<DemoState, { status: string; message: string; main: string; refuse: boolean }> = {
  pending: { status: "À examiner", message: "Un professionnel demande l’accès. Rien n’est visible tant que vous n’avez pas décidé.", main: "Autoriser", refuse: true },
  granted: { status: "Accès autorisé", message: "Le professionnel voit uniquement les informations de consultation, pendant 2 heures.", main: "Révoquer", refuse: true },
  revoked: { status: "Accès révoqué", message: "L’accès est arrêté. La décision reste dans votre historique.", main: "Rejouer l’exemple", refuse: false },
  refused: { status: "Demande refusée", message: "Le professionnel ne voit rien. La décision reste dans votre historique.", main: "Rejouer l’exemple", refuse: false },
};

/** Démonstration d'une demande d'accès : autoriser, révoquer ou refuser. Aucune donnée réelle, rien n'est envoyé. */
export function AccessDemo() {
  const [state, setState] = useState<DemoState>("pending");
  const text = TEXTS[state];
  function onMain() {
    setState(state === "pending" ? "granted" : state === "granted" ? "revoked" : "pending");
  }
  return (
    <div className="lp2-demo lp2-rv" id="demo" data-s={state}>
      <header><strong>Demande d’accès</strong><span className="lp2-st">{text.status}</span></header>
      <dl>
        <div><dt>Demandeur</dt><dd>Cabinet exemple</dd></div>
        <div><dt>Périmètre</dt><dd>Informations de consultation</dd></div>
        <div><dt>Durée</dt><dd>2 heures</dd></div>
      </dl>
      <div className="lp2-meter" aria-hidden="true"><i /></div>
      <p className="lp2-msg" aria-live="polite">{text.message}</p>
      <div className="lp2-btns" style={text.refuse ? undefined : { gridTemplateColumns: "1fr" }}>
        {text.refuse && <button type="button" onClick={() => setState("refused")}>Refuser</button>}
        <button type="button" className="lp2-main" onClick={onMain}>{text.main}</button>
      </div>
      <p className="lp2-tiny">Exemple illustré, sans donnée réelle</p>
    </div>
  );
}
