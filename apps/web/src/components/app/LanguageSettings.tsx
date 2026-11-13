"use client";

import { useState, useSyncExternalStore } from "react";
import { useConfirm } from "../modal/ConfirmProvider";
import { Icon } from "../ui/Icon";
import { LANGUAGES, hasTranslateConsent, readStoredLanguage, rememberTranslateConsent, storeLanguage, writeTranslateCookie, type AppLanguage } from "../../lib/language";

function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/** Langue enregistrée sur l'appareil. Le serveur ne la connaît pas : il affiche le français, puis le navigateur lit son choix (pas de décalage à l'hydratation). */
export function useStoredLanguage(): AppLanguage {
  return useSyncExternalStore(subscribeToStorage, () => readStoredLanguage(), (): AppLanguage => "fr");
}

/** Paramètres › Langue : français par défaut, anglais et arabe traduits par Google Translate. */
export function LanguageSettings() {
  const confirm = useConfirm();
  const current = useStoredLanguage();
  const [busy, setBusy] = useState(false);

  async function choose(code: AppLanguage) {
    if (code === current || busy) return;
    if (code !== "fr" && !hasTranslateConsent()) {
      const ok = await confirm({
        title: "Traduire avec Google Translate ?",
        message: "Pour afficher l’application en anglais ou en arabe, le texte des pages que vous ouvrez est envoyé à Google Translate, un service de Google, qui le traduit.",
        note: "Traduction automatique : elle peut contenir des erreurs. Pour un médicament, une dose ou un résultat, fiez-vous toujours au texte français ou demandez à votre médecin. Vous pouvez revenir au français à tout moment.",
        confirmLabel: "Traduire",
        cancelLabel: "Rester en français",
        tone: "neutral",
      });
      if (!ok) return;
      rememberTranslateConsent();
    }
    setBusy(true);
    storeLanguage(code);
    writeTranslateCookie(code);
    window.location.reload(); // revenir au texte d'origine ou traduire proprement : on repart d'une page neuve
  }

  return (
    <div className="settings-modal-section">
      <span className="eyebrow">Langue de l’application</span>
      <p className="muted">Le français est la langue de l’application. L’anglais et l’arabe sont obtenus par traduction automatique.</p>
      <div className="language-options" role="radiogroup" aria-label="Langue de l’application">
        {LANGUAGES.map((language) => (
          <button
            type="button"
            role="radio"
            aria-checked={language.code === current}
            className="language-option"
            key={language.code}
            disabled={busy}
            onClick={() => void choose(language.code)}
          >
            <span className="language-option__names notranslate" translate="no">
              <strong lang={language.code} dir={language.dir}>{language.native}</strong>
              {language.code !== language.native.toLowerCase() && <span>{language.label}</span>}
            </span>
            {language.code === current && <span className="language-option__check" aria-hidden="true"><Icon name="check" size={22} /></span>}
          </button>
        ))}
      </div>
    </div>
  );
}
