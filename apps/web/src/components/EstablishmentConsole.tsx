"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "../infrastructure/api/client";
import { AvatarBadge, displayName, useSpaceAccount } from "./shell/SpaceShell";
import { useConfirm } from "./modal/ConfirmProvider";
import { Icon } from "./ui/Icon";
import { PageHeader } from "./ui/PageHeader";

type Establishment = { id: string; name: string; city: string; status: "pending" | "active" | "rejected" | string };
type Membership = { id: string; status: "pending" | "active" | "refused" | "suspended" | string; professional_name?: string; professional_email?: string };
type Data = { establishment: Establishment | null; memberships: Membership[] };

const STATUS_LABEL: Record<string, string> = { pending: "En attente", active: "Actif", refused: "Refusé", suspended: "Suspendu", terminated: "Terminé" };

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

function NoEstablishment() {
  return (
    <section className="card establishment-empty">
      <span className="establishment-welcome__icon"><Icon name="building" size={26} /></span>
      <h2>Aucun établissement n’est rattaché à ce compte</h2>
      <p className="muted">L’ouverture est gérée par l’équipe E‑Carnet. Consultez le guide pour préparer votre demande et connaître les étapes.</p>
      <div className="actions"><Link className="button" href="/aide#etablissements">Guide établissement</Link><Link className="button" href="/">Retour à l’accueil</Link></div>
    </section>
  );
}

function Pending({ establishment }: { establishment: Establishment }) {
  return (
    <section className="card alert-card" aria-live="polite">
      <h2>{establishment.status === "rejected" ? "Demande non retenue" : "Votre structure n’est pas encore activée"}</h2>
      <p>{establishment.status === "rejected" ? "Votre demande n’a pas été retenue en l’état. L’équipe peut vous préciser les raisons." : "Notre équipe termine l’examen de votre demande. Vous pourrez ensuite générer les codes pour vos médecins."}</p>
    </section>
  );
}

export function EstablishmentConsole({ view }: { view: "home" | "requests" | "doctors" }) {
  const account = useSpaceAccount();
  const { data, error, reload } = useConsole();
  const [code, setCode] = useState<{ value: string; expires_at: string } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

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
  const createCode = () => run(async () => { const result = await apiPost<{ code: string; expires_at: string }>(`/api/v1/establishments/${establishment.id}/join-codes/`, {}); setCode({ value: result.code, expires_at: result.expires_at }); });
  const decide = (id: string, decision: "approve" | "refuse") => run(async () => { await apiPost(`/api/v1/establishments/${establishment.id}/memberships/${id}/decision/`, { decision }); }, decision === "approve" ? "Rattachement confirmé : le médecin peut travailler." : "Demande refusée.");

  const codeCard = (
    <section className="card" aria-labelledby="code-title">
      <span className="eyebrow">Nouveau médecin</span>
      <h2 id="code-title">Code à remettre à un médecin</h2>
      <p className="muted">Un code est à usage unique et expire 48 h après sa création. Il n’est affiché qu’une seule fois : transmettez-le directement au médecin.</p>
      {code && <div className="stack"><p className="code-box" aria-live="polite">{code.value}</p><p className="muted">Valable jusqu’au {new Date(code.expires_at).toLocaleString("fr-FR")}. Il ne sera plus affiché.</p></div>}
      <div className="actions"><button type="button" className="button primary" disabled={!active || busy} onClick={() => void createCode()}>{code ? "Générer un autre code" : "Générer un code médecin"}</button></div>
      {!active && <p className="muted">Disponible quand l’établissement est activé.</p>}
    </section>
  );

  const requestRows = (
    <section className="card" aria-labelledby="requests-title">
      <div className="section-heading"><div><span className="eyebrow">À traiter</span><h2 id="requests-title">Demandes de rattachement</h2></div><span className="count-badge">{pending.length}</span></div>
      {pending.length === 0 ? <p className="empty">Aucune demande en attente.</p> : (
        <div className="stack">
          {pending.map((item) => (
            <article className="record" key={item.id}>
              <div><strong>{item.professional_name ?? "Médecin"}</strong><p className="muted">{item.professional_email ?? "Email non communiqué"}</p>
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
        <div className="stack">
          {doctors.map((item) => <article className="record" key={item.id}><div><strong>{item.professional_name ?? "Médecin"}</strong><p className="muted">{item.professional_email ?? ""}</p></div><span className="badge active">{STATUS_LABEL[item.status] ?? item.status}</span></article>)}
        </div>
      )}
    </section>
  );

  const status = <p className="status" role="status" aria-live="polite">{message}</p>;

  if (view === "requests") return <div className="stack-lg"><PageHeader eyebrow={establishment.name} title="Demandes" lead="Un médecin qui saisit votre code apparaît ici. Vous confirmez ou refusez : sans votre accord, il ne peut rien faire." />{!active && <Pending establishment={establishment} />}{requestRows}{status}</div>;
  if (view === "doctors") return <div className="stack-lg"><PageHeader eyebrow={establishment.name} title="Médecins" lead="Les médecins rattachés exercent sous votre établissement. Vous ne voyez jamais les dossiers des patients." />{codeCard}{doctorRows}{status}</div>;

  return (
    <div className="stack-lg">
      <div className="greeting">{account && <AvatarBadge account={account} size={52} />}<div className="greeting__text"><small>{establishment.name} · {establishment.city}</small><h1>{account ? displayName(account) : "Administrateur"}</h1></div></div>
      {!active && <Pending establishment={establishment} />}
      <section className="stat-grid" aria-label="Résumé">
        <Link className="stat-card card-link" href="/etablissement/demandes"><span className="val">{pending.length}</span><span className="lbl">Demande{pending.length > 1 ? "s" : ""} à traiter</span></Link>
        <Link className="stat-card card-link" href="/etablissement/medecins"><span className="val">{doctors.length}</span><span className="lbl">Médecin{doctors.length > 1 ? "s" : ""} actif{doctors.length > 1 ? "s" : ""}</span></Link>
      </section>
      {pending.length > 0 && <section className="card alert-card"><h2>{pending.length} médecin{pending.length > 1 ? "s attendent" : " attend"} votre confirmation</h2><div className="actions"><Link className="button" href="/etablissement/demandes">Traiter les demandes</Link></div></section>}
      {codeCard}
      {status}
      <section className="notice"><strong>Confidentialité.</strong> L’administrateur gère les rattachements et ne consulte aucun dossier médical. Chaque médecin n’atteint que les patients qui l’ont autorisé.</section>
    </div>
  );
}
