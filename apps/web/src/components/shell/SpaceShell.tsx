"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiError, apiGet } from "../../infrastructure/api/client";
import { SPACES, type SpaceId } from "../../lib/spaces";
import { GreetingModal } from "../modal/GreetingModal";
import { Icon } from "../ui/Icon";
import { BrandMark } from "../ui/BrandMark";

export type SpaceAccount = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string;
  date_joined?: string;
  is_admin?: boolean;
  contexts: { role: string; is_active: boolean; onboarding_completed: boolean }[];
  patient_profile: { completed: boolean; id: string | null };
};

const AccountContext = createContext<SpaceAccount | null>(null);
export const useSpaceAccount = () => useContext(AccountContext);

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

type State = { status: "loading" } | { status: "anonymous" } | { status: "error"; message: string } | { status: "ready"; account: SpaceAccount };

export function SpaceShell({ space, children }: { space: SpaceId; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const config = SPACES[space];
  const [state, setState] = useState<State>({ status: "loading" });
  const [navCollapsed, setNavCollapsed] = useState(false);
  function toggleNav() { setNavCollapsed((current) => !current); }
  const bare = config.bare.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const account = await apiGet<SpaceAccount>("/api/v1/identity/me/");
        if (active) setState({ status: "ready", account });
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) setState({ status: "anonymous" });
        else setState({ status: "error", message: error instanceof Error ? error.message : "Service indisponible." });
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (state.status !== "anonymous" || bare) return;
    const requested = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    router.replace(`/connexion?next=${encodeURIComponent(requested)}`);
  }, [state.status, bare, router]);

  const moi = config.tabs[config.tabs.length - 1];
  const showAdminLink = space === "patient" && state.status === "ready" && state.account.is_admin === true;

  return (
    <div className={`space space--${space}${bare ? " space--bare" : ""}${navCollapsed ? " space--nav-collapsed" : ""}`}>
      <header className="space-header">
        <Link className="brand" href={bare || state.status !== "ready" ? "/" : config.home} aria-label="Mon Carnet Numérique, retour à l’accueil de l’espace">
          <BrandMark />
          <span className="brand-text"><strong>E-carnet</strong><small>{config.label}</small></span>
        </Link>
        {state.status === "ready" && (
          <Link className="space-header__me" href={moi.href} aria-label={`${displayName(state.account)} — ouvrir ${moi.long.toLowerCase()}`}>
            <span className="space-header__name">{displayName(state.account)}</span>
            <AvatarBadge account={state.account} size={38} />
          </Link>
        )}
      </header>

      {!bare && (
        <nav className={`space-nav${showAdminLink ? " space-nav--admin" : ""}`} aria-label={`Navigation de l’${config.label.toLowerCase()}`}>
          <button type="button" className="space-nav__toggle" onClick={toggleNav} aria-expanded={!navCollapsed} aria-label={navCollapsed ? "Déplier la navigation" : "Replier la navigation"}><Icon name="chevron" size={18} /><span>{navCollapsed ? "Déplier" : "Réduire"}</span></button>
          <ul>
            {config.tabs.map((tab) => {
              const active = tab.match(pathname);
              return (
                <li key={tab.id}>
                  <Link href={tab.href} className={active ? "space-nav__link is-active" : "space-nav__link"} aria-label={tab.long} title={tab.long} aria-current={active ? "page" : undefined}>
                    <Icon name={tab.icon} size={22} />
                    <span className="space-nav__label">{tab.label}</span>
                    <span className="space-nav__long">{tab.long}</span>
                  </Link>
                </li>
              );
            })}
            {showAdminLink && <li><a href="https://e-carnetci.vercel.app/admin/" target="_blank" rel="noopener noreferrer" className="space-nav__link" aria-label="Administration" title="Administration"><Icon name="shield" size={22} /><span className="space-nav__label">Admin</span><span className="space-nav__long">Administration</span></a></li>}
          </ul>
        </nav>
      )}

      <main className="space-main" id="contenu">
        {state.status === "loading" && <div className="skeleton" role="status" aria-live="polite"><span className="sr-only">Chargement de votre espace…</span><i /><i /><i /></div>}
        {state.status === "anonymous" && !bare && <div className="skeleton" role="status" aria-live="polite"><span className="sr-only">Redirection vers la connexion…</span><i /><i /><i /></div>}
        {state.status === "error" && !bare && (
          <section className="card gate" role="alert"><h1>Service momentanément indisponible</h1><p className="muted">{state.message}</p><div className="actions"><button type="button" className="button primary" onClick={() => window.location.reload()}>Réessayer</button></div></section>
        )}
        {(state.status === "ready" || bare) && (
          <AccountContext.Provider value={state.status === "ready" ? state.account : null}>{children}</AccountContext.Provider>
        )}
        {!bare && <p className="space-footer">Données fictives uniquement pour le moment · <Link href="/aide#confidentialite">Aide</Link></p>}
      </main>
      {state.status === "ready" && !bare && <GreetingModal account={state.account} space={space} />}
    </div>
  );
}
