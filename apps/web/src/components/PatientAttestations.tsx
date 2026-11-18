"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError } from "../infrastructure/api/client";
import {
  ACCEPTED_FILES, KIND_OPTIONS, MAX_FILES, MAX_FILE_BYTES, attachmentUrl, createPatientDeclaration, listEstablishmentChoices, listPatientDeclarations, reportShareError, revokeShare, shareDeclaration, sizeLabel,
  type EstablishmentChoice, type PatientDeclaration, type Share,
} from "../application/attestations";
import { formatDay, formatWhen } from "./access/access-history";
import { useConfirm } from "./modal/ConfirmProvider";
import "./attestations.css";

const BADGE: Record<Share["status"], string> = { pending: "declared", info_requested: "measured", attested: "verified", revoked: "expired" };
const message = (caught: unknown, fallback: string) => (caught instanceof ApiError ? caught.message : fallback);

function EstablishmentPicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<EstablishmentChoice[] | null>(null);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => { listEstablishmentChoices(query.trim()).then((rows) => { if (active) setItems(rows); }).catch(() => { if (active) setItems([]); }); }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  return (
    <fieldset className="stack">
      <legend>Établissement qui recevra cette déclaration</legend>
      <label className="field"><span className="sr-only">Rechercher un établissement</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom ou ville" /></label>
      {items === null && <p className="muted">Chargement…</p>}
      {items && items.length === 0 && <p className="muted">Aucun établissement trouvé.</p>}
      <div className="attest-picker">
        {items?.map((item) => (
          <label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} /><span><strong>{item.name}</strong>{item.city ? `, ${item.city}` : ""}{item.recent && <span className="muted"> · déjà consulté</span>}</span></label>
        ))}
      </div>
    </fieldset>
  );
}

/* Section « Déclarations et mesures de santé » : faire attester une information avec ses justificatifs.
   Le patient choisit l'établissement ; seuls ses professionnels habilités la voient, et seulement cette déclaration. Partage retirable à tout moment. */
