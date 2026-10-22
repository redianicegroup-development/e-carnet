"use client";

import { useState } from "react";
import Link from "next/link";
import { apiPost } from "../infrastructure/api/client";
import { useProfessionalProfile, type Membership } from "./ClinicalGate";
import { useConfirm } from "./modal/ConfirmProvider";
import { PageHeader } from "./ui/PageHeader";
import { CollapsibleSection } from "./ui/CollapsibleSection";
import { EstablishmentLogo } from "./EstablishmentLogo";
import "./establishment-logo.css";

const STATUS: Record<Membership["status"], { label: string; css: string }> = {
  pending: { label: "En attente de l’établissement", css: "pending" },
  active: { label: "Rattachement actif", css: "active" },
  refused: { label: "Refusé", css: "refused" },
  suspended: { label: "Suspendu", css: "suspended" },
  terminated: { label: "Terminé", css: "suspended" },
};

export function ProfessionalAccess() {
  const state = useProfessionalProfile();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const confirm = useConfirm();

  if (state.status === "loading") return <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /><i /></div>;
  if (state.status === "error") return <p className="notice" role="alert">{state.message}</p>;
  if (state.status === "missing") return <section className="card gate"><h2>Complétez d’abord votre profil</h2><p className="muted">Le rattachement à un établissement demande un profil professionnel.</p><div className="actions"><a className="button primary" href="/professionnel/onboarding">Compléter mon profil</a></div></section>;

  const { profile, reload } = state;
  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setMessage("");
    try { await action(); setMessage(done); reload(); window.dispatchEvent(new Event("ecarnet:professional-updated")); } catch (error) { setMessage(error instanceof Error ? error.message : "Action impossible."); } finally { setBusy(false); }
  }

  return (
    <div className="stack-lg">
      <PageHeader eyebrow="Établissement" title="Mon rattachement" lead="L’établissement vérifie le médecin et ses justificatifs en interne. Mon E‑Carnet ne collecte pas ces pièces : l’application enregistre la décision de rattachement prise par l’établissement." />

      <section className="card" aria-labelledby="code-title">
        <span className="eyebrow">Rattachement</span>
        <h2 id="code-title">Saisir mon code médecin</h2>
        <p className="muted">Le code est à usage unique et expire 48 h après sa création. Après votre demande, l’administrateur nominatif confirme ou refuse le rattachement. La décision est journalisée.</p>
        <form onSubmit={(event) => { event.preventDefault(); void run(async () => { await apiPost("/api/v1/establishments/join-codes/redeem/", { code: code.trim(), agreement_accepted: agreementAccepted, agreement_version: "2026-10-08-v1" }); setCode(""); setAgreementAccepted(false); }, "Demande envoyée. L’administrateur de l’établissement doit maintenant la confirmer."); }}>
          <label className="field"><span>Code médecin</span><input className="mono" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" spellCheck={false} required minLength={6} placeholder="XXXX-XXXX" disabled={busy} /></label>
          <label className="field"><span><input type="checkbox" required checked={agreementAccepted} onChange={(event) => setAgreementAccepted(event.target.checked)} disabled={busy} /> J’accepte les <Link href="/conditions-rattachement" target="_blank" rel="noreferrer">conditions d’accès et de rattachement médecin</Link>, notamment la confidentialité de l’établissement et des patients, l’exactitude des informations médicales et la conservation de l’historique après fin du rattachement.</span></label>
          <button className="button primary" type="submit" disabled={busy || !agreementAccepted || code.trim().length < 6}>{busy ? "Envoi…" : "Envoyer ma demande"}</button>
        </form>
        <p className="status" role="status" aria-live="polite">{message}</p>
      </section>

      <CollapsibleSection title="Mes rattachements" initiallyOpen>
        {profile.memberships.length === 0 ? <p className="empty">Aucun rattachement pour le moment. Saisissez le code remis par votre établissement.</p> : (
          <div className="stack">
            {profile.memberships.map((membership) => {
              const isActive = membership.establishment_id === profile.active_establishment;
              return (
                <article className="record membership-row" key={membership.id}>
                  <div className="membership-row__who">
                    <EstablishmentLogo logo={membership.establishment_logo} name={membership.establishment_name} />
                    <div>
                      <strong>{membership.establishment_name}</strong>
                      <p className="muted">{membership.city}</p>
                      <div className="actions">
                        {membership.status === "active" && !isActive && <button type="button" className="button small" disabled={busy} onClick={() => void run(() => apiPost("/api/v1/establishments/active/", { establishment_id: membership.establishment_id }), "Établissement actif mis à jour.")}>Choisir comme actif</button>}
                        {membership.status === "active" && <button type="button" className="button small danger" disabled={busy} onClick={() => { void confirm({ title: "Mettre fin à ce rattachement ?", message: "Vos accès cliniques futurs à cet établissement seront bloqués.", note: "Les consultations et l’historique existants ne sont pas supprimés.", confirmLabel: "Mettre fin au rattachement", cancelLabel: "Garder le rattachement", tone: "danger", mood: "farewell" }).then((ok) => { if (ok) void run(() => apiPost(`/api/v1/establishments/${membership.establishment_id}/memberships/leave/`, {}), "Rattachement terminé. L’historique et les dossiers existants restent conservés."); }); }}>Mettre fin à mon rattachement</button>}
                      </div>
                    </div>
                  </div>
                  <div className="membership-row__status">
                    <span className={`badge ${STATUS[membership.status].css}`}>{STATUS[membership.status].label}</span>
                    {isActive && <span className="badge verified">Établissement actif</span>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
