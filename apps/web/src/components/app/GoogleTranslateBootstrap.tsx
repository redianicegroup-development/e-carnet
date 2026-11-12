"use client";

import { useEffect } from "react";
import { languageInfo, readStoredLanguage, writeTranslateCookie } from "../../lib/language";
import "./language.css";

type TranslateElementCtor = new (options: Record<string, unknown>, elementId: string) => unknown;
declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: { translate?: { TranslateElement?: TranslateElementCtor } };
  }
}

let domPatched = false;
/* Google Translate enveloppe les textes dans des <font> : React retire ensuite un nœud qui n'est plus à sa place et lève
   « removeChild : le nœud n'est pas un enfant ». Contournement courant : ignorer ces appels devenus sans objet. */
function tolerateTranslatedDom() {
  if (domPatched) return;
  domPatched = true;
  const removeChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function patchedRemoveChild<T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return removeChild.call(this, child) as T;
  };
  const insertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function patchedInsertBefore<T extends Node>(this: Node, node: T, reference: Node | null): T {
    if (reference && reference.parentNode !== this) return node;
    return insertBefore.call(this, node, reference) as T;
  };
}

/** Monté une fois dans le layout. Français : rien n'est chargé (aucune requête vers Google). Autre langue choisie : sens d'écriture, puis traducteur. */
export function GoogleTranslateBootstrap() {
  useEffect(() => {
    const code = readStoredLanguage();
    const info = languageInfo(code);
    document.documentElement.lang = code;
    document.documentElement.dir = info.dir;
    writeTranslateCookie(code); // français : retire un cookie résiduel ; sinon le rétablit
    if (code === "fr" || document.getElementById("google-translate-script")) return;

    tolerateTranslatedDom();
    const holder = document.createElement("div");
    holder.id = "google_translate_element";
    holder.className = "gt-holder";
    holder.setAttribute("aria-hidden", "true");
    document.body.appendChild(holder);
    window.googleTranslateElementInit = () => {
      const Element = window.google?.translate?.TranslateElement;
      if (Element) new Element({ pageLanguage: "fr", includedLanguages: "fr,en,ar", autoDisplay: false }, "google_translate_element");
    };
    const script = document.createElement("script");
    script.id = "google-translate-script";
    script.async = true;
    script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    document.body.appendChild(script);
  }, []);
  return null;
}
