"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "../infrastructure/api/client";
import { useConfirm } from "./modal/ConfirmProvider";
import { InfoTip, SectionIntro } from "./ui/InfoTip";

type RequestType = "suspension" | "deletion";
type AccountActionRequest = {
  id: string;
  request_type: RequestType;
  suspension_days: number | null;
  reason: string;
  status: string;
  submitted_at: string;
  suspended_until: string | null;
  lifted_at: string | null;
  account_deleted?: boolean;
};

/* Motifs de suspension : le code serveur est stable, seule la phrase s'adapte à une PAUSE (la suppression, elle, ne demande plus de motif). */
const SUSPENSION_REASONS: { value: string; label: string }[] = [
  { value: "privacy", label: "Motif lié à la confidentialité" },
  { value: "experience", label: "Mon expérience ne correspond pas à mes besoins" },
  { value: "not_needed", label: "Je n’ai pas besoin du compte pour le moment" },
  { value: "duplicate", label: "J’ai un autre compte" },
  { value: "other", label: "Autre motif" },
];
const DURATIONS = [1, 7, 14, 30, 60, 90];
const formatDate = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

function suspensionState(item: AccountActionRequest): string {
  if (!item.suspended_until) return "Demande enregistrée avant la suspension immédiate";
  if (item.lifted_at) return `Terminée le ${formatDate(item.lifted_at)}`;
  return new Date(item.suspended_until) > new Date() ? `En cours jusqu’au ${formatDate(item.suspended_until)}` : "Terminée";
}

export function AccountActionRequestsSettingsClient({ isPrivileged }: { isPrivileged: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [requests, setRequests] = useState<AccountActionRequest[]>([]);
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadRequests = useCallback(async () => {
    try {
      setRequests(await apiGet<AccountActionRequest[]>("/api/v1/identity/me/account-requests/"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de charger l’historique.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRequests(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRequests]);

  async function submit(event: FormEvent<HTMLFormElement>, requestType: RequestType) {
    event.preventDefault();
    if (isPrivileged) {
      setMessage("Les comptes administrateur et superadministrateur sont protégés : ils ne se suspendent ni ne se suppriment depuis cet écran.");
      return;
    }
    if (requestType === "deletion") {
      const accepted = await confirm({
        title: "Supprimer votre compte définitivement ?",
        message: "Votre accès sera désactivé maintenant et vos données seront effacées de la base immédiatement : identité, carnet, documents, y compris ceux de vos enfants.",
        note: "Cette action est irréversible : rien ne pourra être récupéré. Aucun motif n’est demandé.",
        confirmLabel: "Supprimer mon compte",
        cancelLabel: "Garder mon compte",
        tone: "danger",
        mood: "farewell",
      });
      if (!accepted) return;
    } else {
      const accepted = await confirm({
        title: "Suspendre votre compte maintenant ?",
        message: `Vous serez déconnecté de tous vos appareils tout de suite. Votre compte se rouvrira de lui-même après ${days} jour(s) : il suffira de vous reconnecter à partir de cette date.`,
        note: "La suspension est immédiate. Pendant ce temps, personne ne peut ouvrir votre compte, et vos données ne sont pas supprimées.",
        confirmLabel: "Suspendre mon compte",
        cancelLabel: "Garder mon compte actif",
        tone: "danger",
      });
      if (!accepted) return;
    }
    setBusy(true);
    setMessage("");
    try {
      const payload = requestType === "suspension"
        ? { request_type: requestType, suspension_days: Number(days), reason, details: reason === "other" ? details.trim() : "" }
        : { request_type: requestType };
      await apiPost<AccountActionRequest>("/api/v1/identity/me/account-requests/", payload);
      router.replace(requestType === "deletion" ? "/connexion?accountDeleted=1" : "/connexion?accountSuspended=1");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "L’action n’a pas pu être effectuée.");
      setBusy(false);
    }
  }

  const suspensions = requests.filter((item) => item.request_type === "suspension");
  return <div className="settings-modal-section">
    <SectionIntro eyebrow="Gestion du compte">La suspension et la suppression sont <strong>immédiates</strong> : l’équipe n’a aucune demande à valider. La suppression ne demande aucun motif.</SectionIntro>

    <section className="card settings-subsection">
      <div className="section-intro"><h3>Suspendre mon compte</h3><InfoTip label="Plus d’informations : suspension du compte">Choisissez une durée et un motif. Le compte se ferme tout de suite et se rouvre tout seul à la fin de la durée.</InfoTip></div>
      {isPrivileged
        ? <p className="notice" role="note">Les comptes staff, administrateur et superadministrateur ne peuvent pas être suspendus depuis cette interface.</p>
        : <form className="settings-form" onSubmit={(event) => void submit(event, "suspension")}>
          <label className="field"><span>Durée</span><select value={days} onChange={(event) => setDays(event.target.value)} disabled={busy}>{DURATIONS.map((value) => <option key={value} value={value}>{value} jour{value > 1 ? "s" : ""}</option>)}</select></label>
          <label className="field"><span>Motif de suspension</span><select value={reason} onChange={(event) => setReason(event.target.value)} required disabled={busy}><option value="" disabled>Choisissez un motif</option>{SUSPENSION_REASONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          {reason === "other" && <label className="field"><span>Précisez votre motif</span><textarea value={details} onChange={(event) => setDetails(event.target.value)} required maxLength={1200} rows={3} disabled={busy} placeholder="Décrivez votre motif en quelques mots" /></label>}
          <button className="button secondary" type="submit" disabled={busy || !reason || (reason === "other" && !details.trim())}>{busy ? "Suspension…" : "Suspendre mon compte maintenant"}</button>
        </form>}
    </section>

    <section className="card settings-subsection">
      <div className="section-intro"><h3>Supprimer le compte</h3><InfoTip label="Plus d’informations : suppression du compte">Après confirmation, l’accès est désactivé et les données du compte sont effacées de la base immédiatement et définitivement, y compris les carnets de vos enfants. Aucun motif n’est demandé.</InfoTip></div>
      {isPrivileged
        ? <p className="notice" role="note">Les comptes staff, administrateur et superadministrateur ne peuvent pas être supprimés depuis cette interface.</p>
        : <form className="settings-form" onSubmit={(event) => void submit(event, "deletion")}>
          <button className="button danger" type="submit" disabled={busy}>{busy ? "Suppression…" : "Supprimer mon compte immédiatement"}</button>
        </form>}
    </section>

    {message && <p className="notice" role="status" aria-live="polite">{message}</p>}
    <section className="settings-subsection" aria-labelledby="account-request-history-title">
      <h3 id="account-request-history-title">Mes suspensions</h3>
      {loading ? <p className="muted">Chargement…</p> : suspensions.length === 0 ? <p className="muted">Aucune suspension.</p> : <div className="settings-provider-list">{suspensions.map((item) => <article className="card settings-subsection" key={item.id}>
        <div className="admin-feedback-head"><strong>{`Suspension · ${item.suspension_days} jour(s)`}</strong><span className="badge">{suspensionState(item)}</span></div>
        <p className="muted">Motif : {SUSPENSION_REASONS.find((entry) => entry.value === item.reason)?.label ?? item.reason}</p>
        <small className="muted">Demandée le {formatDate(item.submitted_at)}</small>
      </article>)}</div>}
    </section>
  </div>;
}
