"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch } from "../infrastructure/api/client";
import { Icon } from "./ui/Icon";
import { OnboardingNav } from "./onboarding/OnboardingChrome";

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
        setMessage(current.recovery_configured ? "Votre question de récupération est déjà configurée. Vous pouvez la remplacer." : "");
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "Impossible de vérifier votre compte.");
      });
    return () => { active = false; };
  }, []);

  const activeRole = (account?.contexts.find((item) => item.is_active) ?? account?.contexts[0])?.role;
  // Retour : un professionnel revient au bloc de l'étape 3 (carnet patient et profil professionnel), un patient à son carnet.
  const backHref = activeRole === "professional" ? "/onboarding/patient?suite=professionnel" : "/onboarding/patient";

  function destinationAfterRecovery() {
    const context = account?.contexts.find((item) => item.is_active) ?? account?.contexts[0];
    return context?.role === "professional" ? "/professionnel" : context?.role === "establishment" ? "/etablissement" : "/patient";
  }

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
      setMessage("Question de récupération enregistrée.");
      router.replace(destinationAfterRecovery());
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
      <p className="muted">Si vous oubliez votre mot de passe, cette question vous permet de choisir un nouveau mot de passe et de retrouver votre compte.</p>
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
      <p className="notice" role="note">Quiconque connaît cette réponse peut changer votre mot de passe : choisissez-en une que vous seul connaissez. Un code reçu par SMS viendra renforcer cette récupération plus tard.</p>
      <OnboardingNav backHref={backHref} nextLabel="Terminer" busy={busy} disabled={!account} />
      <p className="status" role="status" aria-live="polite">{message}</p>
    </form>
  );
}
