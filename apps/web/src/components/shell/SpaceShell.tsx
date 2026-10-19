"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiError, apiGet, apiPost } from "../../infrastructure/api/client";
import { isSessionMissing } from "../../lib/session";
import { SPACES, type SpaceId } from "../../lib/spaces";
import { useConfirm } from "../modal/ConfirmProvider";
import { GreetingModal } from "../modal/GreetingModal";
import { BrandMark } from "../ui/BrandMark";
import { ScreenLoader } from "../ui/ScreenLoader";
import { NotificationBell } from "../notifications/NotificationBell";
import { GooeyAccountMenu } from "./GooeyAccountMenu";
import { AppSidebar, type SidebarItem, type SidebarMenuItem } from "./AppSidebar";

export type SpaceAccount = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string;
  date_joined?: string;
  is_admin?: boolean;
  must_change_password?: boolean;
  contexts: { role: string; is_active: boolean; onboarding_completed: boolean }[];
  patient_profile: { completed: boolean; id: string | null };
};

const AccountContext = createContext<SpaceAccount | null>(null);
export const useSpaceAccount = () => useContext(AccountContext);

type PatientAccessQr = { token: string; expiresAt: number };
type PatientAccessQrContextValue = {
  qr: PatientAccessQr | null;
  setQr: (qr: PatientAccessQr | null) => void;
};
const PatientAccessQrContext = createContext<PatientAccessQrContextValue | null>(null);

export function usePatientAccessQr() {
  const context = useContext(PatientAccessQrContext);
  if (!context) throw new Error("Le QR d’accès patient doit être utilisé dans l’espace Patient.");
  return context;
}

export function displayName(account: Pick<SpaceAccount, "first_name" | "last_name" | "email">) {
  return [account.first_name, account.last_name].filter(Boolean).join(" ") || account.email;
}
export function initials(account: Pick<SpaceAccount, "first_name" | "last_name" | "email">) {
  return `${account.first_name[0] ?? ""}${account.last_name[0] ?? ""}`.toUpperCase() || (account.email[0] ?? "?").toUpperCase();
}

