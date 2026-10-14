"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, apiGet, apiPost } from "../infrastructure/api/client";
import { useConfirm } from "./modal/ConfirmProvider";

type InvitationState = "pending" | "sent" | "failed" | "expired" | "revoked" | "consumed";
type Stage = "awaiting_activation" | "awaiting_profile" | "ready";
type Item = {
  id: string;
  name: string;
  internal_code: string | null;
  created_at: string;
  profile_completed_at: string | null;
  stage: Stage;
  administrator: { name: string; email: string } | null;
  invitation: { id: string; email: string; state: InvitationState; expires_at: string; sent_at: string | null } | null;
};
type Listing = { items: Item[]; total: number; truncated: boolean };
type Created = { expires_at: string; establishment: { internal_code: string | null } };

const BLANK = { name: "", email: "", firstName: "", lastName: "", verified: false };

/* Libellé et couleur de badge du suivi : une seule étiquette par structure, de l'invitation jusqu'à « Prête ». */
function followUp(item: Item): { label: string; tone: string } {
  if (item.stage === "ready") return { label: "Prête", tone: "active" };
  if (item.stage === "awaiting_profile") return { label: "Fiche à compléter", tone: "pending" };
  switch (item.invitation?.state) {
    case "pending": return { label: "Envoi en cours", tone: "pending" };
    case "sent": return { label: "Invitation envoyée", tone: "pending" };
    case "failed": return { label: "Échec d’envoi", tone: "rejected" };
    case "expired": return { label: "Invitation expirée", tone: "expired" };
    case "revoked": return { label: "Invitation révoquée", tone: "revoked" };
    default: return { label: "Sans invitation", tone: "expired" };
  }
}

