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
  if (status === "active") return "Espace activé";
  if (status === "rejected") return "Demande non retenue";
  return "En cours d’examen";
}

export function EstablishmentWorkspace() {
  const [items, setItems] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [message, setMessage] = useState("Chargement de votre demande…");

  useEffect(() => {
    let active = true;
    fetch(`${API}/api/v1/establishments/`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as Envelope<Establishment[]>;
        if (response.status === 401 || response.status === 403) throw new Error("SESSION_REQUIRED");
        if (!response.ok) throw new Error(payload.message ?? "Impossible de charger les demandes.");
        if (active) {
          setItems(payload.data ?? []);
          setMessage("Vos informations établissement sont à jour.");
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof Error && error.message === "SESSION_REQUIRED") {
          setNeedsLogin(true);
          setMessage("Connectez-vous pour suivre une demande liée à votre compte.");
        } else setMessage(error instanceof Error ? error.message : "Service indisponible.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (needsLogin) {
    return <section className="card settings-auth-gate">
      <span className="eyebrow">Espace sécurisé</span>
      <h2>Connectez-vous pour accéder à votre espace</h2>
      <p className="muted">Les informations de l’établissement et la gestion des rattachements sont accessibles uniquement à l’administrateur nominatif invité par E‑Carnet.</p>
      <div className="actions"><Link className="button primary" href="/connexion?next=%2Fetablissement">Se connecter</Link><a className="button" href="mailto:etablissements@e-carnet.example">Contacter E‑Carnet</a></div>
    </section>;
  }

  return <section className="establishment-home">
    <section className="establishment-welcome" aria-labelledby="establishment-welcome-title">
      <div>
        <span className="eyebrow">Établissement · V1</span>
        <h1 id="establishment-welcome-title">Le carnet du patient, entre vos murs et au-delà.</h1>
        <p className="muted">Un partenaire du système de soins : le carnet reste personnel au patient. La V1 commence par une demande d’intérêt et un accompagnement.</p>
      </div>
      <div className="establishment-welcome__icon" aria-hidden="true">＋</div>
    </section>

    <div className="establishment-home__heading">
      <div><span className="eyebrow">Suivi de votre dossier</span><h2>Mes demandes</h2></div>
      <a className="button primary" href="mailto:etablissements@e-carnet.example">Contacter E‑Carnet</a>
    </div>
    <p className="notice" role="status" aria-live="polite">{message}</p>

    {loading ? <div className="card empty" role="status">Chargement…</div> : items.length === 0 ? (
      <section className="card establishment-empty">
        <h2>Votre structure n’est pas encore activée</h2>
        <p className="muted">L’établissement transmet ses justificatifs par e-mail. Après vérification, E‑Carnet crée l’entité et invite nominativement son administrateur.</p>
        <a className="button primary" href="mailto:etablissements@e-carnet.example">Contacter E‑Carnet</a>
      </section>
    ) : <div className="grid establishment-request-grid">
      {items.map((item) => <article className="card establishment-request" key={item.id}>
        <div className="section-heading"><div><span className="eyebrow">{item.establishment_type}</span><h2>{item.name}</h2></div><span className={`badge ${item.status === "active" ? "active" : item.status === "rejected" ? "rejected" : "pending"}`}>{statusLabel(item.status)}</span></div>
        <p className="muted">{item.city} · {item.address}</p>
        <ol className="establishment-steps">
          <li className="is-done"><span>1</span><div><strong>Demande envoyée</strong><small>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(item.created_at))}</small></div></li>
          <li className={item.status === "pending" ? "is-current" : item.status === "active" || item.status === "rejected" ? "is-done" : ""}><span>2</span><div><strong>Examen de la demande</strong><small>{item.status === "pending" ? "En cours" : item.status === "rejected" ? "Terminée" : "Validée"}</small></div></li>
          <li className={item.status === "active" ? "is-current" : ""}><span>3</span><div><strong>Accompagnement de configuration</strong><small>{item.status === "active" ? "À planifier avec l’équipe" : "À venir"}</small></div></li>
          <li className={item.status === "active" ? "is-done" : ""}><span>4</span><div><strong>Espace établissement activé</strong><small>{item.activated_at ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(item.activated_at)) : item.status === "active" ? "Activé" : "À venir"}</small></div></li>
        </ol>
        {item.status === "rejected" && <p className="notice">Votre demande n’a pas été retenue. Contactez l’équipe pour connaître la suite ou déposer une nouvelle demande.</p>}
        <Link href="/etablissement/parametres" className="button">Voir la fiche et les coordonnées</Link>
      </article>)}
    </div>}

    <div className="grid establishment-home__secondary">
      <section className="card" id="demande"><span className="eyebrow">Étape suivante</span><h2>Votre demande</h2><p className="muted">Suivez le statut et complétez la fiche minimale avec l’équipe pendant l’accompagnement.</p><Link href="/etablissement/parametres" className="text-link">Voir les informations de la structure →</Link></section>
      <section className="card" id="medecins"><span className="eyebrow">Après activation</span><h2>Médecins</h2><p className="muted">L’administrateur émet des codes médecin temporaires et accepte ou refuse les demandes de rattachement. Cet espace ne donne aucun accès clinique.</p><Link href="/etablissement/gestion" className="text-link">Gérer les rattachements →</Link></section>
      <section className="card" id="aide"><span className="eyebrow">Accompagnement</span><h2>Besoin d’aide ?</h2><p className="muted">L’équipe accompagne la configuration initiale de votre espace, sur place ou via un accès technique contrôlé.</p><Link className="button" href="/faq">Consulter l’aide et la FAQ</Link></section>
    </div>
  </section>;
}
