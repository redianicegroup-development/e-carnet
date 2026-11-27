"use client";

import { DragEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiGet, apiPost, apiUpload } from "../infrastructure/api/client";
import { formatWhen } from "./access/access-history";
import { useConfirm } from "./modal/ConfirmProvider";
import { Icon } from "./ui/Icon";
import "./ad-banner.css";

type State = "scheduled" | "live" | "ended" | "withdrawn";
type Banner = { id: string; starts_at: string; ends_at: string; state: State; impressions: number; clicks: number; mobile_url: string };
type Listing = { ads_enabled: boolean; items: Banner[] };

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;
const STATE_LABEL: Record<State, string> = { scheduled: "Programmée", live: "En ligne", ended: "Terminée", withdrawn: "Retirée" };
const STATE_BADGE: Record<State, string> = { scheduled: "declared", live: "verified", ended: "measured", withdrawn: "contested" };

function localInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/* Console → Bannières : une image, deux aperçus (ordinateur, mobile), une période, « Publier ». Format 3:1, 1500 × 500 px conseillé. */
export function AdminBannersClient() {
  const confirm = useConfirm();
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [start, setStart] = useState(() => localInput(new Date()));
  const [end, setEnd] = useState(() => localInput(new Date(Date.now() + 30 * 86400000)));
  const [fx, setFx] = useState(50);
  const [fy, setFy] = useState(50);

  const load = useCallback(async () => {
    try { setListing(await apiGet<Listing>("/api/v1/advertising/admin/banners/")); setError(""); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Impossible de charger les bannières."); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial depuis l’API.
  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function pick(next: File | null) {
    if (next && !ACCEPTED.includes(next.type)) { setError("Format non accepté : choisissez une image PNG, JPG, WebP ou GIF."); return; }
    if (next && next.size > MAX_BYTES) { setError("Image trop lourde : 5 Mo au plus."); return; }
    setError("");
    if (preview) URL.revokeObjectURL(preview);
    setFile(next); setNatural(null); setFx(50); setFy(50);
    setPreview(next ? URL.createObjectURL(next) : "");
    if (!next && input.current) input.current.value = "";
  }
  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault(); setDragging(false);
    pick(event.dataTransfer.files?.[0] ?? null);
  }

  const ratioOk = natural ? Math.abs(natural.w / natural.h - 3) < 0.03 : true;
  const tooSmall = natural ? natural.w < 1200 || natural.h < 400 : false;
  const position = `${fx}% ${fy}%`;

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!file) { setError("Importez l’image de la bannière."); return; }
    const form = new FormData();
    form.append("image", file);
    form.append("starts_at", new Date(start).toISOString()); form.append("ends_at", new Date(end).toISOString());
    form.append("focus_x", String(fx / 100)); form.append("focus_y", String(fy / 100));
    setBusy(true); setError(""); setMessage("");
    try {
      const created = await apiUpload<{ overlaps: number }>("/api/v1/advertising/admin/banners/", form);
      setMessage(created.overlaps > 0 ? "Bannière publiée. Une autre est programmée à la même période : la plus récente s’affiche." : "Bannière publiée.");
      pick(null);
      await load();
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Publication impossible."); }
    finally { setBusy(false); }
  }

  async function withdraw(item: Banner) {
    if (!(await confirm({ title: "Retirer cette bannière ?", message: "Elle disparaît tout de suite de l’accueil des patients.", note: "Les compteurs sont conservés.", confirmLabel: "Retirer", tone: "danger" }))) return;
    try { await apiPost(`/api/v1/advertising/admin/banners/${item.id}/withdraw/`, {}); await load(); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Retrait impossible."); }
  }

  return (
    <div className="stack-lg">
      <section className="card stack">
        <h2>Nouvelle bannière</h2>
        <p className="muted">Une seule image suffit : les versions ordinateur et mobile sont générées automatiquement. Minimum 1200 × 400 px.</p>
        {listing && !listing.ads_enabled && <p className="notice" role="note">La diffusion aux patients est <strong>éteinte</strong> sur ce serveur (réglage <code>ADS_ENABLED</code>). Vous pouvez préparer des bannières : elles ne s’afficheront qu’une fois la diffusion allumée par l’hébergeur.</p>}
        <form className="ad-form" onSubmit={publish}>
          <label
            className="ad-drop" data-dragging={dragging ? "true" : undefined} data-filled={file ? "true" : undefined}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}
          >
            <input ref={input} className="ad-drop__input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => pick(event.target.files?.[0] ?? null)} />
            <span className="ad-drop__icon" aria-hidden="true"><Icon name="folder" size={26} /></span>
            {file
              ? <span className="ad-drop__text"><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)} Mo · touchez ou déposez une autre image pour remplacer</small></span>
              : <span className="ad-drop__text"><strong>{dragging ? "Relâchez pour déposer l’image" : "Déposez l’image ici ou touchez pour la choisir"}</strong><small>3:1 · 1500 × 500 px conseillé · PNG, JPG, WebP ou GIF · 5 Mo au plus</small></span>}
          </label>
          {file && <button className="button small ad-drop__clear" type="button" onClick={() => pick(null)}>Retirer l’image</button>}
          {file?.type === "image/gif" && <p className="muted">GIF : seule la première image est conservée.</p>}
          {preview && (
            <>
              {tooSmall && <p className="notice" role="alert">Image trop petite : 1200 × 400 px au minimum.</p>}
              {!ratioOk && (
                <div className="stack">
                  <p className="notice">Cette image n’est pas en 3:1, elle sera recadrée. Réglez le cadrage.</p>
                  <label className="field">Cadrage horizontal<input type="range" min={0} max={100} value={fx} onChange={(event) => setFx(Number(event.target.value))} /></label>
                  <label className="field">Cadrage vertical<input type="range" min={0} max={100} value={fy} onChange={(event) => setFy(Number(event.target.value))} /></label>
                </div>
              )}
              <div className="ad-previews">
                <figure><div className="ad-frame"><img src={preview} alt="" style={{ objectPosition: position }} onLoad={(event) => setNatural({ w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight })} /></div><figcaption className="muted">Aperçu ordinateur</figcaption></figure>
                <figure><div className="ad-frame ad-frame--mobile"><img src={preview} alt="" style={{ objectPosition: position }} /></div><figcaption className="muted">Aperçu mobile</figcaption></figure>
              </div>
            </>
          )}
          <div className="field-pair">
            <label className="field">Début<input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} required /></label>
            <label className="field">Fin<input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} required /></label>
          </div>
          <p className="muted">Pas de ciblage par donnée de santé. Pas de produit ni de traitement de santé dans cette première version.</p>
          {error && <p className="notice" role="alert">{error}</p>}
          {message && <p className="notice" role="status">{message}</p>}
          <button className="button primary" type="submit" disabled={busy || !file}>{busy ? "Publication…" : "Publier la bannière"}</button>
        </form>
      </section>

      <section className="card stack">
        <h2>Bannières</h2>
        {!listing && !error && <p className="muted">Chargement…</p>}
        {listing && listing.items.length === 0 && <p className="muted">Aucune bannière pour le moment.</p>}
        <ul className="ad-list">
          {listing?.items.map((item) => (
            <li key={item.id} className="card">
              <div className="ad-frame ad-frame--thumb"><img src={item.mobile_url} alt="Bannière sponsorisée" loading="lazy" /></div>
              <div><span className={`badge ${STATE_BADGE[item.state]}`}>{STATE_LABEL[item.state]}</span></div>
              <p className="muted">Du {formatWhen(item.starts_at)} au {formatWhen(item.ends_at)}. {item.impressions} affichages, {item.clicks} clics.</p>
              {(item.state === "live" || item.state === "scheduled") && <button type="button" className="button" onClick={() => void withdraw(item)}>Retirer</button>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
