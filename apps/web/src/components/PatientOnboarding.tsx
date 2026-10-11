"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";
const API = "";
type Form = { phone: string; birth_date: string; address: string; coverage_provider: string; coverage_number: string; coverage_expiry: string };
const FIELD_LABELS: Record<string, string> = {
  phone: "Téléphone",
  birth_date: "Date de naissance",
  address: "Adresse",
  coverage_provider: "Organisme de couverture",
  coverage_number: "Numéro de couverture",
  coverage_expiry: "Date d’expiration",
};
function formatError(payload: Record<string, unknown>) {
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.detail === "string") return payload.detail;
  const errors = Object.entries(payload).flatMap(([field, value]) => {
    if (!Array.isArray(value)) return [];
    return [`${FIELD_LABELS[field] ?? field} : ${value.filter(item => typeof item === "string").join(" ")}`];
  });
  return errors.length ? errors.join(" · ") : "Vérifiez les informations saisies puis réessayez.";
}
export function PatientOnboarding() {
  const router = useRouter();
  const [form, setForm] = useState<Form>({ phone: "", birth_date: "", address: "", coverage_provider: "", coverage_number: "", coverage_expiry: "" });
  const [message, setMessage] = useState("Complétez uniquement les informations utiles à votre carnet.");
  const [submitting, setSubmitting] = useState(false);
  function update(field: keyof Form, value: string) { setForm(current => ({ ...current, [field]: value })); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("Enregistrement…");
    try {
      const csrf = await primeCsrf();
      if (!csrf.ok) { setMessage("Votre session de sécurité a expiré. Reconnectez-vous puis réessayez."); return; }
      const body = { ...form, birth_date: form.birth_date || null, coverage_expiry: form.coverage_expiry || null };
      const response = await fetch(`${API}/api/v1/identity/onboarding/patient/`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": readCsrfToken() },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) setMessage("Connectez-vous à nouveau pour terminer votre onboarding.");
        else setMessage(formatError(payload));
        return;
      }
      router.push("/patient");
    } catch {
      setMessage("Impossible de joindre le service. Vérifiez votre connexion puis réessayez.");
    } finally {
      setSubmitting(false);
    }
  }
  return <form className="card auth-form" onSubmit={submit}>
    <span className="eyebrow">Étape 1 · votre espace patient</span>
    <h1>Préparer votre carnet.</h1>
    <p className="muted">Vous pourrez modifier ces informations depuis votre profil. Les données médicales restent sous votre contrôle.</p>
    <p className="notice" role="note">Utilisez uniquement des données fictives pour le moment.</p>
    <label className="field"><span>Téléphone</span><input autoComplete="tel" value={form.phone} onChange={event => update("phone", event.target.value)} /></label>
    <label className="field"><span>Date de naissance (facultative)</span><input type="date" value={form.birth_date} onChange={event => update("birth_date", event.target.value)} /></label>
    <label className="field"><span>Adresse (facultative)</span><input value={form.address} onChange={event => update("address", event.target.value)} /></label>
    <h2>Couverture (facultative)</h2>
    <label className="field"><span>Organisme</span><input value={form.coverage_provider} onChange={event => update("coverage_provider", event.target.value)} /></label>
    <label className="field"><span>Numéro</span><input value={form.coverage_number} onChange={event => update("coverage_number", event.target.value)} /></label>
    <label className="field"><span>Date d’expiration</span><input type="date" value={form.coverage_expiry} onChange={event => update("coverage_expiry", event.target.value)} /></label>
    <button className="button primary" type="submit" disabled={submitting}>{submitting ? "Enregistrement…" : "Ouvrir mon espace patient"}</button>
    <p className="status" role="status">{message}</p>
  </form>;
}