export function PatientAttestations() {
  const confirm = useConfirm();
  const [items, setItems] = useState<PatientDeclaration[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("allergy");
  const [label, setLabel] = useState("");
  const [details, setDetails] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [sharing, setSharing] = useState<string | null>(null);
  const [extra, setExtra] = useState<string[]>([]);
  const [reporting, setReporting] = useState<string | null>(null);
  const [report, setReport] = useState("");

  const load = useCallback(async () => {
    try { setItems(await listPatientDeclarations()); } catch (caught) { setItems([]); setError(message(caught, "Impossible de charger vos déclarations.")); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function pickFiles(list: FileList | null) {
    const next = Array.from(list ?? []);
    const tooBig = next.find((file) => file.size > MAX_FILE_BYTES);
    if (next.length > MAX_FILES) { setError(`${MAX_FILES} justificatifs au plus.`); return; }
    if (tooBig) { setError(`« ${tooBig.name} » dépasse 8 Mo.`); return; }
    setError(""); setFiles(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    const form = new FormData();
    form.append("kind", kind); form.append("label", label); form.append("details", details); form.append("event_date", eventDate);
    files.forEach((file) => form.append("files", file));
    chosen.forEach((id) => form.append("establishment_ids", id));
    try {
      await createPatientDeclaration(form);
      setNotice(chosen.length ? "Déclaration enregistrée et partagée. Elle reste « déclarée » tant qu’un professionnel ne l’a pas attestée." : "Déclaration enregistrée. Vous pourrez la partager avec un établissement quand vous voulez.");
      setLabel(""); setDetails(""); setEventDate(""); setFiles([]); setChosen([]); setOpen(false);
      await load();
    } catch (caught) { setError(message(caught, "Enregistrement impossible.")); }
    finally { setBusy(false); }
  }

  async function act(run: () => Promise<PatientDeclaration>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await run(); setNotice(success); await load(); } catch (caught) { setError(message(caught, "Action impossible.")); }
    finally { setBusy(false); }
  }

  async function withdraw(share: Share) {
    if (!(await confirm({ title: `Retirer le partage avec ${share.establishment_name} ?`, message: "Les professionnels de cet établissement ne verront plus cette déclaration ni ses justificatifs.", note: share.status === "attested" ? "L’attestation déjà donnée reste dans votre historique." : undefined, confirmLabel: "Retirer le partage", tone: "danger" }))) return;
    await act(() => revokeShare(share.id), "Partage retiré.");
  }

  const names = (ids: string[]) => ids.length;
  return (
    <section className="card stack" aria-labelledby="attest-title">
      <h2 id="attest-title">Faire attester une information</h2>
      <p className="muted">Une allergie, un antécédent, une intervention ou un implant : ajoutez vos justificatifs (PDF, PNG, JPG, DOCX) et choisissez l’établissement. Un professionnel pourra l’attester. Jusque-là, elle reste « déclarée ».</p>
      {notice && <p className="notice" role="status">{notice}</p>}
      {error && <p className="notice" role="alert">{error}</p>}
      {!open && <button type="button" className="button primary" onClick={() => { setOpen(true); setNotice(""); }}>Ajouter une information</button>}
      {open && (
        <form className="stack" onSubmit={submit}>
          <label className="field"><span>Catégorie</span><select value={kind} onChange={(event) => setKind(event.target.value)}>{KIND_OPTIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
          <label className="field"><span>Titre</span><input required minLength={3} maxLength={160} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ex. Pacemaker, allergie à la pénicilline" /></label>
          <label className="field"><span>Description (facultatif)</span><textarea maxLength={2000} rows={3} value={details} onChange={(event) => setDetails(event.target.value)} /></label>
          <label className="field"><span>Date (facultatif)</span><input type="date" max={new Date().toISOString().slice(0, 10)} value={eventDate} onChange={(event) => setEventDate(event.target.value)} /></label>
          <label className="field"><span>Justificatifs (facultatif, {MAX_FILES} fichiers de 8 Mo au plus)</span><input type="file" multiple accept={ACCEPTED_FILES} onChange={(event) => pickFiles(event.target.files)} /></label>
          {files.length > 0 && <ul className="attest-files">{files.map((file) => <li key={file.name}>{file.name} ({sizeLabel(file.size)})</li>)}</ul>}
          <EstablishmentPicker selected={chosen} onChange={setChosen} />
          {names(chosen) > 0 && <p className="notice">Cette déclaration et ses justificatifs seront visibles par les professionnels habilités de l’établissement choisi, et par eux seulement. Aucune autre partie de votre carnet n’est ouverte. Vous pouvez retirer le partage à tout moment.</p>}
          <div className="attest-actions">
            <button type="submit" className="button primary" disabled={busy}>{busy ? "Enregistrement…" : chosen.length ? "Enregistrer et partager" : "Enregistrer sans partager"}</button>
            <button type="button" className="button" onClick={() => setOpen(false)}>Annuler</button>
          </div>
        </form>
      )}

      {items && items.length > 0 && <h3>Mes informations à faire attester</h3>}
      <ul className="attest-list">
        {items?.map((item) => (
          <li key={item.id} className="card stack">
            <div><strong>{item.label}</strong><p className="muted">{item.kind_label}{item.event_date ? `, ${formatDay(item.event_date)}` : ""}</p></div>
            {item.details && <p>{item.details}</p>}
            {item.attachments.length > 0 && <ul className="attest-files">{item.attachments.map((file) => <li key={file.id}><a href={attachmentUrl("patient", file.id)} target="_blank" rel="noopener noreferrer">{file.name}</a> ({sizeLabel(file.size_bytes)})</li>)}</ul>}
            {item.shares.length === 0 && <p className="muted">Non partagée : elle reste « déclarée ».</p>}
            {item.shares.map((share) => (
              <div key={share.id} className="attest-share">
                <div className="attest-row"><strong>{share.establishment_name}</strong><span className={`badge ${BADGE[share.status]}`}>{share.status_label}</span></div>
                {share.status === "pending" && <p className="muted">En attente d’un professionnel de l’établissement. Elle sera attestée après votre première consultation sur place.</p>}
                {share.status === "info_requested" && <p>Le professionnel demande : {share.info_message}</p>}
                {share.attestation && <p>Attestée par {share.attestation.professional_name}, {share.attestation.professional_title}, le {formatWhen(share.attestation.attested_at)}.</p>}
                {share.error_reported_at && <p className="muted">Erreur signalée : {share.error_message}</p>}
                <div className="attest-actions">
                  <button type="button" className="button" disabled={busy} onClick={() => void withdraw(share)}>Retirer le partage</button>
                  {share.status === "attested" && !share.error_reported_at && <button type="button" className="button" onClick={() => { setReporting(reporting === share.id ? null : share.id); setReport(""); }}>Signaler une erreur</button>}
                </div>
                {reporting === share.id && (
                  <form className="stack" onSubmit={(event) => { event.preventDefault(); void act(() => reportShareError(share.id, report), "Signalement envoyé.").then(() => setReporting(null)); }}>
                    <label className="field"><span>Quelle est l’erreur ?</span><input required minLength={5} maxLength={300} value={report} onChange={(event) => setReport(event.target.value)} /></label>
                    <button type="submit" className="button primary" disabled={busy}>Envoyer</button>
                  </form>
                )}
              </div>
            ))}
            <div>
              {sharing !== item.id
                ? <button type="button" className="button" onClick={() => { setSharing(item.id); setExtra([]); }}>Partager avec {item.shares.length ? "un autre établissement" : "un établissement"}</button>
                : (
                  <div className="stack">
                    <EstablishmentPicker selected={extra} onChange={setExtra} />
                    <div className="attest-actions">
                      <button type="button" className="button primary" disabled={busy || extra.length === 0} onClick={() => void act(() => shareDeclaration(item.id, extra), "Déclaration partagée.").then(() => setSharing(null))}>Partager</button>
                      <button type="button" className="button" onClick={() => setSharing(null)}>Annuler</button>
                    </div>
                  </div>
                )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
