"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { primeCsrf, readCsrfToken } from "../../infrastructure/api/client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export default function OnboardingPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function choose(role: "patient" | "professional") {
    setMessage("Préparation de votre espace…");
    await primeCsrf();
    const token = readCsrfToken();
    const response = await fetch(`${API}/api/v1/identity/contexts/select/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": token }, body: JSON.stringify({ role }) });
    if (!response.ok) { setMessage("Cette session n’est plus disponible. Reconnectez-vous."); return; }
    router.push(role === "patient" ? "/onboarding/patient" : "/professionnel/onboarding");
  }
  return <main className="shell onboarding-choice"><section className="hero-page"><span className="eyebrow">Étape 2 · votre contexte</span><h1>Comment allez-vous utiliser E-carnet ?</h1><p className="lead">Un seul compte. Choisissez votre espace ; vous pourrez compléter ses informations ensuite.</p><div className="grid"><button className="card choice-card" onClick={() => choose("patient")}><span className="choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></svg></span><strong>Je suis patient</strong><span className="muted">Mon carnet personnel, mes informations et mes autorisations.</span></button><button className="card choice-card" onClick={() => choose("professional")}><span className="choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg></span><strong>Je suis professionnel</strong><span className="muted">Mon profil, ma vérification, mon rattachement et mes patients autorisés.</span></button></div><p className="status" role="status">{message}</p></section></main>;
}
