"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "../infrastructure/api/client";
import "./join-codes.css";
import { expiryLabel, usableCodes, type ActiveJoinCode } from "../lib/join-codes";

/* « Code à remettre à un médecin » : les codes valables restent affichés pendant leurs 48 h (le serveur les conserve chiffrés),
   puis disparaissent d'eux-mêmes. Un code utilisé par un médecin disparaît aussi : il ne sert qu'une fois. */
export function EstablishmentJoinCodes({ establishmentId, active, onChange }: { establishmentId: string; active: boolean; onChange?: () => void }) {
  const [loadedCodes, setLoadedCodes] = useState<{ establishmentId: string; codes: ActiveJoinCode[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(() => apiGet<ActiveJoinCode[]>(`/api/v1/establishments/${establishmentId}/join-codes/active/`), [establishmentId]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void load().then((result) => {
      if (!cancelled) setLoadedCodes({ establishmentId, codes: result });
    }).catch((error: unknown) => {
      if (cancelled) return;
      setLoadedCodes({ establishmentId, codes: [] });
      setMessage(error instanceof Error ? error.message : "Codes indisponibles.");
    });
    return () => { cancelled = true; };
  }, [active, establishmentId, load]);
  // Le compte à rebours suit l'heure : un code qui expire pendant que l'écran est ouvert disparaît sans recharger.
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);

  async function create() {
    setBusy(true); setMessage("");
    try { await apiPost(`/api/v1/establishments/${establishmentId}/join-codes/`, {}); setLoadedCodes({ establishmentId, codes: await load() }); onChange?.(); setMessage("Nouveau code créé. Remettez-le au médecin."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Le code n’a pas pu être créé."); }
    finally { setBusy(false); }
  }

  async function copy(code: string) {
    try { await navigator.clipboard.writeText(code); setCopied(code); window.setTimeout(() => setCopied((current) => (current === code ? "" : current)), 2000); }
    catch { setMessage("Copie impossible : sélectionnez le code et copiez-le à la main."); }
  }

  const codes = active && loadedCodes?.establishmentId === establishmentId ? loadedCodes.codes : null;
  const shown = usableCodes(codes ?? [], now);
  return <section className="card join-codes" aria-labelledby="code-title">
    <span className="eyebrow">Nouveau médecin</span>
    <h2 id="code-title">Code à remettre à un médecin</h2>
    <p className="muted">Un code est à usage unique et reste affiché 48 h, puis disparaît. Transmettez-le directement au médecin.</p>
    {codes === null && active ? <p className="empty" role="status">Chargement…</p> : shown.length > 0 && <ul className="join-codes__list" aria-live="polite">{shown.map((item) => <li key={item.id} className="join-codes__item">
      <p className="code-box">{item.code}</p>
      <div className="join-codes__meta"><span className="muted">{expiryLabel(item.expires_at, now)} · valable jusqu’au {new Date(item.expires_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span><button type="button" className="button small" onClick={() => void copy(item.code)}>{copied === item.code ? "Copié" : "Copier"}</button></div>
    </li>)}</ul>}
    {codes !== null && active && shown.length === 0 && <p className="empty">Aucun code actif pour le moment.</p>}
    <div className="actions"><button type="button" className="button primary" disabled={!active || busy} onClick={() => void create()}>{busy ? "Création…" : shown.length ? "Générer un autre code" : "Générer un code médecin"}</button></div>
    {!active && <p className="muted">Disponible quand l’établissement est activé.</p>}
    <p className="status" role="status" aria-live="polite">{message}</p>
  </section>;
}