export function AvatarBadge({ account, size = 40 }: { account: Pick<SpaceAccount, "first_name" | "last_name" | "email" | "avatar_url">; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  // eslint-disable-next-line @next/next/no-img-element -- avatar externe fourni par le compte
  return account.avatar_url ? <img className="avatar" style={style} src={account.avatar_url} alt="" referrerPolicy="no-referrer" /> : <span className="avatar" style={style} aria-hidden="true">{initials(account)}</span>;
}

type State = { status: "loading"; label: string } | { status: "anonymous" } | { status: "error"; message: string } | { status: "ready"; account: SpaceAccount };
const WAKE_RETRY_MS = 2000;
const WAKE_TIMEOUT_MS = 15000;
const WAKE_BUDGET_MS = 120000;

function isTransientConnectionError(error: unknown): boolean {
  return error instanceof TypeError
    || (error instanceof DOMException && error.name === "AbortError")
    || (error instanceof ApiError && [0, 502, 503, 504].includes(error.status));
}

export function SpaceShell({ space, children }: { space: SpaceId; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const confirm = useConfirm();
  const config = SPACES[space];
  const [state, setState] = useState<State>({ status: "loading", label: "Chargement de votre espace…" });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [patientAccessQr, setPatientAccessQr] = useState<PatientAccessQr | null>(null);
  const [navCollapsed, setNavCollapsed] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState("");
  function toggleNav() { setNavCollapsed((current) => !current); }
  async function logout() {
    const ok = await confirm({ title: "Se déconnecter ?", message: "Vous allez être déconnecté de cet appareil.", note: "Vos données restent enregistrées dans votre compte.", confirmLabel: "Me déconnecter", cancelLabel: "Rester connecté", tone: "neutral", mood: "decision" });
    if (!ok) return;
    setSigningOut(true);
    setLogoutMessage("");
    try {
      await apiPost("/api/v1/identity/logout/");
      router.replace("/connexion");
      router.refresh();
    } catch (error) {
      setLogoutMessage(error instanceof Error ? error.message : "La déconnexion n’a pas abouti.");
      setSigningOut(false);
    }
  }
  const bare = config.bare.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  // Le QR vit dans le shell (il survit au changement d’onglet) mais ne s’affiche que sur l’onglet « Accès et QR » :
  // le shell ne fait que le retirer à l’expiration, sans re-rendre tout l’espace chaque seconde.
  useEffect(() => {
    if (space !== "patient" || !patientAccessQr) return;
    const timer = window.setTimeout(() => setPatientAccessQr(null), Math.max(0, patientAccessQr.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [space, patientAccessQr]);

  useEffect(() => {
    const clearQrForProfileChange = () => setPatientAccessQr(null);
    window.addEventListener("ecarnet:patient-profile-changed", clearQrForProfileChange);
    return () => window.removeEventListener("ecarnet:patient-profile-changed", clearQrForProfileChange);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      const deadline = Date.now() + WAKE_BUDGET_MS;
      setState({ status: "loading", label: "Veuillez patienter, chargement de votre espace…" });
      while (active && Date.now() < deadline) {
        let checkingIdentity = false;
        try {
          const probeController = new AbortController();
          const timeout = window.setTimeout(() => probeController.abort(), WAKE_TIMEOUT_MS);
          const abortProbe = () => probeController.abort();
          controller.signal.addEventListener("abort", abortProbe, { once: true });
          let probe: Response;
          try {
            probe = await fetch("/api/v1/health/ready/", {
              credentials: "omit",
              cache: "no-store",
              signal: probeController.signal,
            });
          } finally {
            window.clearTimeout(timeout);
            controller.signal.removeEventListener("abort", abortProbe);
          }
          if (!probe.ok) throw new ApiError("Le service démarre encore.", probe.status);

          checkingIdentity = true;
          const account = await apiGet<SpaceAccount>("/api/v1/identity/me/", 20000);
          if (active) setState({ status: "ready", account });
          return;
        } catch (error) {
          if (!active) return;
          if (checkingIdentity && isSessionMissing(error)) {
            setState({ status: "anonymous" });
            return;
          }
          if (!isTransientConnectionError(error)) {
            setState({ status: "error", message: error instanceof Error ? error.message : "Service indisponible." });
            return;
          }
          await new Promise((resolve) => window.setTimeout(resolve, WAKE_RETRY_MS));
        }
      }
      if (active) setState({ status: "error", message: "Le service met plus de temps que prévu à démarrer. Réessayez dans un instant." });
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [loadAttempt]);

  useEffect(() => {
    if (state.status !== "anonymous" || bare) return;
    const requested = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    router.replace(`/connexion?next=${encodeURIComponent(requested)}`);
  }, [state.status, bare, router]);

  // Mot de passe temporaire : le serveur ferme l'API tant qu'il n'est pas remplacé, l'écran de changement est la seule issue.
  const passwordChangePending = state.status === "ready" && state.account.must_change_password === true;
  useEffect(() => {
    if (passwordChangePending) router.replace("/connexion/nouveau-mot-de-passe");
  }, [passwordChangePending, router]);

  // Onboarding de l'établissement : tant que la fiche n'est pas complétée, l'espace reste fermé (le serveur bloque aussi les codes).
  const profilePending = space === "establishment" && state.status === "ready" && !passwordChangePending && state.account.contexts.some((context) => context.role === "establishment" && !context.onboarding_completed);
  useEffect(() => {
    if (profilePending && !bare) router.replace("/etablissement/fiche");
  }, [profilePending, bare, router]);

  const moi = config.tabs[config.tabs.length - 1];
  const showAdminLink = space === "patient" && state.status === "ready" && state.account.is_admin === true;

  const visibleTabs = config.tabs.filter((tab) => !(space === "patient" && tab.id === "moi"));
  const items: SidebarItem[] = visibleTabs.map((tab) => ({ id: tab.id, label: tab.label, long: tab.long, icon: tab.icon, href: tab.href, active: tab.match(pathname), account: tab === moi }));
  const menu: SidebarMenuItem[] = [
    { id: "settings", label: "Profil et paramètres", icon: "sliders", href: moi.href },
    { id: "help", label: "Centre d’aide", icon: "help", href: "/aide" },
    ...(showAdminLink ? [{ id: "admin", label: "Administration", icon: "shield" as const, href: "https://e-carnetci.vercel.app/admin/", external: true }] : []),
    { id: "logout", label: signingOut ? "Déconnexion…" : "Se déconnecter", icon: "logout", tone: "danger", disabled: signingOut, onSelect: () => void logout() },
  ];

  return (
    <div className={`space space--${space}${bare ? " space--bare" : ""}${navCollapsed && !bare ? " space--nav-collapsed" : ""}`}>
      <AppSidebar
        ariaLabel={`Navigation de l’${config.label.toLowerCase()}`}
        brand={{ href: bare || state.status !== "ready" ? "/" : config.home, title: "Mon E-Carnet", subtitle: config.label }}
        items={items}
        account={state.status === "ready" ? { name: displayName(state.account), email: state.account.email, initials: initials(state.account), avatarUrl: state.account.avatar_url || undefined } : null}
        accountHref={moi.href}
        menu={menu}
        notice={logoutMessage}
        tools={space === "patient" && state.status === "ready" ? <NotificationBell placement="sidebar" /> : null}
        collapsed={navCollapsed}
        onToggle={toggleNav}
        bare={bare}
      />

      <main className="space-main" id="contenu">
        {!bare && (
          <header className="space-mobile-header">
            <Link className="space-mobile-header__brand" href={config.home} aria-label={`Mon E-Carnet, accueil ${config.label.toLowerCase()}`}>
              <BrandMark />
              <span><strong>Mon E‑Carnet</strong><small>{config.label}</small></span>
            </Link>
            {/* Menu du compte en goutte (barre haute mobile) : sur grand écran, le même menu est dans la sidebar. */}
            <div className="space-mobile-header__actions">
              {space === "patient" && state.status === "ready" && <NotificationBell placement="mobile" />}
              {state.status === "ready" && <GooeyAccountMenu account={{ name: displayName(state.account), email: state.account.email, initials: initials(state.account), avatarUrl: state.account.avatar_url || undefined }} menu={menu} notice={logoutMessage} />}
            </div>
          </header>
        )}
        {state.status === "loading" && <ScreenLoader label={state.label} />}
        {state.status === "anonymous" && !bare && <div className="skeleton" role="status" aria-live="polite"><span className="sr-only">Redirection vers la connexion…</span><i /><i /><i /></div>}
        {state.status === "error" && !bare && (
          <section className="card gate" role="alert"><h1>Service momentanément indisponible</h1><p className="muted">{state.message}</p><div className="actions"><button type="button" className="button primary" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Réessayer</button></div></section>
        )}
        {passwordChangePending && <ScreenLoader label="Redirection vers le choix de votre mot de passe…" />}
        {((state.status === "ready" && !passwordChangePending) || bare) && (
          <AccountContext.Provider value={state.status === "ready" ? state.account : null}>
            <PatientAccessQrContext.Provider value={{ qr: patientAccessQr, setQr: setPatientAccessQr }}>
              {children}
            </PatientAccessQrContext.Provider>
          </AccountContext.Provider>
        )}
        {!bare && <p className="space-footer"><Link href="/aide#donnees">Aide</Link></p>}
      </main>
      {state.status === "ready" && !bare && <GreetingModal account={state.account} space={space} />}
    </div>
  );
}
