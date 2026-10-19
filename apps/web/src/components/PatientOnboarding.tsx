"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiGet, apiPatch, apiPost } from "../infrastructure/api/client";

/* Couverture du carnet papier : nom, prénoms, ville, adresse (BP), profession, « délivré le ».
   Obligatoires : nom, prénoms, ville. Le reste est facultatif. Aucune donnée d'origine ethnique : sensible et sans utilité clinique ici. */
type Form = {
  first_name: string;
  last_name: string;
  city: string;
  address: string;
  profession: string;
  phone: string;
  birth_date: string;
  gender: string;
  coverage_provider: string;
  coverage_number: string;
  coverage_expiry: string;
};
type Account = { first_name?: string; last_name?: string };
type PatientProfile = { created_at?: string; phone?: string; birth_date?: string | null; gender?: string; address?: string; profession?: string; coverage_provider?: string; coverage_number?: string; coverage_expiry?: string | null };
type Declaration = { kind: string; label: string };

const EMPTY_FORM: Form = { first_name: "", last_name: "", city: "", address: "", profession: "", phone: "", birth_date: "", gender: "", coverage_provider: "", coverage_number: "", coverage_expiry: "" };
const GENDER_OPTIONS = [{ value: "female", label: "Femme" }, { value: "male", label: "Homme" }, { value: "other", label: "Autre" }, { value: "prefer_not_to_say", label: "Je préfère ne pas préciser" }];

/* L'âge n'est jamais saisi à la main : il se déduit de la date de naissance et reste donc juste dans le temps. */
function ageLabel(birthDate: string): string {
  if (!birthDate) return "";
  const birth = new Date(`${birthDate}T00:00:00`);
  const today = new Date();
  if (Number.isNaN(birth.getTime()) || birth > today) return "";
  let years = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) years -= 1;
  if (years > 130) return "";
  if (years >= 1) return `${years} an${years > 1 ? "s" : ""}`;
  const months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth() - (today.getDate() < birth.getDate() ? 1 : 0);
  return months >= 1 ? `${months} mois` : "moins d’un mois";
}

