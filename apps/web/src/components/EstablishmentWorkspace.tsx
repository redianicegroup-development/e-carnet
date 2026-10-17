"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Establishment = {
  id: string;
  name: string;
  establishment_type: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  responsible_name: string;
  status: "pending" | "active" | "rejected" | string;
  internal_code: string | null;
  created_at: string;
  activated_at: string | null;
};
type Envelope<T> = { data?: T; message?: string; detail?: string };
const API = "";

function statusLabel(status: Establishment["status"]): string {
  if (status === "active") return "Espace actif";
  if (status === "rejected") return "Demande non retenue";
  return "En cours d’examen";
}

export function EstablishmentWorkspace() {
  const [items, setItems] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [message, setMessage] = useState("Chargement des informations…");

  useEffect(() => {
    let active = true;
    fetch(`${API}/api/v1/establishments/`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as Envelope<Establishment[]>;
        if (response.status === 401 || response.status === 403) throw new Error("SESSION_REQUIRED");
        if (!response.ok) throw new Error(payload.message ?? "Impossible de charger les informations.");
        if (active) {
          setItems(payload.data ?? []);
          setMessage("Informations mises à jour.");
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof Error && error.message === "SESSION_REQUIRED") {
          setNeedsLogin(true);
          setMessage("Connectez-vous pour suivre votre établissement.");
        } else setMessage(error instanceof Error ? error.message : "Service indisponible.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (needsLogin) return <section className="card settings-auth-gate">
    <span className="eyebrow">Espace établissement</span><h2>Connexion requise</h2>
    <p className="muted">L’espace est réservé au responsable nominatif invité par Mon E‑Carnet.</p>
    <div className="actions"><Link className="button primary" href="/connexion?next=%2Fetablissement">Se connecter</Link><Link className="button" href="/aide#etablissements">Aide établissement</Link></div>
  </section>;

  return <section className="establishment-home">
    <header className="establishment-welcome" aria-labelledby="establishment-welcome-title"><div><span className="eyebrow">Espace établissement</span><h1 id="establishment-welcome-title">Gérez vos rattachements.</h1><p className="muted">Suivez votre espace et les professionnels de votre structure.</p></div><div className="establishment-welcome__icon" aria-hidden="true">＋</div></header>
    <div className="establishment-home__heading"><div><span className="eyebrow">Votre structure</span><h2>Établissements associés</h2></div><Link className="button" href="/aide#etablissements">Centre d’aide</Link></div>
    <p className="notice" role="status" aria-live="polite">{message}</p>

    {loading ? <div className="card empty" role="status">Chargement…</div> : items.length === 0 ? <section className="card establishment-empty">
      <h2>Aucun établissement associé</h2><p className="muted">Pour ouvrir un espace, consultez le guide et contactez l’équipe Mon E‑Carnet.</p><Link className="button primary" href="/aide#etablissements">Voir les étapes</Link>
    </section> : <div className="grid establishment-request-grid">{items.map((item) => <article className="card establishment-request" key={item.id}>
      <div className="section-heading"><div><span className="eyebrow">{item.establishment_type}</span><h2>{item.name}</h2></div><span className={`badge ${item.status === "active" ? "active" : item.status === "rejected" ? "rejected" : "pending"}`}>{statusLabel(item.status)}</span></div>
      <p className="muted">{item.city}{item.address ? ` · ${item.address}` : ""}</p>
      <ol className="establishment-steps">
        <li className="is-done"><span>1</span><div><strong>Demande enregistrée</strong><small>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(item.created_at))}</small></div></li>
        <li className={item.status === "pending" ? "is-current" : item.status === "active" || item.status === "rejected" ? "is-done" : ""}><span>2</span><div><strong>Examen de la demande</strong><small>{item.status === "pending" ? "En cours" : item.status === "rejected" ? "Terminée" : "Validée"}</small></div></li>
        {item.status === "active" && <li className="is-done"><span>3</span><div><strong>Espace activé</strong><small>{item.activated_at ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(item.activated_at)) : "Actif"}</small></div></li>}
      </ol>
      {item.status === "rejected" && <p className="notice">Pour connaître les suites possibles, consultez le centre d’aide.</p>}
      <div className="actions"><Link href="/etablissement/parametres" className="button">Fiche et coordonnées</Link>{item.status === "active" && <Link href="/etablissement/medecins" className="button primary">Gérer les médecins</Link>}</div>
    </article>)}</div>}
    <div className="grid establishment-home__secondary"><section className="card"><span className="eyebrow">Rattachements</span><h2>Gérer les médecins</h2><p className="muted">Créez des invitations et traitez les demandes de rattachement.</p><Link href="/etablissement/medecins" className="text-link">Ouvrir la gestion →</Link></section><section className="card"><span className="eyebrow">Assistance</span><h2>Centre d’aide</h2><p className="muted">Consultez les étapes propres aux établissements.</p><Link className="text-link" href="/aide#etablissements">Voir le guide →</Link></section></div>
  </section>;
}
