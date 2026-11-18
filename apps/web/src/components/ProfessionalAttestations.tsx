"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../infrastructure/api/client";
import { attachmentUrl, attestShare, proList, proReminder, proSummary, requestShareInfo, sizeLabel, type ProDeclaration, type ProList, type ProSummary, type Reminder } from "../application/attestations";
import { formatDay, formatWhen } from "./access/access-history";
import { useConfirm } from "./modal/ConfirmProvider";
import { PanelDialog } from "./modal/PanelDialog";
import { Icon } from "./ui/Icon";
import "./attestations.css";

const message = (caught: unknown, fallback: string) => (caught instanceof ApiError ? caught.message : fallback);

function Item({ item, onDone, onError }: { item: ProDeclaration; onDone: (text: string) => void; onError: (text: string) => void }) {
  const confirm = useConfirm();
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);

  async function attest() {
    if (!(await confirm({ title: "Attester cette information ?", message: `Vous attestez avoir examiné « ${item.label} » et ses justificatifs pour ${item.patient_name}. L’attestation est enregistrée à votre nom, avec votre signature.`, note: "Elle ne couvre que ce qui est affiché ici.", confirmLabel: "Attester" }))) return;
    setBusy(true);
    try { await attestShare(item.id); onDone("Déclaration attestée."); } catch (caught) { onError(message(caught, "Attestation impossible.")); } finally { setBusy(false); }
  }
  async function ask() {
    setBusy(true);
    try { await requestShareInfo(item.id, question); setAsking(false); setQuestion(""); onDone("Demande envoyée au patient."); } catch (caught) { onError(message(caught, "Envoi impossible.")); } finally { setBusy(false); }
  }

  return (
    <li className="card stack">
      <div><strong>{item.patient_name}</strong><p className="muted">{item.kind_label}{item.event_date ? `, ${formatDay(item.event_date)}` : ""}. Partagée le {formatDay(item.shared_at)}.</p></div>
      <h4>{item.label}</h4>
      {item.details && <p>{item.details}</p>}
      {item.info_message && <p className="muted">Votre demande au patient : {item.info_message}</p>}
      {item.attachments.length > 0 ? <ul className="attest-files">{item.attachments.map((file) => <li key={file.id}><a href={attachmentUrl("professional", file.id)} target="_blank" rel="noopener noreferrer">{file.name}</a> ({sizeLabel(file.size_bytes)})</li>)}</ul> : <p className="muted">Aucun justificatif joint.</p>}
      {item.blocked_reason && <p className="notice" role="status">{item.blocked_reason}</p>}
      <div className="attest-actions">
        <button type="button" className="button primary" disabled={busy || !item.can_attest} onClick={() => void attest()}>Attester</button>
        <button type="button" className="button" disabled={busy} onClick={() => setAsking(!asking)}>Demander une précision</button>
      </div>
      {asking && (
        <form className="stack" onSubmit={(event) => { event.preventDefault(); void ask(); }}>
          <label className="field"><span>Que faut-il préciser ou ajouter ?</span><input required minLength={5} maxLength={300} value={question} onChange={(event) => setQuestion(event.target.value)} /></label>
          <button type="submit" className="button primary" disabled={busy}>Envoyer au patient</button>
        </form>
      )}
    </li>
  );
}

/* Fenêtre de travail (PanelDialog, pas une fiche de personne) des déclarations partagées avec l'établissement actif. Seuls les professionnels attestent (pas l'administrateur de l'établissement).
   Tant que le patient n'a pas été reçu dans l'établissement, la déclaration attend ; à sa première consultation, un rappel apparaît. */
function AttestationModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<ProList | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => { try { setData(await proList()); } catch (caught) { setError(message(caught, "Impossible de charger les déclarations.")); } }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial depuis l’API.
  useEffect(() => { void load(); }, [load]);
  const done = (text: string) => { setNotice(text); setError(""); void load(); };
  const fail = (text: string) => { setError(text); setNotice(""); };
  return (
    <PanelDialog title="Déclarations à attester" lead="Envoyées par des patients à votre établissement" onClose={onClose}>
      {notice && <p className="notice" role="status">{notice}</p>}
      {error && <p className="notice" role="alert">{error}</p>}
      {!data && !error && <p className="muted">Chargement…</p>}
      {data && (
        <>
          <section className="stack"><h3>À attester ({data.to_attest.length})</h3>
            {data.to_attest.length === 0 ? <p className="muted">Aucune déclaration prête à être attestée.</p> : <ul className="attest-list">{data.to_attest.map((item) => <Item key={item.id} item={item} onDone={done} onError={fail} />)}</ul>}
          </section>
          {data.waiting.length > 0 && (
            <section className="stack"><h3>En attente de la première consultation ({data.waiting.length})</h3>
              <ul className="attest-list">{data.waiting.map((item) => <Item key={item.id} item={item} onDone={done} onError={fail} />)}</ul>
            </section>
          )}
          {data.reported.length > 0 && (
            <section className="stack"><h3>Erreurs signalées par des patients ({data.reported.length})</h3>
              <ul className="attest-list">{data.reported.map((item) => <li key={item.id} className="card"><strong>{item.patient_name}</strong><p>{item.label}, attestée par {item.attested_by}.</p><p className="muted">Signalement du {formatWhen(item.error_reported_at)} : {item.error_message}</p></li>)}</ul>
            </section>
          )}
        </>
      )}
    </PanelDialog>
  );
}

/* Tuile de l'accueil professionnel. */
export function ProfessionalAttestationsTile() {
  const [summary, setSummary] = useState<ProSummary | null>(null);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => { proSummary().then(setSummary).catch(() => setSummary(null)); }, []);
  useEffect(() => { load(); }, [load]);
  if (!summary?.allowed) return null;
  return (
    <section className="card attest-tile" aria-labelledby="attest-tile-title">
      <div className="attest-tile__head">
        <span className="carnet-accordion__badge" aria-hidden="true"><Icon name="pencil" size={22} /></span>
        <div><h2 id="attest-tile-title">Déclarations à attester</h2><p className="muted">{summary.to_attest} prête{summary.to_attest > 1 ? "s" : ""}{summary.waiting > 0 ? `, ${summary.waiting} en attente d’une première consultation` : ""}</p></div>
        {summary.to_attest > 0 && <span className="attest-tile__count" aria-label={`${summary.to_attest} à attester`}>{summary.to_attest}</span>}
      </div>
      <button type="button" className="button" onClick={() => setOpen(true)}>Ouvrir</button>
      {open && <AttestationModal onClose={() => { setOpen(false); load(); }} />}
    </section>
  );
}

/* Rappel pendant une consultation : le patient dont l'accès est actif a des déclarations à faire attester. */
export function ProfessionalAttestationReminder({ grantId }: { grantId: string }) {
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => { if (!grantId) { setReminder(null); return; } proReminder(grantId).then(setReminder).catch(() => setReminder(null)); }, [grantId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial depuis l’API.
  useEffect(() => { load(); }, [load]);
  if (!reminder || reminder.count === 0) return null;
  return (
    <p className="notice" role="status">
      Ce patient a {reminder.count} déclaration{reminder.count > 1 ? "s" : ""} à faire attester : {reminder.items.map((item) => item.label).join(", ")}.{" "}
      <button type="button" className="button" onClick={() => setOpen(true)}>Voir et attester</button>
      {open && <AttestationModal onClose={() => { setOpen(false); load(); }} />}
    </p>
  );
}
