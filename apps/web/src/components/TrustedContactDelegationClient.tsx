"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiDelete, apiGet, apiPost } from "../infrastructure/api/client";
import { CODE_ERROR_FALLBACK, delegationAcceptedCopy, errorReason } from "../lib/access-outcome";
import { delegationMessage } from "../lib/share";
import { OutcomeDialog, type OutcomeDialogProps } from "./modal/OutcomeDialog";
import { PanelDialog } from "./modal/PanelDialog";
import { Icon } from "./ui/Icon";
import { Profile, ProfileGrid, type ProfileStatus } from "./ui/Profile";
import { ShareCodeButton } from "./ShareCodeButton";

type Delegation = { id: string; status: string; invited_email?: string; patient_first_name?: string; patient_last_name?: string; relationship_label: string; expires_at: string | null; is_selected?: boolean };
type CreatedDelegation = Delegation & { join_code: string };
type Panel = "give" | "receive";
const relationships: Record<string, string> = { conjoint: "Conjoint·e", enfant_adulte: "Enfant adulte", parent: "Parent", ami: "Ami·e", autre: "Autre" };
const statuses: Record<string, string> = { pending: "Mot non utilisé", active: "Accès actif", revoked: "Accès retiré", expired: "Accès expiré" };
const date = (value: string | null) => value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value)) : "—";
const statusTone: Record<string, NonNullable<ProfileStatus["tone"]>> = { active: "ok", pending: "warn" };
const GIVE_ERROR_FALLBACK = "Le mot de rattachement n’a pas pu être généré. Vérifiez l’e-mail de votre proche et réessayez.";

