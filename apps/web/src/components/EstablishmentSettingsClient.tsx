"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LinkedProvidersSettingsClient } from "./LinkedProvidersSettingsClient";
import { SettingsDirectory, type SettingsNavItem } from "./SettingsDirectory";
import { SettingsMoreSection } from "./SettingsMoreSection";
import { ThemeSettingsClient } from "./ThemeSettingsClient";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";

type Account = { email: string; first_name: string; last_name: string; avatar_url?: string; contexts: { role: string; is_active: boolean }[] };
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
};
type Envelope<T> = { data?: T; message?: string; detail?: string };
const API = "";

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, { credentials: "include", cache: "no-store" });
  const payload = await response.json() as Envelope<T>;
  if (response.status === 401 || response.status === 403) throw new Error("SESSION_REQUIRED");
  if (!response.ok) throw new Error(payload.message ?? payload.detail ?? "Service indisponible.");
  return payload.data as T;
}

function statusLabel(status: Establishment["status"]): string {
  if (status === "active") return "Actif";
  if (status === "rejected") return "Refusé";
  return "En attente de validation";
}

export function EstablishmentSettingsClient() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState("Chargement des informations du compte et de l’établissement…");
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [sessionRequired, setSessionRequired] = useState(false);
  const [activeSection, setActiveSection] = useState("administratif");

  useEffect(() => {
    let active = true;
    Promise.all([get<Account>("/api/v1/identity/me/"), get<Establishment[]>("/api/v1/establishments/")])
      .then(([accountData, establishmentData]) => {
        if (!active) return;
        setAccount(accountData);
        setEstablishments(establishmentData);
        setSelectedId(establishmentData[0]?.id ?? "");
        setMessage("Informations chargées depuis votre session.");
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof Error && error.message === "SESSION_REQUIRED") {
          setSessionRequired(true);
          setMessage("Connectez-vous pour consulter les paramètres de votre établissement.");
        } else setMessage(error instanceof Error ? error.message : "Impossible de charger les paramètres.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function logout() {
    setSigningOut(true);
    setMessage("Déconnexion…");
    try {
      const csrf = await primeCsrf();
      if (!csrf.ok) throw new Error("Impossible de préparer la déconnexion sécurisée.");
      const response = await fetch(`${API}/api/v1/identity/logout/`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": readCsrfToken() },
      });
      if (!response.ok) throw new Error("La déconnexion n’a pas abouti.");
      router.push("/connexion");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "La déconnexion n’a pas abouti.");
      setSigningOut(false);
    }
  }

  if (sessionRequired) {
    return <section className="card settings-auth-gate" aria-labelledby="establishment-auth-title"><span className="setting-item__icon" aria-hidden="true">▣</span><h2 id="establishment-auth-title">Connexion requise</h2><p className="muted">Les coordonnées de la structure et les paramètres du compte sont réservés aux membres autorisés. Connectez-vous pour continuer.</p><div className="actions"><Link className="button primary" href="/connexion?next=%2Fetablissement%2Fparametres">Se connecter</Link><Link className="button" href="/">Retour à l’accueil</Link></div></section>;
  }

  const selected = establishments.find((item) => item.id === selectedId) ?? establishments[0] ?? null;
  const accountName = `${account?.first_name ?? ""} ${account?.last_name ?? ""}`.trim() || account?.email || "Compte établissement";
  const navItems: SettingsNavItem[] = [
    { id: "administratif", title: "Informations administratives", description: "Identité et statut de la structure.", icon: "ID" },
    { id: "coordonnees", title: "Coordonnées", description: "Adresse, contacts et responsable.", icon: "⌖" },
    { id: "compte", title: "Paramètres du compte", description: "Personnaliser l’apparence de l’application.", icon: "◉" },
    { id: "securite", title: "Sécurité et connexion", description: "Gérer les fournisseurs liés au compte.", icon: "▣" },
    { id: "en-savoir-plus", title: "En savoir plus", description: "Aide, informations et documents E‑Carnet.", icon: "i" },
  ];

  return (
    <div className="establishment-settings settings-page">
      <section className="card establishment-settings__profile account-summary">
        <div className="profile-summary"><div className="avatar avatar--large" aria-hidden="true">{account?.avatar_url ? <img src={account.avatar_url} alt="" /> : selected?.name.slice(0, 2).toUpperCase() ?? "ET"}</div><div><span className="eyebrow">Espace établissement</span><h2>{selected?.name ?? "Compte établissement"}</h2><p className="muted">{selected ? `${selected.city} · ${statusLabel(selected.status)}` : account?.email ?? "Aucun établissement associé"}</p></div></div>
        {establishments.length > 1 && <label className="field"><span>Établissement concerné</span><select value={selected?.id ?? ""} onChange={(event) => setSelectedId(event.target.value)}>{establishments.map((item) => <option key={item.id} value={item.id}>{item.name} · {statusLabel(item.status)}</option>)}</select></label>}
        <p className="notice" role="status" aria-live="polite">{loading ? "Chargement…" : message}</p>
      </section>

      <SettingsDirectory items={navItems} activeId={activeSection} onSelect={setActiveSection} onLogout={() => void logout()} logoutDisabled={signingOut || loading} />

      {activeSection === "administratif" && <section className="card settings-anchor" id="settings-panel-administratif" role="tabpanel" tabIndex={0} aria-labelledby="settings-tab-administratif">
        <span className="eyebrow">Fiche établissement</span><h2>Informations administratives</h2>
        {selected ? <dl className="settings-details"><div><dt>Nom</dt><dd>{selected.name}</dd></div><div><dt>Type de structure</dt><dd>{selected.establishment_type}</dd></div><div><dt>Statut</dt><dd><span className={`badge ${selected.status === "active" ? "active" : "pending"}`}>{statusLabel(selected.status)}</span></dd></div><div><dt>Code interne</dt><dd>{selected.internal_code ?? "Attribué après activation"}</dd></div></dl> : <p className="empty">{loading ? "Chargement…" : "Aucune fiche établissement n’est liée à cette session."}</p>}
        {!selected && !loading && <Link className="button primary" href="/professionnel/etablissements">Déclarer un établissement</Link>}
        {selected && <p className="muted settings-note">La modification de la fiche sera activée avec l’endpoint de mise à jour établissement.</p>}
      </section>}

      {activeSection === "coordonnees" && <section className="card settings-anchor" id="settings-panel-coordonnees" role="tabpanel" tabIndex={0} aria-labelledby="settings-tab-coordonnees">
        <span className="eyebrow">Contact de la structure</span><h2>Coordonnées</h2>
        {selected ? <dl className="settings-details"><div><dt>Responsable déclaré</dt><dd>{selected.responsible_name}</dd></div><div><dt>Ville</dt><dd>{selected.city}</dd></div><div><dt>Adresse</dt><dd>{selected.address}</dd></div><div><dt>Téléphone</dt><dd><a href={`tel:${selected.phone}`}>{selected.phone}</a></dd></div><div><dt>Email établissement</dt><dd><a href={`mailto:${selected.email}`}>{selected.email}</a></dd></div></dl> : <p className="muted">Les coordonnées apparaîtront après la création de la fiche établissement.</p>}
      </section>}

      {activeSection === "compte" && <section className="card settings-anchor" id="settings-panel-compte" role="tabpanel" tabIndex={0} aria-labelledby="settings-tab-compte">
        <span className="eyebrow">Préférences personnelles</span><h2>Paramètres du compte</h2>
        <dl className="settings-details"><div><dt>Responsable du compte</dt><dd>{accountName}</dd></div><div><dt>Email de connexion</dt><dd>{account?.email ?? (loading ? "Chargement…" : "Non disponible")}</dd></div><div><dt>Contexte établissement</dt><dd>{account?.contexts.find((context) => context.role === "establishment")?.is_active ? "Actif" : "Associé au compte"}</dd></div></dl>
        <ThemeSettingsClient compact />
      </section>}

      {activeSection === "securite" && <section className="card settings-anchor" id="settings-panel-securite" role="tabpanel" tabIndex={0} aria-labelledby="settings-tab-securite">
        <span className="eyebrow">Accès au compte</span><h2>Sécurité et connexion</h2>
        <p className="muted">Les actions établissement sont contrôlées côté API selon votre compte et votre rôle. Gérez ci-dessous vos méthodes de connexion.</p>
        <LinkedProvidersSettingsClient nextPath="/etablissement/parametres" />
        <ul className="info-list"><li>La session est gérée par le serveur et protégée contre les requêtes intersites.</li><li>La gestion des appareils et la récupération de compte ne sont pas encore disponibles dans la V1.</li></ul>
      </section>}

      {activeSection === "en-savoir-plus" && <div id="settings-panel-en-savoir-plus" role="tabpanel" tabIndex={0} aria-labelledby="settings-tab-en-savoir-plus"><SettingsMoreSection /></div>}
    </div>
  );
}
