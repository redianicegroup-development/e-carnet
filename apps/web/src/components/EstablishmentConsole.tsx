"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { apiGet, apiPost } from "../infrastructure/api/client";
import { AvatarBadge, displayName, useSpaceAccount } from "./shell/SpaceShell";
import { useConfirm } from "./modal/ConfirmProvider";
import { useDialogBehavior } from "./modal/useDialogBehavior";
import { Icon } from "./ui/Icon";
import "./join-codes.css";
import { PageHeader } from "./ui/PageHeader";
import { EstablishmentKpis } from "./EstablishmentKpis";
import { EstablishmentJoinCodes } from "./EstablishmentJoinCodes";
import { splitFullName } from "../lib/join-codes";

type Establishment = { id: string; name: string; city: string; status: "pending" | "active" | "suspended" | "rejected" | string };
type Membership = { id: string; status: "pending" | "active" | "refused" | "suspended" | string; professional_name?: string; professional_first_name?: string; professional_last_name?: string; professional_email?: string; professional_avatar_url?: string; professional_title?: string; professional_specialty?: string; professional_age?: number | null; requested_at?: string | null; reviewed_at?: string | null };
type Data = { establishment: Establishment | null; memberships: Membership[] };

async function fetchConsole(): Promise<Data> {
  const items = await apiGet<Establishment[]>("/api/v1/establishments/");
  const establishment = items[0] ?? null;
  const memberships = establishment && establishment.status === "active" ? await apiGet<Membership[]>(`/api/v1/establishments/${establishment.id}/memberships/`) : [];
  return { establishment, memberships };
}

function useConsole() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let active = true;
    fetchConsole()
      .then((value) => { if (active) { setData(value); setError(""); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Espace établissement indisponible."); });
    return () => { active = false; };
  }, [tick]);
  const reload = useCallback(async () => { setTick((value) => value + 1); }, []);
  return { data, error, reload };
}

function MemberAvatar({ member, size = 44 }: { member: Membership; size?: number }) {
  return <AvatarBadge size={size} account={{ ...splitFullName(member.professional_name), email: member.professional_email ?? "", avatar_url: member.professional_avatar_url ?? "" }} />;
}

/* Équipe : une photo par médecin ; un clic ouvre sa fiche (nom, prénoms, métier, âge) avec la possibilité de révoquer le rattachement. */
function MemberDetail({ member, busy, onClose, onRevoke }: { member: Membership; busy: boolean; onClose: () => void; onRevoke: () => void }) {
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useDialogBehavior({ open: true, container: dialog, initialFocus: closeButton, onEscape: onClose });
  const names = splitFullName(member.professional_name);
  const lastName = member.professional_last_name || names.last_name;
  const firstName = member.professional_first_name || names.first_name;
  const job = [member.professional_title, member.professional_specialty].filter(Boolean).join(" · ");
  const rows: [string, string][] = [
    ["Nom", lastName || "Non renseigné"],
    ["Prénoms", firstName || "Non renseigné"],
    ["Métier", job || "Non renseigné"],
    ["Âge", typeof member.professional_age === "number" ? `${member.professional_age} an${member.professional_age > 1 ? "s" : ""}` : "Non renseigné"],
  ];
  return <div className="modal-backdrop modal-backdrop--confirm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} className="modal-dialog team-detail" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <MemberAvatar member={member} size={84} />
      <h2 id={titleId}>{member.professional_name || "Médecin"}</h2>
      <dl className="team-detail__list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <div className="modal-actions">
        <button ref={closeButton} type="button" className="button" onClick={onClose}>Fermer</button>
        <button type="button" className="button primary danger" disabled={busy} onClick={onRevoke}>Révoquer</button>
      </div>
    </section>
  </div>;
}

function NoEstablishment() {
  return (
    <section className="card establishment-empty">
      <span className="establishment-welcome__icon"><Icon name="building" size={26} /></span>
      <h2>Aucun établissement n’est rattaché à ce compte</h2>
      <p className="muted">L’ouverture est gérée par l’équipe Mon E‑Carnet. Le guide explique les étapes.</p>
      <div className="actions"><Link className="button" href="/aide#establishment">Guide établissement</Link><Link className="button" href="/">Retour à l’accueil</Link></div>
    </section>
  );
}

