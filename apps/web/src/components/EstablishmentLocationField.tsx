"use client";

import { useState } from "react";
import { apiPatch } from "../infrastructure/api/client";
import { DEFAULT_MAP_CENTER, isInCoteDIvoire, isValidPosition, type LatLng } from "../lib/geo";
import type { EstablishmentProfile } from "./EstablishmentProfileEditor";
import { LocationPicker } from "./LocationPicker";
import { useConfirm } from "./modal/ConfirmProvider";
import "./establishment-location-field.css";

/* Position de la structure, posée UNE fois puis conservée en base.
   - jamais déduite de l'adresse (trop imprécise) ;
   - deux présentations : « onboarding » = un seul bouton « Mettre ma position » (le GPS donne la latitude et la longitude, SANS carte) ;
     « settings » = en plus, une carte pour vérifier et déplacer l'épingle (depuis un ordinateur, le GPS est souvent faux) ;
   - enregistrée par sa propre requête (pas avec le reste de la fiche) : la position n'attend pas que le téléphone ou la ville soient saisis ;
   - si la ville ou l'adresse change plus tard, le serveur la déclare « à confirmer » et on la redemande ici. */
export type LocationStatus = "missing" | "to_confirm" | "confirmed";
export type LocationFields = {
  latitude?: number | null;
  longitude?: number | null;
  location_status?: LocationStatus;
  location_confirmed_at?: string | null;
  is_listed_in_directory?: boolean;
  can_be_listed?: boolean;
};

type Props = { profile: EstablishmentProfile; onProfileChange: (profile: EstablishmentProfile) => void; disabled?: boolean; variant?: "onboarding" | "settings" };