const DELIVERY_DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export function PatientOnboarding() {
  const router = useRouter();
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [issuedAt, setIssuedAt] = useState<Date>(() => new Date());
  const [message, setMessage] = useState("Complétez uniquement les informations utiles à votre carnet.");
  const [submitting, setSubmitting] = useState(false);

  // Les informations déjà connues (compte, profil, ville) préremplissent l'écran : un retour en arrière ne fait rien perdre.
  useEffect(() => {
    let active = true;
    Promise.allSettled([
      apiGet<Account>("/api/v1/identity/me/"),
      apiGet<PatientProfile>("/api/v1/patient/profile/"),
      apiGet<Declaration[]>("/api/v1/patient/declarations/"),
    ]).then(([account, profile, declarations]) => {
      if (!active) return;
      setForm((current) => ({
        ...current,
        first_name: account.status === "fulfilled" ? account.value.first_name ?? "" : current.first_name,
        last_name: account.status === "fulfilled" ? account.value.last_name ?? "" : current.last_name,
        city: declarations.status === "fulfilled" ? declarations.value.find((item) => item.kind === "city")?.label ?? "" : current.city,
        phone: profile.status === "fulfilled" ? profile.value.phone ?? "" : current.phone,
        birth_date: profile.status === "fulfilled" ? profile.value.birth_date ?? "" : current.birth_date,
        gender: profile.status === "fulfilled" ? profile.value.gender ?? "" : current.gender,
        address: profile.status === "fulfilled" ? profile.value.address ?? "" : current.address,
        profession: profile.status === "fulfilled" ? profile.value.profession ?? "" : current.profession,
        coverage_provider: profile.status === "fulfilled" ? profile.value.coverage_provider ?? "" : current.coverage_provider,
        coverage_number: profile.status === "fulfilled" ? profile.value.coverage_number ?? "" : current.coverage_number,
        coverage_expiry: profile.status === "fulfilled" ? profile.value.coverage_expiry ?? "" : current.coverage_expiry,
      }));
      if (profile.status === "fulfilled" && profile.value.created_at) setIssuedAt(new Date(profile.value.created_at));
    });
    return () => { active = false; };
  }, []);

  function update(field: keyof Form, value: string) { setForm((current) => ({ ...current, [field]: value })); }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const firstName = form.first_name.trim();
    const lastName = form.last_name.trim();
    const city = form.city.trim();
    if (!lastName || !firstName || !city) { setMessage("Le nom, les prénoms et la ville sont obligatoires."); return; }
    setSubmitting(true);
    setMessage("Enregistrement…");
    try {
      // Chaque appel est répétable sans risque : en cas d'échec au milieu, un nouvel essai reprend sans doublon.
      await apiPatch("/api/v1/identity/me/profile/", { first_name: firstName, last_name: lastName });
      await apiPost("/api/v1/patient/declarations/", { kind: "city", label: city });
      await apiPatch("/api/v1/identity/onboarding/patient/", {
        phone: form.phone.trim(),
        birth_date: form.birth_date || null,
        gender: form.gender,
        address: form.address.trim(),
        profession: form.profession.trim(),
        coverage_provider: form.coverage_provider.trim(),
        coverage_number: form.coverage_number.trim(),
        coverage_expiry: form.coverage_expiry || null,
      });
      router.push("/onboarding/securite");
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) setMessage("Connectez-vous à nouveau pour terminer votre onboarding.");
      else setMessage(error instanceof Error ? error.message : "Impossible de joindre le service. Vérifiez votre connexion puis réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  return <form className="card auth-form" onSubmit={submit}>
    <span className="eyebrow">Étape 3 · identité du titulaire</span>
    <h1>Ouvrir votre carnet.</h1>
    <p className="muted">Comme sur la couverture du carnet papier. Seuls le nom, les prénoms et la ville sont obligatoires ; l’âge et le genre se renseignent ici si vous le souhaitez, et vous pourrez tout modifier depuis votre profil.</p>
    <p className="notice" role="note">Utilisez des informations exactes et gardez votre compte personnel.</p>
    <div className="titulaire-cover" aria-label="Couverture du carnet">
      <strong>Carnet individuel de santé</strong>
      <span>Délivré le <time dateTime={issuedAt.toISOString()}>{DELIVERY_DATE.format(issuedAt)}</time></span>
    </div>
    <div className="auth-name-grid">
      <label className="field"><span>Nom</span><input required autoComplete="family-name" maxLength={80} value={form.last_name} onChange={event => update("last_name", event.target.value)} /></label>
      <label className="field"><span>Prénoms</span><input required autoComplete="given-name" maxLength={80} value={form.first_name} onChange={event => update("first_name", event.target.value)} /></label>
    </div>
    <label className="field"><span>Ville</span><input required autoComplete="address-level2" maxLength={120} value={form.city} onChange={event => update("city", event.target.value)} /></label>
    <label className="field"><span>Adresse ou BP (facultatif)</span><input autoComplete="street-address" maxLength={240} value={form.address} onChange={event => update("address", event.target.value)} /></label>
    <label className="field"><span>Profession (facultatif)</span><input maxLength={120} value={form.profession} onChange={event => update("profession", event.target.value)} /></label>
    <label className="field"><span>Téléphone (facultatif)</span><input autoComplete="tel" value={form.phone} onChange={event => update("phone", event.target.value)} /></label>
    <fieldset className="onboarding-age-gender">
      <legend>Âge et genre (facultatifs)</legend>
      <label className="field"><span>Date de naissance</span><input type="date" max={new Date().toISOString().slice(0, 10)} value={form.birth_date} onChange={event => update("birth_date", event.target.value)} /></label>
      <p className="onboarding-age-gender__age" role="status" aria-live="polite"><span>Âge</span><strong>{ageLabel(form.birth_date) || "calculé à partir de la date de naissance"}</strong></p>
      <label className="field"><span>Genre</span><select value={form.gender} onChange={event => update("gender", event.target.value)}><option value="">Non précisé</option>{GENDER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    </fieldset>
    <h2>Couverture (facultative)</h2>
    <label className="field"><span>Organisme</span><input value={form.coverage_provider} onChange={event => update("coverage_provider", event.target.value)} /></label>
    <label className="field"><span>Numéro</span><input value={form.coverage_number} onChange={event => update("coverage_number", event.target.value)} /></label>
    <label className="field"><span>Date d’expiration</span><input type="date" value={form.coverage_expiry} onChange={event => update("coverage_expiry", event.target.value)} /></label>
    <button className="button primary" type="submit" disabled={submitting}>{submitting ? "Enregistrement…" : "Ouvrir mon espace patient"}</button>
    <p className="status" role="status">{message}</p>
  </form>;
}
