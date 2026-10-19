"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch } from "../infrastructure/api/client";
import { Icon } from "./ui/Icon";

const QUESTIONS = [
  "Quel était le nom de votre première école ?",
  "Quel était votre ancien pseudonyme ?",
  "Quel surnom utilisiez-vous pendant votre enfance ?",
];

type Account = {
  recovery_configured: boolean;
  contexts: Array<{ role: string; is_active: boolean }>;
};

export function RecoverySetup() {
  const router = useRouter();
  const [questionChoice, setQuestionChoice] = useState(QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [message, setMessage] = useState("Vérification de votre compte…");
  const [busy, setBusy] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    let active = true;
    apiGet<Account>("/api/v1/identity/me/")
      .then((current) => {
        if (!active) return;
        setAccount(current);
        setMessage(current.recovery_configured
          ? "Votre question de récupération est déjà configurée. Vous pouvez la remplacer."
          : "Choisissez une question et une réponse dont vous vous souviendrez.");
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "Impossible de vérifier votre compte.");
      });
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = questionChoice === "__custom__" ? customQuestion.trim() : questionChoice;
    if (!question || !answer.trim()) {
      setMessage("Saisissez une question et une réponse.");
      return;
    }
    setBusy(true);
    setMessage("Enregistrement sécurisé…");
    try {
      await apiPatch("/api/v1/identity/me/recovery/", { question, answer });
      setAnswer("");
      setMessage("Méthode enregistrée. La réponse ne peut pas, à elle seule, ouvrir votre dossier médical.");
      const context = account?.contexts.find((item) => item.is_active) ?? account?.contexts[0];
      const destination = context?.role === "professional"
        ? "/professionnel"
        : context?.role === "establishment"
          ? "/etablissement"
          : "/patient";
      router.replace(destination);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible d’enregistrer cette méthode. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card auth-form" onSubmit={submit}>
      <span className="eyebrow">Étape 4 · récupération du compte</span>
      <h1>Sécurisez l’accès à votre compte.</h1>
      <p className="muted">Cette question est un indice de récupération complémentaire, pas une preuve d’identité suffisante pour accéder à votre dossier médical.</p>
      <label className="field">
        <span>Choisissez une question</span>
        <select value={questionChoice} onChange={(event) => setQuestionChoice(event.target.value)} disabled={busy}>
          {QUESTIONS.map((question) => <option key={question} value={question}>{question}</option>)}
          <option value="__custom__">Ma propre question</option>
        </select>
      </label>
      {questionChoice === "__custom__" && (
        <label className="field">
          <span>Votre question</span>
          <input required maxLength={200} value={customQuestion} onChange={(event) => setCustomQuestion(event.target.value)} disabled={busy} />
        </label>
      )}
      <label className="field">
        <span>Votre réponse secrète</span>
        <span className="auth-secret-field__control">
          <input
            required
            type={showAnswer ? "text" : "password"}
            autoComplete="off"
            maxLength={200}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            disabled={busy}
          />
          <button className="auth-secret-field__toggle" type="button" aria-label={showAnswer ? "Masquer la réponse secrète" : "Afficher la réponse secrète"} aria-pressed={showAnswer} onClick={() => setShowAnswer((visible) => !visible)}>
            <Icon name={showAnswer ? "eyeOff" : "eye"} size={20} />
          </button>
        </span>
      </label>
      <p className="notice" role="note">Évitez les informations visibles publiquement. La réponse est enregistrée sous forme hachée et ne sera jamais affichée. La récupération par question seule n’est pas activée ; une vérification supplémentaire, comme un SMS, sera nécessaire.</p>
      <button className="button primary" type="submit" disabled={busy || !account}>{busy ? "Enregistrement…" : "Enregistrer et terminer"}</button>
      <p className="status" role="status" aria-live="polite">{message}</p>
    </form>
  );
}
