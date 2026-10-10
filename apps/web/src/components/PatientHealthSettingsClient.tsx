"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "../infrastructure/api/client";

type PatientProfile = {
  phone: string;
  birth_date: string | null;
  address: string;
  coverage_provider: string;
  coverage_number: string;
  coverage_expiry: string | null;
};
type Form = Omit<PatientProfile, "birth_date" | "coverage_expiry"> & { birth_date: string; coverage_expiry: string };

const emptyForm: Form = { phone: "", birth_date: "", address: "", coverage_provider: "", coverage_number: "", coverage_expiry: "" };
function dateInput(value: string | null | undefined) { return value ? value.slice(0, 10) : ""; }
function fromProfile(profile: PatientProfile): Form {
  return { ...profile, birth_date: dateInput(profile.birth_date), coverage_expiry: dateInput(profile.coverage_expiry) };
}

export function PatientHealthSettingsClient() {
  const [form, setForm] = useState<Form>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Chargement des informations déclaratives…");

  useEffect(() => {
    let active = true;
    apiGet<PatientProfile>("/api/v1/patient/profile/")
      .then((profile) => { if (active) { setForm(fromProfile(profile)); setMessage("Ces informations sont enregistrées sur votre carnet."); } })
      .catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "Impossible de charger les informations."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function update(field: keyof Form, value: string) { setForm((current) => ({ ...current, [field]: value })); }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("Enregistrement…");
    try {
      const profile = await apiPatch<PatientProfile>("/api/v1/patient/profile/", {
        ...form,
        birth_date: form.birth_date || null,
        coverage_expiry: form.coverage_expiry || null,
      });
      setForm(fromProfile(profile));
      setMessage("Informations déclaratives enregistrées dans votre carnet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-form" onSubmit={save}>
      <p className="muted">Ces renseignements restent déclaratifs. Ils ne sont pas présentés comme vérifiés par un professionnel.</p>
      <div className="settings-form-grid">
        <label className="field"><span>Téléphone</span><input autoComplete="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} disabled={loading || saving} /></label>
        <label className="field"><span>Date de naissance</span><input type="date" value={form.birth_date} onChange={(event) => update("birth_date", event.target.value)} disabled={loading || saving} /></label>
        <label className="field settings-form-grid__wide"><span>Adresse</span><input autoComplete="street-address" value={form.address} onChange={(event) => update("address", event.target.value)} disabled={loading || saving} /></label>
      </div>
      <h3>Couverture santé <span className="muted">(facultatif)</span></h3>
      <div className="settings-form-grid">
        <label className="field"><span>Organisme</span><input value={form.coverage_provider} onChange={(event) => update("coverage_provider", event.target.value)} disabled={loading || saving} /></label>
        <label className="field"><span>Numéro de couverture</span><input value={form.coverage_number} onChange={(event) => update("coverage_number", event.target.value)} disabled={loading || saving} /></label>
        <label className="field"><span>Date d’expiration</span><input type="date" value={form.coverage_expiry} onChange={(event) => update("coverage_expiry", event.target.value)} disabled={loading || saving} /></label>
      </div>
      <div className="actions"><button className="button primary" type="submit" disabled={loading || saving}>{saving ? "Enregistrement…" : "Enregistrer mes informations"}</button></div>
      <p className="status" role="status" aria-live="polite">{message}</p>
    </form>
  );
}