const dateOf = (value: string | null | undefined) => (value ? new Date(value).toLocaleDateString("fr-FR", { dateStyle: "long" }) : "");
/** Accepte la virgule décimale (« 5,3599 ») : c'est ainsi que la plupart des gens écrivent un nombre. */
function parseDecimal(raw: string): number | null {
  const value = raw.trim().replace(",", ".");
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
const toText = (position: LatLng) => ({ latitude: position.latitude.toFixed(6), longitude: position.longitude.toFixed(6) });

/** Au-delà de ce rayon d'incertitude, la position vient probablement du réseau (ordinateur, Wi‑Fi) et non d'un vrai GPS. */
const LOW_ACCURACY_METERS = 200;

function geolocationMessage(error: GeolocationPositionError, onboarding: boolean): string {
  const next = onboarding ? "Vous pourrez la placer plus tard sur la carte, dans Paramètres › Coordonnées." : "Placez l’épingle sur la carte.";
  if (error.code === error.PERMISSION_DENIED) return `Autorisation refusée : autorisez la localisation dans les réglages du navigateur. ${next}`;
  if (error.code === error.TIMEOUT) return `La localisation prend trop de temps. ${next}`;
  return `Position indisponible sur cet appareil. ${next}`;
}

export function EstablishmentLocationField({ profile, onProfileChange, disabled = false, variant = "settings" }: Props) {
  const confirm = useConfirm();
  const onboarding = variant === "onboarding";
  const status: LocationStatus = profile.location_status ?? "missing";
  const stored: LatLng | null = isValidPosition({ latitude: profile.latitude ?? undefined, longitude: profile.longitude ?? undefined }) ? { latitude: profile.latitude as number, longitude: profile.longitude as number } : null;
  const [draft, setDraft] = useState<LatLng | null>(null);
  const [text, setText] = useState({ latitude: "", longitude: "" });
  const [startZoom, setStartZoom] = useState(13);
  const [touched, setTouched] = useState(false);
  const [locating, setLocating] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const editing = draft !== null;
  const locked = disabled || busy;

  function place(position: LatLng, userAction: boolean) {
    setDraft(position);
    setText(toText(position));
    if (userAction) setTouched(true);
  }
  function startEditing(from?: LatLng) {
    const start = from ?? stored ?? DEFAULT_MAP_CENTER;
    setStartZoom(from || stored ? 17 : 13);
    setTouched(Boolean(from));
    setError("");
    setMessage("");
    place(start, Boolean(from));
  }
  function cancel() {
    setDraft(null);
    setNote("");
    setAccuracy(null);
    setError("");
  }
  function typed(key: "latitude" | "longitude", raw: string) {
    const nextText = { ...text, [key]: raw };
    setText(nextText);
    setTouched(true);
    const latitude = parseDecimal(nextText.latitude);
    const longitude = parseDecimal(nextText.longitude);
    if (latitude !== null && longitude !== null) setDraft({ latitude, longitude });
  }

  function locateMe() {
    setError("");
    setMessage("");
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError(onboarding ? "Cet appareil ne sait pas se localiser. Vous pourrez placer la position plus tard sur la carte, dans Paramètres › Coordonnées." : "Cet appareil ne sait pas se localiser. Placez l’épingle sur la carte.");
      return;
    }
    setLocating(true);
    // La position n'est demandée qu'à ce clic. Rien n'est enregistré avant « Enregistrer / Confirmer ».
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setLocating(false);
        const meters = Number.isFinite(result.coords.accuracy) ? Math.round(result.coords.accuracy) : null;
        setAccuracy(meters);
        setNote(onboarding
          ? `Position relevée${meters ? ` (précision d’environ ${meters} m)` : ""}. Enregistrez-la si vous êtes bien dans votre établissement.`
          : `Épingle placée d’après votre position${meters ? ` (précision d’environ ${meters} m)` : ""}. Vérifiez qu’elle est sur votre bâtiment : depuis un ordinateur, la position est souvent approximative.`);
        startEditing({ latitude: result.coords.latitude, longitude: result.coords.longitude });
      },
      (failure) => { setLocating(false); setError(geolocationMessage(failure, onboarding)); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function save(body: Record<string, unknown>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await apiPatch<EstablishmentProfile>(`/api/v1/establishments/${profile.id}/profile/`, body);
      onProfileChange(saved);
      setDraft(null);
      setNote("");
      setAccuracy(null);
      setMessage(success);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }
  function confirmPosition() {
    if (!draft) return;
    void save({ latitude: draft.latitude, longitude: draft.longitude }, "Position enregistrée. Elle reste en base : vous n’aurez pas à la refaire, sauf si vous changez d’adresse.");
  }
  async function removePosition() {
    const ok = await confirm({ title: "Retirer la position ?", message: "Votre établissement ne pourra plus apparaître dans la recherche des patients.", note: "Vous pourrez poser à nouveau l’épingle à tout moment.", confirmLabel: "Retirer", cancelLabel: "Garder", tone: "danger" });
    if (ok) await save({ latitude: null, longitude: null }, "Position retirée.");
  }
  const toggleListing = (next: boolean) => void save({ is_listed_in_directory: next }, next ? "Votre établissement apparaît maintenant dans la recherche des patients." : "Votre établissement n’apparaît plus dans la recherche des patients.");

  const valid = draft !== null && isValidPosition(draft);
  const inside = valid && isInCoteDIvoire(draft);
  const swapped = valid && !inside && isInCoteDIvoire({ latitude: draft.longitude, longitude: draft.latitude });
  const canConfirm = inside && (touched || stored !== null);
  const listed = Boolean(profile.is_listed_in_directory);
  const canList = profile.location_status === "confirmed" && profile.can_be_listed !== false;

  return (
    <fieldset className="location-field" disabled={disabled}>
      <legend>Position sur la carte</legend>
      <p className="muted">Les patients trouvent votre établissement parmi les établissements proches grâce à cette position. Vous la posez une seule fois : elle reste enregistrée.</p>
      {onboarding && !editing && status !== "confirmed" && <p className="muted">Touchez « Mettre ma position » quand vous êtes dans votre établissement : votre appareil relève sa latitude et sa longitude. Vous pourrez la vérifier sur la carte plus tard, dans Paramètres › Coordonnées.</p>}

      {!editing && <>
        {status === "missing" && <p className="notice" role="status">Aucune position enregistrée pour le moment.</p>}
        {status === "to_confirm" && <p className="notice location-field__warning" role="status">Votre adresse ou votre ville a changé : vérifiez que l’épingle est toujours sur votre bâtiment, puis confirmez. En attendant, votre établissement n’apparaît pas dans la recherche.</p>}
        {status === "confirmed" && <p className="notice" role="status">Position confirmée{profile.location_confirmed_at ? ` le ${dateOf(profile.location_confirmed_at)}` : ""}.</p>}
        <div className="actions location-field__actions">
          <button type="button" className={onboarding && status !== "confirmed" ? "button primary" : "button"} onClick={locateMe} disabled={locked || locating}>
            {locating ? "Localisation…" : onboarding ? (status === "missing" ? "Mettre ma position" : "Mettre à jour ma position") : "Utiliser ma position actuelle"}
          </button>
          {!onboarding && <button type="button" className={status === "confirmed" ? "button" : "button primary"} onClick={() => startEditing()} disabled={locked}>
            {status === "missing" ? "Placer sur la carte" : status === "to_confirm" ? "Vérifier et confirmer" : "Modifier la position"}
          </button>}
          {status !== "missing" && <button type="button" className="button" onClick={() => void removePosition()} disabled={locked}>Retirer</button>}
        </div>
      </>}

      {editing && draft && onboarding && <div className="location-field__editor">
        {note && <p className="notice" role="status">{note}</p>}
        <p className="location-field__reading">Latitude <strong>{text.latitude}</strong> · Longitude <strong>{text.longitude}</strong></p>
        {accuracy !== null && accuracy > LOW_ACCURACY_METERS && <p className="notice location-field__warning" role="alert">La précision est faible : la position vient sans doute du réseau et non du GPS. Pour un bon résultat, faites ceci depuis votre téléphone, sur place, ou placez l’épingle plus tard sur la carte (Paramètres › Coordonnées).</p>}
        {!inside && valid && <p className="notice error" role="alert">{swapped ? "La latitude et la longitude semblent inversées." : "Cette position est en dehors de la Côte d’Ivoire : vous n’êtes sans doute pas dans votre établissement."}</p>}
        <div className="actions location-field__actions">
          <button type="button" className="button primary" onClick={confirmPosition} disabled={locked || !canConfirm}>{busy ? "Enregistrement…" : "Enregistrer cette position"}</button>
          <button type="button" className="button" onClick={cancel} disabled={busy}>Annuler</button>
        </div>
      </div>}

      {editing && draft && !onboarding && <div className="location-field__editor">
        <p className="muted">Faites glisser la carte jusqu’à ce que la pointe de l’épingle soit sur l’entrée de votre bâtiment, puis confirmez.</p>
        {note && <p className="notice" role="status">{note}</p>}
        <LocationPicker value={draft} onChange={(position) => place(position, true)} initialZoom={startZoom} disabled={locked} />
        <div className="field-row">
          <label className="field"><span>Latitude</span><input inputMode="decimal" autoComplete="off" value={text.latitude} onChange={(event) => typed("latitude", event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} disabled={locked} aria-invalid={valid && !inside ? true : undefined} /></label>
          <label className="field"><span>Longitude</span><input inputMode="decimal" autoComplete="off" value={text.longitude} onChange={(event) => typed("longitude", event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} disabled={locked} aria-invalid={valid && !inside ? true : undefined} /></label>
        </div>
        {swapped && <p className="notice error" role="alert">La latitude et la longitude semblent inversées.</p>}
        {valid && !inside && !swapped && <p className="notice error" role="alert">Cette position est en dehors de la Côte d’Ivoire. Placez l’épingle sur votre bâtiment.</p>}
        {!touched && stored === null && <p className="muted">Déplacez la carte (ou utilisez votre position) pour pouvoir confirmer.</p>}
        <div className="actions location-field__actions">
          <button type="button" className="button primary" onClick={confirmPosition} disabled={locked || !canConfirm}>{busy ? "Enregistrement…" : "Confirmer cette position"}</button>
          <button type="button" className="button" onClick={cancel} disabled={busy}>Annuler</button>
        </div>
      </div>}

      <label className="location-field__listing">
        <input type="checkbox" checked={listed} onChange={(event) => toggleListing(event.target.checked)} disabled={locked || editing || (!listed && !canList)} />
        <span>
          <strong>Apparaître dans la recherche des patients</strong>
          <small className="muted">
            {canList || listed
              ? "Les patients et les professionnels verront le nom, le type, l’adresse, le téléphone et l’emplacement de votre établissement. Vous pouvez le retirer à tout moment."
              : "Disponible après confirmation de la position, une fois la fiche complète (type, ville, téléphone)."}
          </small>
        </span>
      </label>

      <p className="notice" role="status" aria-live="polite" hidden={!message}>{message}</p>
      <p className="notice error" role="alert" hidden={!error}>{error}</p>
    </fieldset>
  );
}
