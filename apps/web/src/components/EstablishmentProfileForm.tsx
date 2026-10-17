"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiGet, apiPatch } from "../infrastructure/api/client";
import { BrandMark } from "./ui/BrandMark";

type Establishment = { id: string; status: string };
type Profile = {
  id: string;
  name: string;
  responsible_name: string;
  internal_code: string | null;
  establishment_type: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  profile_complete: boolean;
};
type Values = Pick<Profile, "establishment_type" | "city" | "address" | "phone" | "email">;
type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; profile: Profile };

const TYPES = ["Clinique", "Hôpital", "Centre de santé", "Cabinet médical", "Laboratoire", "Pharmacie", "Autre"];
const next = "/connexion?next=%2Fetablissement%2Ffiche";

/* Fiche de l'établissement : étape d'onboarding après l'activation, puis page de modification. Le nom et le responsable
   sont vérifiés par l'équipe Mon E‑Carnet et affichés en lecture seule. Le serveur refuse toute modification de ces champs. */
export function EstablishmentProfileForm() {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [values, setValues] = useState<Values>({ establishment_type: TYPES[0], city: "", address: "", phone: "", email: "" });
  const [wasComplete, setWasComplete] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchProfile() {
      const items = await apiGet<Establishment[]>("/api/v1/establishments/");
      const own = items.find((item) => item.status === "active");
      if (!own) throw new Error("Aucun établissement actif n’est lié à ce compte.");
      return apiGet<Profile>(`/api/v1/establishments/${own.id}/profile/`);
    }
    fetchProfile()
      .then((profile) => {
        if (!active) return;
        setWasComplete(profile.profile_complete);
        setValues({ establishment_type: profile.establishment_type || TYPES[0], city: profile.city, address: profile.address, phone: profile.phone, email: profile.email });
        setLoad({ status: "ready", profile });
      })
      .catch((reason) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) { router.replace(next); return; }
        setLoad({ status: "error", message: reason instanceof Error ? reason.message : "Fiche indisponible." });
      });
    return () => { active = false; };
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (load.status !== "ready") return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await apiPatch<Profile>(`/api/v1/establishments/${load.profile.id}/profile/`, values);
      setLoad({ status: "ready", profile: saved });
      if (!wasComplete && saved.profile_complete) {
        setMessage("Fiche enregistrée. Dernière étape : sécuriser votre compte…");
        // Même enchaînement que les autres rôles : la récupération du compte vient après l'onboarding, sauf si elle existe déjà.
        const account = await apiGet<{ recovery_configured?: boolean }>("/api/v1/identity/me/").catch(() => null);
        router.push(account && !account.recovery_configured ? "/onboarding/securite" : "/etablissement");
        return;
      }
      setMessage("Fiche enregistrée.");
      setBusy(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Enregistrement impossible.");
      setBusy(false);
    }
  }

  const set = (key: keyof Values, value: string) => setValues((current) => ({ ...current, [key]: value }));

  return (
    <main className="auth-shell">
      <section className="card auth-form establishment-profile" aria-labelledby="profile-title">
        <span className="brand"><BrandMark /></span>
        <span className="eyebrow">{wasComplete ? "Fiche de l’établissement" : "Dernière étape"}</span>
        <h1 id="profile-title">{wasComplete ? "Modifier la fiche de votre établissement" : "Complétez la fiche de votre établissement"}</h1>
        {load.status === "loading" && <p className="muted" role="status">Chargement de la fiche…</p>}
        {load.status === "error" && <p className="notice error" role="alert">{load.message}</p>}
        {load.status === "ready" && (
          <form className="grid" onSubmit={submit}>
            <p className="muted">Ces informations aident les médecins à reconnaître votre structure. Tant qu’elles ne sont pas complètes, vous ne pouvez pas créer de code de rattachement.</p>
            <dl className="settings-details">
              <div><dt>Nom vérifié</dt><dd>{load.profile.name}</dd></div>
              <div><dt>Responsable</dt><dd>{load.profile.responsible_name || "—"}</dd></div>
              {load.profile.internal_code && <div><dt>Code interne</dt><dd>{load.profile.internal_code}</dd></div>}
            </dl>
            <p className="muted">Le nom et le responsable sont vérifiés par l’équipe Mon E‑Carnet. Pour les modifier, écrivez‑lui.</p>
            <label className="field"><span>Type de structure</span>
              <select required value={values.establishment_type} onChange={(event) => set("establishment_type", event.target.value)}>
                {[...new Set([values.establishment_type, ...TYPES])].filter(Boolean).map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <div className="field-row">
              <label className="field"><span>Ville</span><input required maxLength={120} autoComplete="address-level2" value={values.city} onChange={(event) => set("city", event.target.value)} /></label>
              <label className="field"><span>Téléphone</span><input required type="tel" maxLength={32} autoComplete="tel" placeholder="+225 07 00 00 00 00" value={values.phone} onChange={(event) => set("phone", event.target.value)} /></label>
            </div>
            <label className="field"><span>Adresse</span><textarea required rows={3} maxLength={240} autoComplete="street-address" value={values.address} onChange={(event) => set("address", event.target.value)} /></label>
            <label className="field"><span>E‑mail de contact de la structure</span><input required type="email" autoComplete="email" value={values.email} onChange={(event) => set("email", event.target.value)} /></label>
            <button className="button primary" type="submit" disabled={busy}>{wasComplete ? "Enregistrer les modifications" : "Enregistrer et accéder à mon espace"}</button>
            {wasComplete && <Link className="button" href="/etablissement/parametres">Retour aux paramètres</Link>}
          </form>
        )}
        <p className="notice" role="status" aria-live="polite" hidden={!message}>{message}</p>
        <p className="notice error" role="alert" hidden={!error}>{error}</p>
      </section>
    </main>
  );
}