function Pending({ establishment }: { establishment: Establishment }) {
  return (
    <section className="card alert-card" aria-live="polite">
      <h2>{establishment.status === "suspended" ? "Espace établissement suspendu" : establishment.status === "rejected" ? "Demande non retenue" : "Votre structure n’est pas encore activée"}</h2>
      <p>{establishment.status === "suspended" ? "Les actions de gestion et l’accès aux dossiers sont bloqués pour le moment. Contactez l’équipe Mon E‑Carnet." : establishment.status === "rejected" ? "Votre demande n’a pas été retenue. L’équipe peut vous en expliquer les raisons." : "Notre équipe examine votre demande. Vous pourrez ensuite remettre un code à vos médecins."}</p>
    </section>
  );
}

export function EstablishmentConsole({ view }: { view: "home" | "requests" | "doctors" }) {
  const account = useSpaceAccount();
  const { data, error, reload } = useConsole();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const [openMemberId, setOpenMemberId] = useState<string | null>(null);

  if (error) return <p className="notice" role="alert">{error}</p>;
  if (!data) return <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /><i /></div>;
  const { establishment, memberships } = data;
  if (!establishment) return <NoEstablishment />;
  const active = establishment.status === "active";
  const pending = memberships.filter((item) => item.status === "pending");
  const doctors = memberships.filter((item) => item.status === "active");

  async function run(action: () => Promise<void>, done?: string) {
    setBusy(true);
    setMessage("");
    try { await action(); if (done) setMessage(done); await reload(); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Action impossible."); } finally { setBusy(false); }
  }
  const decide = async (id: string, decision: "approve" | "refuse") => {
    const member = data.memberships.find((entry) => entry.id === id);
    const who = member?.professional_name || member?.professional_email || "ce médecin";
    const approve = decision === "approve";
    const accepted = await confirm({
      title: approve ? "Confirmer le rattachement ?" : "Refuser cette demande ?",
      message: approve ? `${who} pourra travailler au nom de ${establishment.name}.` : `${who} ne sera pas rattaché(e) à ${establishment.name}.`,
      note: approve ? "Vous pourrez mettre fin au rattachement à tout moment." : "Le médecin pourra refaire une demande avec un nouveau code.",
      confirmLabel: approve ? "Confirmer le rattachement" : "Refuser la demande",
    });
    if (!accepted) return;
    await run(async () => { await apiPost(`/api/v1/establishments/${establishment.id}/memberships/${id}/decision/`, { decision }); }, approve ? "Rattachement confirmé : le médecin peut travailler." : "Demande refusée.");
  };

  const revoke = async (member: Membership) => {
    setOpenMemberId(null);
    const ok = await confirm({ title: "Révoquer ce médecin ?", message: `${member.professional_name || "Ce médecin"} ne pourra plus travailler au nom de ${establishment.name}.`, note: "Les dossiers et les traces existants sont conservés.", confirmLabel: "Révoquer", cancelLabel: "Garder", tone: "danger", mood: "farewell" });
    if (!ok) return;
    await run(async () => { await apiPost(`/api/v1/establishments/${establishment.id}/memberships/${member.id}/terminate/`, {}); }, "Rattachement révoqué.");
  };
  const openMember = doctors.find((item) => item.id === openMemberId) ?? null;

  const codeCard = <EstablishmentJoinCodes establishmentId={establishment.id} active={active} />;

  const requestRows = (
    <section className="card" aria-labelledby="requests-title">
      <div className="section-heading"><div><span className="eyebrow">À traiter</span><h2 id="requests-title">Demandes de rattachement</h2></div><span className="count-badge">{pending.length}</span></div>
      {pending.length === 0 ? <p className="empty">Aucune demande en attente.</p> : (
        <div className="stack">
          {pending.map((item) => (
            <article className="record" key={item.id}>
              <div><div className="team-member"><MemberAvatar member={item} /><div><strong>{item.professional_name ?? "Médecin"}</strong><p className="muted">{item.professional_email ?? "Email non communiqué"}</p></div></div>
                <div className="actions"><button type="button" className="button small primary" disabled={busy} onClick={() => void decide(item.id, "approve")}>Confirmer</button><button type="button" className="button small danger" disabled={busy} onClick={() => void confirm({ title: "Refuser cette demande ?", message: `${item.professional_name ?? "Ce médecin"} ne sera pas rattaché à votre établissement.`, confirmLabel: "Refuser la demande", cancelLabel: "Revenir", tone: "danger", mood: "decision" }).then((ok) => { if (ok) void decide(item.id, "refuse"); })}>Refuser</button></div></div>
              <span className="badge pending">En attente</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );

  const doctorRows = (
    <section className="card" aria-labelledby="doctors-title">
      <div className="section-heading"><div><span className="eyebrow">Équipe</span><h2 id="doctors-title">Médecins de l’établissement</h2></div><span className="count-badge">{doctors.length}</span></div>
      {doctors.length === 0 ? <p className="empty">Aucun médecin rattaché pour le moment.</p> : (
        <ul className="team-grid" aria-label="Médecins de l’établissement">
          {doctors.map((item) => <li key={item.id}><button type="button" className="team-photo" aria-label={`Voir la fiche de ${item.professional_name || "ce médecin"}`} title={item.professional_name || "Médecin"} onClick={() => setOpenMemberId(item.id)}><MemberAvatar member={item} size={64} /></button></li>)}
        </ul>
      )}
      {openMember && <MemberDetail member={openMember} busy={busy} onClose={() => setOpenMemberId(null)} onRevoke={() => void revoke(openMember)} />}
    </section>
  );

  const status = <p className="status" role="status" aria-live="polite">{message}</p>;

  if (view === "requests") return <div className="stack-lg"><PageHeader eyebrow={establishment.name} title="Demandes" lead="Un médecin qui saisit votre code apparaît ici. Vous confirmez ou refusez." />{!active && <Pending establishment={establishment} />}{requestRows}{status}</div>;
  if (view === "doctors") return <div className="stack-lg"><PageHeader eyebrow={establishment.name} title="Médecins" lead="Les médecins de votre établissement. Touchez une photo pour voir sa fiche." />{codeCard}{doctorRows}{status}</div>;

  return (
    <div className="stack-lg">
      <div className="greeting">{account && <AvatarBadge account={account} size={52} />}<div className="greeting__text"><small>{establishment.name} · {establishment.city}</small><h1>{account ? displayName(account) : "Administrateur"}</h1></div></div>
      {!active && <Pending establishment={establishment} />}
      <EstablishmentKpis memberships={memberships} />
      {!active && <section className="card progress-card"><div className="section-heading"><div><span className="eyebrow">Mise en route</span><h2>Activer l’espace établissement</h2></div></div><p className="muted">L’équipe Mon E‑Carnet doit d’abord valider votre structure.</p><div className="progress-card__line" role="progressbar" aria-valuemin={0} aria-valuemax={2} aria-valuenow={establishment.status === "pending" ? 1 : 0}><span style={{ width: `${establishment.status === "pending" ? 50 : 0}%` }} /></div><div className="progress-card__meta"><span>{establishment.status === "pending" ? "Demande reçue" : "Fiche à préparer"}</span><Link className="text-link" href="/etablissement/parametres">Voir les paramètres</Link></div></section>}
      {pending.length > 0 && <section className="card alert-card"><h2>{pending.length} médecin{pending.length > 1 ? "s attendent" : " attend"} votre confirmation</h2><div className="actions"><Link className="button" href="/etablissement/demandes">Traiter les demandes</Link></div></section>}
      {codeCard}
      {status}
      <section className="notice"><strong>Dossiers.</strong> Vous voyez les dossiers qui ont une pré-consultation clôturée ou une consultation dans votre établissement. Un médecin ne voit que le dossier que le patient l’a autorisé à ouvrir.</section>
    </div>
  );
}