export function TrustedContactDelegationClient() {
  const [items, setItems] = useState<Delegation[]>([]);
  const [mine, setMine] = useState<Delegation[]>([]);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("ami");
  const [duration, setDuration] = useState("30");
  const [code, setCode] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [message, setMessage] = useState("Chargement…");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Omit<OutcomeDialogProps, "onClose"> | null>(null);

  async function load() {
    const [owned, delegated] = await Promise.allSettled([apiGet<Delegation[]>("/api/v1/patient/delegations/"), apiGet<Delegation[]>("/api/v1/patient/delegations/mine/")]);
    if (owned.status === "fulfilled") setItems(owned.value);
    if (delegated.status === "fulfilled") setMine(delegated.value);
    window.dispatchEvent(new Event("ecarnet:delegation-changed"));
    if (owned.status === "rejected" && delegated.status === "rejected") throw owned.reason;
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronise la rubrique avec l’API après montage.
  useEffect(() => { load().then(() => setMessage("Les accès sont limités à la fiche d’urgence et journalisés.")).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "La fonctionnalité n’est pas disponible.")); }, []);

  function closePanel() { setPanel(null); setCreatedCode(""); setCode(""); }

  // Donner accès : succès = la fenêtre montre le mot à remettre ; erreur = le motif exact donné par le serveur, dans un modal.
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setCreatedCode("");
    try {
      const result = await apiPost<CreatedDelegation>("/api/v1/patient/delegations/", { email: email.trim(), relationship_label: relationship, duration_days: Number(duration) });
      setCreatedCode(result.join_code);
      setEmail("");
      await load();
      setMessage("Mot généré. Remettez-le directement à votre proche, sans le stocker dans un message ou un dossier.");
    } catch (error) {
      const reason = errorReason(error, GIVE_ERROR_FALLBACK);
      setMessage(reason);
      setOutcome({ tone: "error", title: "Mot de rattachement non généré", message: reason });
    } finally { setBusy(false); }
  }

  // Reçu accès : succès et erreur ouvrent un modal clair (qui de qui, ou le motif du refus).
  async function redeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const accepted = await apiPost<Delegation>("/api/v1/patient/delegations/redeem/", { code: code.trim() });
      closePanel();
      await load();
      setMessage("Rattachement créé. Vous pouvez ouvrir le carnet en lecture seule.");
      setOutcome({ tone: "success", ...delegationAcceptedCopy(accepted?.patient_first_name ?? "", accepted?.patient_last_name ?? "") });
    } catch (error) {
      const reason = errorReason(error, CODE_ERROR_FALLBACK);
      setMessage(reason);
      setOutcome({ tone: "error", title: "Mot de rattachement refusé", message: reason });
    } finally { setBusy(false); }
  }

  async function action(path: string, success: string) { setBusy(true); try { await apiPost(path); await load(); setMessage(success); } catch (error) { setMessage(error instanceof Error ? error.message : "Action impossible."); } finally { setBusy(false); } }
  // Fiche d'une délégation : une erreur est relancée, la fiche affiche le motif.
  async function revoke(item: Delegation) { await apiPost(`/api/v1/patient/delegations/${item.id}/revoke/`); await load(); setMessage("Accès retiré immédiatement."); }
  async function select(item: Delegation) { await action(`/api/v1/patient/delegations/${item.id}/select/`, `Carnet de ${item.patient_first_name ?? "votre proche"} sélectionné en lecture seule.`); }
  async function clear() { setBusy(true); try { await apiDelete(`/api/v1/patient/delegations/${mine.find((item) => item.is_selected)?.id}/select/`); await load(); setMessage("Votre propre carnet est de nouveau sélectionné."); } catch (error) { setMessage(error instanceof Error ? error.message : "Impossible de quitter ce carnet."); } finally { setBusy(false); } }

  return <section className="settings-form">
    <p className="muted">Le patient génère un mot de rattachement temporaire et le remet directement à son proche. Le proche utilise son propre compte : aucun mot de passe de connexion n’est partagé.</p>
    <div className="trusted-tiles">
      <button type="button" className="trusted-tile" aria-haspopup="dialog" onClick={() => setPanel("give")}>
        <strong>Donner accès</strong>
        <span className="trusted-tile__icon" aria-hidden="true"><Icon name="share" size={32} /></span>
        <span className="trusted-tile__hint">Générer un mot pour un proche.</span>
      </button>
      <button type="button" className="trusted-tile" aria-haspopup="dialog" onClick={() => setPanel("receive")}>
        <strong>Reçu accès</strong>
        <span className="trusted-tile__icon" aria-hidden="true"><Icon name="link" size={32} /></span>
        <span className="trusted-tile__hint">Saisir le mot que l’on m’a remis.</span>
      </button>
    </div>
    <div className="stack"><h3>Mes délégations</h3>{items.length === 0 ? <p className="muted">Aucune délégation.</p> : <ProfileGrid label="Mes délégations">{items.map((item) => {
      const email = item.invited_email ?? "Proche";
      const link = relationships[item.relationship_label] ?? item.relationship_label;
      const state = statuses[item.status] ?? item.status;
      return <Profile key={item.id} name={email} label={email.split("@")[0]} subtitle={`${link} · ${state}`} status={{ label: state, tone: statusTone[item.status] ?? "off" }}
        rows={[{ label: "E-mail du proche", value: email }, { label: "Lien", value: link }, { label: "État", value: state }, ...(item.status === "active" ? [{ label: "Accès jusqu’au", value: date(item.expires_at) }] : [])]}
        note={item.status === "pending" ? "Le mot de rattachement n’a pas encore été utilisé. Remettez-le directement à votre proche, sans le stocker dans un message ou un dossier." : item.status === "active" ? "Votre proche voit votre fiche d’urgence en lecture seule. Chaque accès est journalisé." : "Cet accès n’est plus utilisable."}
        actions={["pending", "active"].includes(item.status) ? [{ label: "Retirer l’accès", tone: "danger", onClick: async ({ close }) => { await revoke(item); close(); } }] : []} />;
    })}</ProfileGrid>}</div>
    {mine.length > 0 && <div className="stack"><h3>Carnets de proches</h3><ProfileGrid label="Carnets de proches">{mine.map((item) => {
      const name = [item.patient_first_name, item.patient_last_name].filter(Boolean).join(" ") || "Proche";
      return <Profile key={item.id} name={name} label={item.patient_first_name || name} subtitle="Carnet d’un proche" selected={Boolean(item.is_selected)}
        rows={[{ label: "Accès", value: "Lecture seule · fiche d’urgence" }, { label: "Jusqu’au", value: date(item.expires_at) }, { label: "Carnet affiché", value: item.is_selected ? "Oui" : "Non" }]}
        note="Vous voyez ce carnet avec votre propre compte, sans mot de passe partagé. Chaque accès est journalisé."
        actions={[item.is_selected ? { label: "Quitter ce carnet", onClick: async ({ close }) => { await clear(); close(); } } : { label: "Ouvrir en lecture seule", tone: "primary", onClick: async ({ close }) => { await select(item); close(); } }]} />;
    })}</ProfileGrid></div>}
    <p className="status" role="status" aria-live="polite">{message}</p>

    {panel === "give" && <PanelDialog title="Donner accès" lead="Choisissez votre proche, le lien et la durée. Un mot de rattachement temporaire est généré, à lui remettre en main propre." onClose={closePanel}>
      {createdCode ? <article className="notice trusted-success" role="status">
        <strong>Mot de rattachement généré</strong>
        <div className="code-with-share"><p className="join-code">{createdCode}</p><ShareCodeButton title="le mot de rattachement" buildText={() => delegationMessage({ code: createdCode, trustedUrl: `${window.location.origin}/patient/proches` })} /></div>
        <p className="muted">Il expire dans 72 heures et ne sera plus affiché. Partagez-le uniquement avec votre proche, par un message direct et jamais dans un groupe.</p>
        <div className="actions"><button type="button" className="button primary" onClick={closePanel}>Terminé</button></div>
      </article> : <form className="settings-form" onSubmit={(event) => void invite(event)}>
        <label className="field"><span>E-mail du proche (repère uniquement)</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} /></label>
        <div className="settings-form-grid">
          <label className="field"><span>Lien</span><select value={relationship} onChange={(event) => setRelationship(event.target.value)} disabled={busy}>{Object.entries(relationships).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label className="field"><span>Durée</span><select value={duration} onChange={(event) => setDuration(event.target.value)} disabled={busy}><option value="30">30 jours</option><option value="90">90 jours</option><option value="365">1 an</option></select></label>
        </div>
        <button className="button primary" type="submit" disabled={busy}>{busy ? "Génération…" : "Générer le mot de rattachement"}</button>
      </form>}
    </PanelDialog>}

    {panel === "receive" && <PanelDialog title="Reçu accès" lead="Saisissez le mot de rattachement que votre proche vous a remis. Il sera lié à votre propre compte." onClose={closePanel}>
      <form className="settings-form" onSubmit={(event) => void redeem(event)}>
        <label className="field"><span>Mot de rattachement</span><input required autoCapitalize="characters" value={code} onChange={(event) => setCode(event.target.value)} disabled={busy} placeholder="ECM-PROCHE-…" /></label>
        <button className="button primary" type="submit" disabled={busy}>{busy ? "Vérification…" : "Créer le lien avec mon compte"}</button>
      </form>
    </PanelDialog>}

    {outcome && <OutcomeDialog {...outcome} onClose={() => setOutcome(null)} />}
  </section>;
}
