"use client";

import { useState } from "react";
import Link from "next/link";
import { apiPost } from "../infrastructure/api/client";
import { useProfessionalProfile, type Membership } from "./ClinicalGate";
import { useConfirm } from "./modal/ConfirmProvider";
import { OutcomeDialog, type OutcomeDialogProps } from "./modal/OutcomeDialog";
import { CODE_ERROR_FALLBACK, errorReason, joinRequestSentCopy } from "../lib/access-outcome";
import { PageHeader } from "./ui/PageHeader";
import { CollapsibleSection } from "./ui/CollapsibleSection";
import { Profile, ProfileGrid } from "./ui/Profile";
import type { ProfileAction } from "./ui/ProfileSheet";
import { membershipProfile } from "./ProfessionalMembershipDetail";
import "./establishment-logo.css";

export function ProfessionalAccess() {
  const state = useProfessionalProfile();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [outcome, setOutcome] = useState<Omit<OutcomeDialogProps, "onClose"> | null>(null);
  const confirm = useConfirm();

  if (state.status === "loading") return <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /><i /></div>;
  if (state.status === "error") return <p className="notice" role="alert">{state.message}</p>;
  if (state.status === "missing") return <section className="card gate"><h2>Complétez d’abord votre profil</h2><p className="muted">Le rattachement à un établissement demande un profil professionnel.</p><div className="actions"><a className="button primary" href="/professionnel/onboarding">Compléter mon profil</a></div></section>;

  const { profile, reload } = state;
  /* Action d'une fiche de rattachement : en cas d'erreur elle est relancée, et la fiche affiche le motif. */
  async function perform(action: () => Promise<unknown>, done: { title: string; message: string }) {
    await action();
    setOutcome({ tone: "success", ...done });
    reload();
    window.dispatchEvent(new Event("ecarnet:professional-updated"));
  }
  function membershipActions(membership: Membership, isActive: boolean): ProfileAction[] {
    const actions: ProfileAction[] = [];
    if (membership.status === "active" && !isActive) {
      actions.push({ label: "Définir comme établissement actif", tone: "primary", onClick: async ({ close }) => {
        await perform(() => apiPost("/api/v1/establishments/active/", { establishment_id: membership.establishment_id }), { title: "Établissement actif", message: `${membership.establishment_name} est maintenant votre établissement actif pour les consultations.` });
        close();
      } });
    }
    if (membership.status === "active") {
      actions.push({ label: "Mettre fin à mon rattachement", tone: "danger", onClick: async ({ close }) => {
        const ok = await confirm({ title: "Mettre fin à ce rattachement ?", message: "Vos accès cliniques futurs à cet établissement seront bloqués.", note: "Les consultations et l’historique existants ne sont pas supprimés.", confirmLabel: "Mettre fin au rattachement", cancelLabel: "Garder le rattachement", tone: "danger", mood: "farewell" });
        if (!ok) return;
        await perform(() => apiPost(`/api/v1/establishments/${membership.establishment_id}/memberships/leave/`, {}), { title: "Rattachement terminé", message: "L’historique et les dossiers existants restent conservés." });
        close();
      } });
    }
    return actions;
  }

  /* Saisie du code médecin. Succès : la demande est envoyée à l'établissement, qui doit la confirmer (ce n'est pas encore un accès accordé).
     Erreur : le motif exact du serveur (code expiré, déjà utilisé, inconnu…) s'affiche dans un modal. */
  async function redeemCode() {
    setBusy(true);
    setMessage("");
    try {
      const sent = await apiPost<{ establishment_name?: string }>("/api/v1/establishments/join-codes/redeem/", { code: code.trim(), agreement_accepted: agreementAccepted, agreement_version: "2026-10-08-v1" });
      setCode(""); setAgreementAccepted(false);
      setMessage("Demande envoyée. L’administrateur de l’établissement doit maintenant la confirmer.");
      setOutcome({ tone: "success", ...joinRequestSentCopy(sent?.establishment_name ?? "") });
      reload();
      window.dispatchEvent(new Event("ecarnet:professional-updated"));
    } catch (error) {
      const reason = errorReason(error, CODE_ERROR_FALLBACK);
      setMessage(reason);
      setOutcome({ tone: "error", title: "Code refusé", message: reason });
    } finally { setBusy(false); }
  }

  return (
    <div className="stack-lg">
      {outcome && <OutcomeDialog {...outcome} onClose={() => setOutcome(null)} />}
      <PageHeader title="Mon rattachement" lead="Vous accédez à vos patients dès que votre établissement confirme votre rattachement." />

      <section className="card" aria-labelledby="code-title" data-tour="howto-attach">
        <span className="eyebrow">Rattachement</span>
        <h2 id="code-title">Saisir mon code médecin</h2>
        <p className="muted">Le code vous est remis par votre établissement. Il est valable 48 h. L’administrateur confirme ensuite votre rattachement.</p>
        <form onSubmit={(event) => { event.preventDefault(); void redeemCode(); }}>
          <label className="field"><span>Code médecin</span><input className="mono" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" spellCheck={false} required minLength={6} placeholder="XXXX-XXXX" disabled={busy} /></label>
          <label className="field"><span><input type="checkbox" required checked={agreementAccepted} onChange={(event) => setAgreementAccepted(event.target.checked)} disabled={busy} /> J’accepte les <Link href="/conditions-rattachement" target="_blank" rel="noreferrer">conditions d’accès et de rattachement médecin</Link>.</span></label>
          <button className="button primary" type="submit" disabled={busy || !agreementAccepted || code.trim().length < 6}>{busy ? "Envoi…" : "Envoyer ma demande"}</button>
        </form>
        <p className="status" role="status" aria-live="polite">{message}</p>
      </section>

      <div className="section-grid">
      <CollapsibleSection title="Mes rattachements" initiallyOpen icon="building" hint="Établissements">
        {profile.memberships.length === 0 ? <p className="empty">Aucun rattachement pour le moment. Saisissez le code remis par votre établissement.</p> : (
          <ProfileGrid label="Mes rattachements">
            {profile.memberships.map((membership) => {
              const isActive = membership.establishment_id === profile.active_establishment;
              const severalActive = profile.memberships.filter((entry) => entry.status === "active").length > 1;
              return <Profile key={membership.id} {...membershipProfile(membership, { isActive, severalActive })} actions={membershipActions(membership, isActive)} />;
            })}
          </ProfileGrid>
        )}
      </CollapsibleSection>
      </div>
    </div>
  );
}