const when = (value: string | null) => (value ? new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");
const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

/* L'équipe E‑Carnet saisit le nom vérifié de la structure et l'e‑mail de son responsable : l'invitation part par e‑mail
   (le lien n'est jamais affiché) et c'est l'établissement qui complète ensuite sa fiche dans son onboarding. */
export function AdminEstablishmentsClient({ aside }: { aside?: ReactNode }) {
  const confirm = useConfirm();
  const [form, setForm] = useState(BLANK);
  const [listing, setListing] = useState<Listing | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    apiGet<Listing>("/api/v1/establishments/startup/establishments/")
      .then((data) => { if (active) { setListing(data); setError(""); } })
      .catch((reason) => { if (active) setError(errorText(reason, "Liste indisponible.")); });
    return () => { active = false; };
  }, [tick]);

  const refresh = () => setTick((value) => value + 1);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await action();
      setMessage(success);
      refresh();
    } catch (reason) {
      setError(errorText(reason, "Action impossible."));
    } finally {
      setBusy(false);
    }
  }

  async function create(allowDuplicate: boolean) {
    const body = {
      name: form.name,
      responsible_email: form.email,
      responsible_first_name: form.firstName,
      responsible_last_name: form.lastName,
      verification_confirmed: form.verified,
      allow_duplicate: allowDuplicate || undefined,
    };
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const created = await apiPost<Created>("/api/v1/establishments/startup/establishments/", body);
      setMessage(`Accès créé${created.establishment.internal_code ? ` (code ${created.establishment.internal_code})` : ""}. L’invitation part à ${form.email.trim().toLowerCase()} ; elle expire le ${when(created.expires_at)}.`);
      setForm(BLANK);
      refresh();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409 && !allowDuplicate) {
        setBusy(false);
        const again = await confirm({ title: "Une structure porte déjà ce nom", message: reason.message, note: "Ne continuez que s’il s’agit bien d’un autre établissement homonyme.", confirmLabel: "Créer quand même", tone: "danger" });
        if (again) await create(true);
        return;
      }
      setError(errorText(reason, "Création impossible."));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const accepted = await confirm({
      title: `Créer l’accès de « ${name} » ?`,
      message: `Un e‑mail d’invitation, valable 48 heures, partira tout de suite à ${email}. L’établissement complétera ensuite lui‑même sa fiche (type, ville, adresse, téléphone).`,
      note: "Le nom saisi ici est celui que vous avez vérifié : l’établissement ne pourra plus le modifier.",
      confirmLabel: "Créer et envoyer l’invitation",
      cancelLabel: "Revoir",
    });
    if (accepted) await create(false);
  }

  async function resend(item: Item) {
    const email = item.invitation?.email;
    if (!email) return;
    const accepted = await confirm({
      title: "Renvoyer l’invitation ?",
      message: `Un nouvel e‑mail partira à ${email}. Le lien précédent cessera de fonctionner.`,
      confirmLabel: "Renvoyer l’invitation",
    });
    if (accepted) await run(() => apiPost(`/api/v1/establishments/startup/${item.id}/administrator-invitation/`, {}), `Invitation renvoyée à ${email}.`);
  }

  async function revoke(item: Item) {
    const email = item.invitation?.email;
    if (!email) return;
    const accepted = await confirm({
      title: "Révoquer cette invitation ?",
      message: `Le lien envoyé à ${email} ne pourra plus être utilisé.`,
      note: "Vous pourrez toujours renvoyer une nouvelle invitation ensuite.",
      confirmLabel: "Révoquer le lien",
      tone: "danger",
    });
    if (accepted) await run(() => apiPost(`/api/v1/establishments/startup/${item.id}/administrator-invitation/revoke/`, {}), "Invitation révoquée.");
  }

  const canSubmit = form.name.trim() !== "" && form.email.trim() !== "" && form.verified && !busy;

  return (
    <>
      <article className="card">
        <span className="eyebrow">Création après validation</span>
        <h2>Créer un établissement et inviter son responsable</h2>
        <p className="muted">L’établissement transmet ses justificatifs par le canal officiel. Après vérification hors application, saisissez seulement son nom et l’e‑mail de son responsable : il complète le reste lui‑même.</p>
        <form className="grid" onSubmit={submit}>
          <label className="field"><span>Nom de l’établissement (vérifié)</span><input required maxLength={180} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="off" /></label>
          <label className="field"><span>E‑mail du responsable</span><input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="off" /></label>
          <div className="field-row">
            <label className="field"><span>Prénom du responsable (facultatif)</span><input maxLength={120} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} autoComplete="off" /></label>
            <label className="field"><span>Nom du responsable (facultatif)</span><input maxLength={120} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} autoComplete="off" /></label>
          </div>
          <label className="check-row"><input type="checkbox" checked={form.verified} onChange={(event) => setForm({ ...form, verified: event.target.checked })} /><span>J’ai vérifié les pièces de la structure et l’identité de son responsable, hors application.</span></label>
          <p className="muted">Sans prénom ni nom, le responsable les renseigne en activant son accès. Le lien d’invitation n’est jamais affiché ici : il part uniquement par e‑mail.</p>
          <button className="button primary" type="submit" disabled={!canSubmit}>Créer l’accès et envoyer l’invitation</button>
        </form>
        <p className="notice" role="status" aria-live="polite" hidden={!message}>{message}</p>
        <p className="notice error" role="alert" hidden={!error}>{error}</p>
      </article>

      {aside}

      <article className="card admin-table-card">
        <div className="admin-table-title">
          <div><span className="eyebrow">Suivi</span><h2>Établissements créés{listing ? ` (${listing.total})` : ""}</h2></div>
          <button type="button" className="button small" onClick={refresh} disabled={busy}>Actualiser</button>
        </div>
        {!listing && !error && <p className="muted">Chargement…</p>}
        {listing && listing.items.length === 0 && <p className="muted">Aucun établissement créé pour l’instant.</p>}
        {listing && listing.items.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th scope="col">Établissement</th><th scope="col">Responsable</th><th scope="col">Suivi</th><th scope="col">Invitation</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {listing.items.map((item) => {
                  const status = followUp(item);
                  const state = item.invitation?.state;
                  const pendingActivation = item.stage === "awaiting_activation";
                  return (
                    <tr key={item.id}>
                      <th scope="row"><strong>{item.name}</strong><br /><span className="muted">{item.internal_code ?? "sans code"}</span></th>
                      <td>{item.administrator ? <>{item.administrator.name || "—"}<br /><span className="muted">{item.administrator.email}</span></> : <span className="muted">{item.invitation?.email ?? "—"}</span>}</td>
                      <td><span className={`badge ${status.tone}`}>{status.label}</span></td>
                      <td>{pendingActivation && item.invitation ? <>Expire le {when(item.invitation.expires_at)}</> : <span className="muted">—</span>}</td>
                      <td>
                        {pendingActivation && item.invitation && (
                          <span className="admin-inline-actions">
                            <button type="button" className="button small" disabled={busy} onClick={() => resend(item)}>Renvoyer</button>
                            {(state === "sent" || state === "pending" || state === "failed") && <button type="button" className="button small danger" disabled={busy} onClick={() => revoke(item)}>Révoquer</button>}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {listing?.truncated && <p className="muted">Seuls les {listing.items.length} établissements les plus récents sont affichés.</p>}
      </article>
    </>
  );
}
