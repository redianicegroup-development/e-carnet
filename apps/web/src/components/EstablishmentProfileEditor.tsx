"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, apiGet, apiPatch } from "../infrastructure/api/client";
import { AvatarPicker } from "./AvatarPicker";

/* Formulaire unique de la structure, utilisé à trois endroits : la fiche d'onboarding (« all »), « Informations administratives »
   (« identity ») et « Coordonnées » (« contact ») des paramètres. Une seule source pour les règles :
   - modifiables : logo, nom (pré‑rempli, tout renommage est daté et visible de l'équipe), type, ville, adresse / BP (facultative), téléphone ;
   - verrouillés : l'e‑mail (celui du compte avec lequel l'équipe a ouvert l'accès) et le responsable. */
export type EstablishmentProfile = {
  id: string;
  name: string;
  responsible_name: string;
  internal_code: string | null;
  establishment_type: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  logo: string;
  status: string;
  updated_at: string | null;
  name_updated_at: string | null;
  original_name: string;
  profile_complete: boolean;
};
export type EditorScope = "all" | "identity" | "contact";
type Load = { status: "loading" } | { status: "error"; message: string; unauthorized: boolean } | { status: "ready"; profile: EstablishmentProfile };
type Values = { name: string; establishment_type: string; city: string; address: string; phone: string };

export const ESTABLISHMENT_TYPES = ["Clinique", "Hôpital", "Centre de santé", "Cabinet médical", "Laboratoire", "Pharmacie", "Autre"];
export const establishmentInitials = (name: string) => name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "ET";
const when = (value: string | null) => (value ? new Date(value).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "");

type Props = {
  scope: EditorScope;
  /** Sans identifiant, la structure active du compte est chargée. */
  establishmentId?: string;
  submitLabel?: string;
  /** Appelé après chaque enregistrement réussi ; `wasComplete` = la fiche était déjà complète avant (sert à l'enchaînement d'onboarding). */
  onSaved?: (profile: EstablishmentProfile, wasComplete: boolean) => void;
  onLoaded?: (profile: EstablishmentProfile) => void;
  onUnauthorized?: () => void;
  footer?: ReactNode;
};

