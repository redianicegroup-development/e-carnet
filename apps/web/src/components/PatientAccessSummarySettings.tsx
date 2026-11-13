"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { apiGet, apiPatch } from "../infrastructure/api/client";
import { ACCESS_SUMMARY_PATH, SUMMARY_CHOICES, describeLastSent, parseAccessSummaryPreference, summaryLabel, type AccessSummaryPreference, type SummaryFrequency } from "../lib/access-summary";
import "./access-summary-settings.css";

/* Réglage « Récapitulatif des accès » : la fréquence à laquelle le patient reçoit, dans ses notifications, un résumé de qui a lu son carnet.
   Le choix s'enregistre dès qu'on le fait ; en cas d'échec, l'ancien réglage reste affiché et le message dit pourquoi. */
export function PatientAccessSummarySettings() {
  const [preference, setPreference] = useState<AccessSummaryPreference | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const name = useId();

  useEffect(() => {
    let active = true;
    apiGet<unknown>(ACCESS_SUMMARY_PATH)
      .then((payload) => {
        if (!active) return;
        const parsed = parseAccessSummaryPreference(payload);
        if (parsed) { setPreference(parsed); setLoadError(""); } else setLoadError("Réponse inattendue du serveur.");
      })
      .catch((error: unknown) => { if (active) setLoadError(error instanceof Error ? error.message : "Réglage indisponible."); });
    return () => { active = false; };
  }, [attempt]);

  const choose = useCallback(async (frequency: SummaryFrequency) => {
    if (!preference || saving || frequency === preference.frequency) return;
    setSaving(true);
    setFailed(false);
    setMessage("Enregistrement…");
    try {
      const saved = parseAccessSummaryPreference(await apiPatch<unknown>(ACCESS_SUMMARY_PATH, { frequency }));
      if (!saved) throw new Error("Réponse inattendue du serveur.");
      setPreference(saved);
      setMessage(saved.frequency === "disabled" ? "Récapitulatif désactivé." : `Récapitulatif activé : ${summaryLabel(saved.frequency).toLowerCase()}.`);
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible. Votre réglage n’a pas changé.");
    } finally {
      setSaving(false);
    }
  }, [preference, saving]);

  if (!preference) {
    return (
      <div className="settings-modal-section">
        {loadError
          ? <><p className="status" role="alert">{loadError}</p><div className="actions"><button type="button" className="button" onClick={() => { setLoadError(""); setAttempt((value) => value + 1); }}>Réessayer</button></div></>
          : <p className="muted" role="status">Chargement du réglage…</p>}
      </div>
    );
  }

  return (
    <div className="settings-modal-section access-summary">
      <span className="eyebrow">Transparence des accès</span>
      <p className="muted">
        À la fréquence choisie, vous recevez dans vos notifications un récapitulatif des lectures de votre carnet, par type de structure. Il ne contient ni nom de professionnel ni information médicale.
        Si vous avez activé les notifications sur cet appareil, il arrive aussi sous cette forme.
      </p>
      <fieldset className="access-summary__choices" disabled={saving}>
        <legend className="eyebrow">Fréquence du récapitulatif</legend>
        {SUMMARY_CHOICES.map((choice) => (
          <label key={choice.value} className={`access-summary__choice${preference.frequency === choice.value ? " is-selected" : ""}`}>
            <input type="radio" name={name} value={choice.value} checked={preference.frequency === choice.value} onChange={() => void choose(choice.value)} />
            <span><strong>{choice.label}</strong><small>{choice.hint}</small></span>
          </label>
        ))}
      </fieldset>
      <p className="muted">{describeLastSent(preference.last_sent_at)}</p>
      <p className={failed ? "status" : "muted"} role={failed ? "alert" : "status"} aria-live="polite">{message}</p>
    </div>
  );
}
