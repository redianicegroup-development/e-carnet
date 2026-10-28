"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";
import { OnboardingNav } from "./onboarding/OnboardingChrome";

type Role = "patient" | "professional";
const API = "";

const OPTIONS: { role: Role; title: string; text: string; icon: React.ReactNode }[] = [
  { role: "patient", title: "Je suis patient", text: "Je gère mon carnet de santé et je choisis qui peut le voir.", icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg> },
  { role: "professional", title: "Je suis professionnel", text: "Je suis médecin : je consulte mes patients, avec leur accord.", icon: <svg viewBox="0 0 24 24"><path d="M6 4v6a4 4 0 0 0 8 0V4" /><circle cx="18" cy="16" r="3" /><path d="M14 10v2a4 4 0 0 0 1.2 2.9" /></svg> },
];

/* Étape 2 : on choisit son espace, puis « Suivant ». Un professionnel est aussi patient (un compte, deux espaces) : il remplit d'abord son carnet patient,
   puis son profil professionnel (suite de l'étape 3), puis la sécurité du compte (étape 4). */
export function RoleChoice({ initialRole }: { initialRole?: Role }) {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(initialRole ?? null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function next() {
    if (!role) { setMessage("Choisissez votre espace pour continuer."); return; }
    setBusy(true);
    setMessage("");
    try {
      await primeCsrf();
      const response = await fetch(`${API}/api/v1/identity/contexts/select/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": readCsrfToken() }, body: JSON.stringify({ role: "patient" }) });
      if (!response.ok) { setMessage("Cette session n’est plus disponible. Reconnectez-vous."); setBusy(false); return; }
      router.push(role === "patient" ? "/onboarding/patient" : "/onboarding/patient?suite=professionnel");
    } catch {
      setMessage("Impossible de joindre le service. Vérifiez votre connexion puis réessayez.");
      setBusy(false);
    }
  }

  return <section className="card auth-form">
    <span className="eyebrow">Étape 2 · votre espace</span>
    <h1>Vous êtes…</h1>
    <div className="role-options" role="radiogroup" aria-label="Votre espace">
      {OPTIONS.map((option) => <button key={option.role} type="button" role="radio" aria-checked={role === option.role} className="role-option" onClick={() => { setRole(option.role); setMessage(""); }}>
        <span className="choice-icon" aria-hidden="true">{option.icon}</span>
        <strong>{option.title}</strong>
        <span className="role-option__text">{option.text}</span>
        <span className="role-option__check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
      </button>)}
    </div>
    {role === "professional" && <p className="role-hint">Vous aurez aussi votre carnet patient.</p>}
    <OnboardingNav backHref="/onboarding/identite" type="button" onNext={() => void next()} busy={busy} disabled={!role} />
    <p className="status" role="status" aria-live="polite">{message}</p>
  </section>;
}