export function EstablishmentProfileEditor({ scope, establishmentId, submitLabel = "Enregistrer", onSaved, onLoaded, onUnauthorized, footer }: Props) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [values, setValues] = useState<Values>({ name: "", establishment_type: ESTABLISHMENT_TYPES[0], city: "", address: "", phone: "" });
  const [logo, setLogo] = useState("");
  const [logoChanged, setLogoChanged] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchProfile() {
      let id = establishmentId;
      if (!id) {
        const items = await apiGet<{ id: string; status: string }[]>("/api/v1/establishments/");
        const own = items.find((item) => item.status === "active");
        if (!own) throw new Error("Aucun établissement actif n’est lié à ce compte.");
        id = own.id;
      }
      return apiGet<EstablishmentProfile>(`/api/v1/establishments/${id}/profile/`);
    }
    fetchProfile()
      .then((profile) => {
        if (!active) return;
        setValues({ name: profile.name, establishment_type: profile.establishment_type || ESTABLISHMENT_TYPES[0], city: profile.city, address: profile.address, phone: profile.phone });
        setLogo(profile.logo);
        setLogoChanged(false);
        setLoad({ status: "ready", profile });
        onLoaded?.(profile);
      })
      .catch((reason) => {
        if (!active) return;
        const unauthorized = reason instanceof ApiError && reason.status === 401;
        if (unauthorized) onUnauthorized?.();
        setLoad({ status: "error", unauthorized, message: reason instanceof Error ? reason.message : "Fiche indisponible." });
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chargement unique ; les rappels du parent sont lus au moment de l'appel
  }, [establishmentId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (load.status !== "ready") return;
    setBusy(true);
    setError("");
    setMessage("");
    const wasComplete = load.profile.profile_complete;
    const body: Record<string, string> = {};
    if (scope !== "contact") { body.name = values.name; body.establishment_type = values.establishment_type; }
    if (scope !== "identity") { body.city = values.city; body.address = values.address; body.phone = values.phone; }
    // Le logo n'est envoyé que s'il a changé : une URL déjà enregistrée ne se renvoie pas.
    if (scope !== "contact" && logoChanged) body.logo = logo;
    try {
      const saved = await apiPatch<EstablishmentProfile>(`/api/v1/establishments/${load.profile.id}/profile/`, body);
      setLoad({ status: "ready", profile: saved });
      setValues({ name: saved.name, establishment_type: saved.establishment_type || ESTABLISHMENT_TYPES[0], city: saved.city, address: saved.address, phone: saved.phone });
      setLogo(saved.logo);
      setLogoChanged(false);
      setMessage(`Enregistré le ${when(saved.updated_at)}. L’équipe Mon E‑Carnet voit cette mise à jour.`);
      onSaved?.(saved, wasComplete);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (load.status === "loading") return <p className="muted" role="status">Chargement…</p>;
  if (load.status === "error") return <p className="notice error" role="alert">{load.message}</p>;

  const { profile } = load;
  const set = (key: keyof Values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const identity = scope !== "contact";
  const contact = scope !== "identity";
  const renamed = Boolean(profile.name_updated_at && profile.original_name);

  return (
    <form className="grid establishment-editor" onSubmit={submit}>
      {identity && <>
        <div className="establishment-editor__logo">
          <AvatarPicker subject="logo" value={logo} onChange={(value) => { setLogo(value); setLogoChanged(true); }} fallback={establishmentInitials(values.name || profile.name)} disabled={busy} />
          <p className="muted">Logo de votre structure (facultatif). Touchez-le pour le changer ; il s’affiche dans votre espace et pour l’équipe Mon E‑Carnet.</p>
        </div>
        <label className="field"><span>Nom de l’établissement</span>
          <input required minLength={2} maxLength={180} autoComplete="organization" value={values.name} onChange={(event) => set("name", event.target.value)} disabled={busy} />
          <small className="muted">Pré‑rempli avec le nom vérifié par l’équipe. Si vous le modifiez, l’équipe en est informée (ancien nom et date conservés).</small>
        </label>
        <label className="field"><span>Type de structure</span>
          <select required value={values.establishment_type} onChange={(event) => set("establishment_type", event.target.value)} disabled={busy}>
            {[...new Set([values.establishment_type, ...ESTABLISHMENT_TYPES])].filter(Boolean).map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
      </>}

      {contact && <>
        <div className="field-row">
          <label className="field"><span>Ville</span><input required maxLength={120} autoComplete="address-level2" value={values.city} onChange={(event) => set("city", event.target.value)} disabled={busy} /></label>
          <label className="field"><span>Téléphone</span><input required type="tel" inputMode="tel" maxLength={32} autoComplete="tel" placeholder="+225 07 00 00 00 00" value={values.phone} onChange={(event) => set("phone", event.target.value)} disabled={busy} /></label>
        </div>
        <label className="field"><span>Adresse ou BP (facultatif)</span><input maxLength={240} autoComplete="street-address" value={values.address} onChange={(event) => set("address", event.target.value)} disabled={busy} /></label>
        <label className="field"><span>E‑mail de la structure (verrouillé)</span>
          <input type="email" value={profile.email} readOnly aria-readonly="true" autoComplete="off" />
          <small className="muted">C’est l’e‑mail du compte avec lequel votre accès a été ouvert : il ne se modifie pas ici.</small>
        </label>
        <label className="field"><span>Responsable (verrouillé)</span><input value={profile.responsible_name || "—"} readOnly aria-readonly="true" autoComplete="off" /></label>
      </>}

      <dl className="settings-details establishment-editor__meta">
        {identity && <div><dt>Code interne</dt><dd>{profile.internal_code ?? "Attribué après activation"}</dd></div>}
        {renamed && <div><dt>Nom vérifié à l’origine</dt><dd>{profile.original_name}</dd></div>}
        {profile.updated_at && <div><dt>Dernière mise à jour</dt><dd>{when(profile.updated_at)}</dd></div>}
      </dl>

      <button className="button primary" type="submit" disabled={busy}>{busy ? "Enregistrement…" : submitLabel}</button>
      {footer}
      <p className="notice" role="status" aria-live="polite" hidden={!message}>{message}</p>
      <p className="notice error" role="alert" hidden={!error}>{error}</p>
    </form>
  );
}
