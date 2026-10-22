"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../infrastructure/api/client";
import { AvatarBadge, displayName, useSpaceAccount } from "./shell/SpaceShell";
import { Icon, type IconName } from "./ui/Icon";
import { PatientHomeIdentity } from "./PatientHomeIdentity";
import { SetupCard, type SetupStep } from "./SetupCard";

/* Accueil patient : peu de blocs, dans l'ordre où on en a besoin.
   1. dire bonjour · 2. « Mise en route » (tant que le carnet essentiel n'est pas commencé, puis elle disparaît) ·
   3. ce qui attend une réponse (un seul bloc « À faire ») · 4. préparer la prochaine consultation ·
   5. mon dossier patient et ma carte virtuelle · 6. trois raccourcis.
   Les compteurs et le graphique d'avant doublonnaient les onglets : ils n'aident pas à agir. */

/** Chaque information est indépendante : `null` = n'a pas pu être chargée (on n'invente pas un zéro). */
type Summary = { declarations: number | null; documents: number | null; vaccinations: number | null; pending: number; unread: number; partial: boolean };

async function loadSummary(): Promise<Summary> {
  const results = await Promise.allSettled([
    apiGet<unknown[]>("/api/v1/patient/declarations/"),
    apiGet<{ status: string }[]>("/api/v1/patient/care/access-grants/"),
    apiGet<unknown[]>("/api/v1/patient/care/documents/"),
    apiGet<unknown[]>("/api/v1/patient/care/vaccinations/"),
    apiGet<{ read_at?: string | null }[]>("/api/v1/patient/care/notifications/"),
  ]);
  const [declarations, grants, documents, vaccinations, notifications] = results;
  const failed = results.filter((item) => item.status === "rejected");
  // Rien n'a répondu : on le dit franchement plutôt que d'afficher un accueil vide qui ressemble à un carnet vide.
  if (failed.length === results.length) throw (failed[0] as PromiseRejectedResult).reason;
  const count = (result: PromiseSettledResult<unknown[]>) => (result.status === "fulfilled" ? result.value.length : null);
  return {
    declarations: count(declarations),
    documents: count(documents),
    vaccinations: count(vaccinations),
    pending: grants.status === "fulfilled" ? grants.value.filter((item) => item.status === "pending").length : 0,
    unread: notifications.status === "fulfilled" ? notifications.value.filter((item) => !item.read_at).length : 0,
    partial: failed.length > 0,
  };
}

const SHORTCUTS: { href: string; icon: IconName; title: string; text: string }[] = [
  { href: "/patient/carnet", icon: "folder", title: "Mon carnet", text: "Allergies, documents, vaccins, traitements" },
  { href: "/patient/acces#qr", icon: "qr", title: "Accès temporaire pour un professionnel", text: "Un QR valable 5 minutes, à lui présenter en consultation" },
  { href: "/patient/consultations", icon: "stethoscope", title: "Mes visites", text: "Pré-consultations et consultations validées" },
];

type Todo = { key: string; href: string; icon: IconName; title: string; text: string; urgent?: boolean };

export function PatientHome() {
  const account = useSpaceAccount();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => { setError(""); setSummary(null); setAttempt((value) => value + 1); }, []);

  useEffect(() => {
    let active = true;
    loadSummary().then((value) => { if (active) setSummary(value); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Impossible de charger votre carnet."); });
    return () => { active = false; };
  }, [attempt]);

  const todos: Todo[] = [];
  if (summary && summary.pending > 0) todos.push({ key: "grants", href: "/patient/acces", icon: "share", urgent: true, title: `${summary.pending} demande${summary.pending > 1 ? "s" : ""} d’accès en attente`, text: "Un professionnel attend votre décision. Rien n’est partagé tant que vous n’avez pas accepté." });
  if (account && !account.patient_profile.completed) todos.push({ key: "profile", href: "/onboarding/patient", icon: "user", title: "Terminer mon profil", text: "Téléphone, naissance, couverture : utile pour préparer vos consultations." });
  if (summary && summary.unread > 0) todos.push({ key: "notifications", href: "/patient/parametres?section=notifications", icon: "bell", title: `${summary.unread} notification${summary.unread > 1 ? "s" : ""} à lire`, text: "Une action concernant votre carnet attend votre attention." });
  // « Mise en route » : une rubrique inconnue (non chargée) n'est jamais comptée comme vide ; la carte n'apparaît que si une rubrique est vraiment vide.
  const setupSteps: SetupStep[] = summary ? [
    { key: "declarations", title: "Mes déclarations", text: "Allergies, antécédents, traitements.", done: summary.declarations !== 0, href: "/patient/carnet" },
    { key: "documents", title: "Mes documents", text: "Ordonnances, résultats, comptes rendus.", done: summary.documents !== 0, href: "/patient/carnet" },
    { key: "vaccinations", title: "Mes vaccins", text: "Vaccinations déjà reçues.", done: summary.vaccinations !== 0, href: "/patient/carnet" },
  ] : [];

  return (
    <div className="stack-lg">
      {account && (
        <div className="greeting">
          <AvatarBadge account={account} size={52} />
          <div className="greeting__text"><small>Bonjour</small><h1>{account.first_name || displayName(account)}</h1></div>
        </div>
      )}

      {error && <div className="card alert-card" role="alert"><p>{error}</p><div className="actions"><button className="button" type="button" onClick={retry}>Réessayer</button></div></div>}

      <SetupCard title="Construire mon carnet essentiel" text="Commencez par les informations utiles au quotidien. Vous pourrez modifier chaque élément plus tard." steps={setupSteps} />

      {todos.length > 0 && (
        <section className="stack" aria-labelledby="home-todo-title" aria-live="polite">
          <h2 id="home-todo-title" className="home-todo-title">À faire</h2>
          {todos.map((item) => (
            <Link key={item.key} className={`list-row${item.urgent ? " list-row--urgent" : ""}`} href={item.href}>
              <span className="setting-item__icon"><Icon name={item.icon} /></span>
              <span className="list-row__body"><strong>{item.title}</strong><br /><span className="muted">{item.text}</span></span>
              <Icon name="chevron" size={18} />
            </Link>
          ))}
        </section>
      )}

      <section className="card cta-card">
        <span className="eyebrow">Avant votre rendez-vous</span>
        <h2>Préparez votre prochaine consultation</h2>
        <p className="muted">Décrivez votre motif et ce que vous ressentez. Le professionnel le lira uniquement si vous l’autorisez.</p>
        <div className="actions"><Link className="button primary" href="/patient/consultations#preparer"><Icon name="pencil" size={18} />Préparer ma consultation</Link></div>
      </section>

      {account && <PatientHomeIdentity account={account} />}

      {summary?.partial && <p className="notice" role="status">Certaines informations de cette page n’ont pas pu être chargées. <button className="text-link" type="button" onClick={retry}>Réessayer</button></p>}
      {!summary && !error && <div className="skeleton" role="status"><span className="sr-only">Chargement de votre carnet…</span><i /></div>}

      <section className="stack" aria-label="Raccourcis">
        {SHORTCUTS.map((item) => (
          <Link key={item.href} className="list-row" href={item.href}>
            <span className="setting-item__icon"><Icon name={item.icon} /></span>
            <span className="list-row__body"><strong>{item.title}</strong><br /><span className="muted">{item.text}</span></span>
            <Icon name="chevron" size={18} />
          </Link>
        ))}
      </section>
    </div>
  );
}
