"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch } from "../infrastructure/api/client";

type Profile = { specialty: string };

export function ProfessionalOnboarding({ returnTo }: { returnTo?: string }) {
  const router = useRouter();
  const [specialties, setSpecialties] = useState<string[] | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [otherSpecialty, setOtherSpecialty] = useState("");
  const [message, setMessage] = useState("Chargement des spécialités…");
  const [busy, setBusy] = useState(false);
  const isOther = selectedSpecialty === "__other__";

  useEffect(() => {
    let active = true;
    Promise.all([
      apiGet<string[]>("/api/v1/professionals/specialties/"),
      apiGet<Profile>("/api/v1/professionals/me/").catch(() => null),
    ]).then(([options, profile]) => {
      if (!active) return;
      setSpecialties(options);
      if (profile?.specialty) setSelectedSpecialty(profile.specialty);
      setMessage("Choisissez votre spécialité ou ajoutez une nouvelle option.");
    }).catch((error) => {
      if (active) setMessage(error instanceof Error ? error.message : "Impossible de charger les spécialités.");
    });
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const specialty = (isOther ? otherSpecialty : selectedSpecialty).trim();
    if (!specialty || specialty === "__other__") {
      setMessage("Choisissez une spécialité ou saisissez votre rôle dans « Autre ».");
      return;
    }
    setBusy(true);
    setMessage("Enregistrement du profil…");
    try {
      await apiPatch("/api/v1/professionals/onboarding/", { specialty });
      setMessage("Spécialité déclarée. L’établissement vérifiera le professionnel en interne.");
      router.push(returnTo ?? "/professionnel/onboarding/ordonnance");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Le profil n’a pas pu être enregistré.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card auth-form" onSubmit={submit}>
      <span className="eyebrow">Profil professionnel</span>
      <h1>Déclarez votre rôle clinique.</h1>
      <p className="muted">Mon E‑Carnet ne vérifie pas les justificatifs médicaux et ne demande ici aucun numéro professionnel. L’établissement effectue ses vérifications en interne ; l’application enregistre ensuite sa décision de rattachement.</p>

      <label className="field">
        <span>Profession</span>
        <select value="Médecin" disabled aria-label="Profession">
          <option value="Médecin">Médecin</option>
        </select>
      </label>

      <label className="field">
        <span>Spécialité / rôle déclaré</span>
        <select required value={selectedSpecialty} onChange={(event) => setSelectedSpecialty(event.target.value)} disabled={!specialties || busy}>
          <option value="" disabled>Choisir une spécialité</option>
          {(specialties ?? []).map((specialty) => <option key={specialty} value={specialty}>{specialty}</option>)}
          <option value="__other__">Autre — ajouter une spécialité</option>
        </select>
      </label>

      {isOther && <label className="field">
        <span>Nouvelle spécialité / rôle</span>
        <input required maxLength={120} value={otherSpecialty} onChange={(event) => setOtherSpecialty(event.target.value)} placeholder="Ex. Pédiatre" disabled={busy} />
        <small className="muted">Après l’enregistrement, cette option sera ajoutée à la liste partagée. Elle reste déclarative et n’est pas certifiée par Mon E‑Carnet.</small>
      </label>}

      <button type="submit" className="button primary" disabled={busy || !specialties}>{busy ? "Enregistrement…" : "Enregistrer mon profil"}</button>
      <p className="status" role="status" aria-live="polite">{message}</p>
    </form>
  );
}
