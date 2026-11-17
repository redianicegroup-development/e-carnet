"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { apiGet } from "../../infrastructure/api/client";
import { LANGUAGES } from "../../lib/language";
import { socialLinks } from "../../lib/social";
import { useLanguageChooser } from "../app/LanguageSettings";
import { BrandMark } from "../ui/BrandMark";
import { Icon } from "../ui/Icon";
import { SocialIcon } from "../ui/SocialIcon";

type AccountContext = { role: string; is_active: boolean };
type PublicAccount = { is_admin?: boolean; contexts: AccountContext[] };
type HeaderState = { status: "checking" | "anonymous" } | { status: "connected"; href: string };

const SPACE_BY_ROLE: Record<string, string> = {
  patient: "/patient",
  professional: "/professionnel",
  establishment: "/etablissement",
};

/** Sections de la landing suivies pendant le défilement, dans l'ordre de la page. */
const LANDING_SECTIONS = ["parcours", "profils", "questions", "contact"];

type Current = "page" | "location" | undefined;

/** Une ligne du menu : grand lien (centré sur ordinateur), petit losange juste après le mot quand c'est la page ou la section en cours. */
function NavLink({ href, current, onNavigate, children }: { href: string; current: Current; onNavigate: () => void; children: ReactNode }) {
  return <Link className="pub-nav__link" href={href} aria-current={current} onClick={onNavigate}><span className="pub-nav__text">{children}<span className="pub-nav__dot" aria-hidden="true" /></span></Link>;
}

function workspaceFor(account: PublicAccount): string {
  if (account.is_admin) return "/admin";
  const context = account.contexts.find((item) => item.is_active && SPACE_BY_ROLE[item.role]);
  return context ? SPACE_BY_ROLE[context.role] : "/onboarding";
}

/** Section de la landing actuellement à l'écran (bande étroite au tiers haut de la fenêtre). `null` tant qu'on est dans l'en-tête de page. */
function useLandingSection(enabled: boolean): string | null {
  const [section, setSection] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") return;
    const targets = LANDING_SECTIONS.map((id) => document.getElementById(id)).filter((node): node is HTMLElement => node !== null);
    if (targets.length === 0) return;
    const inBand = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        const current = LANDING_SECTIONS.find((id) => inBand.has(id));
        if (current) setSection(current);
        else if (window.scrollY < 160) setSection(null);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    targets.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [enabled]);

  return enabled ? section : null;
}

export function PublicHeader() {
  const [state, setState] = useState<HeaderState>({ status: "checking" });
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const section = useLandingSection(pathname === "/");
  const { current: language, busy: languageBusy, choose: chooseLanguage } = useLanguageChooser();

  useEffect(() => {
    let active = true;
    apiGet<PublicAccount>("/api/v1/identity/me/", 5000)
      .then((account) => {
        if (active) setState({ status: "connected", href: workspaceFor(account) });
      })
      .catch(() => {
        if (active) setState({ status: "anonymous" });
      });
    return () => { active = false; };
  }, []);

  // Menu ouvert : la page derrière ne défile plus, le focus entre dans le menu et y reste (Tab boucle), Échap le ferme et rend le focus au bouton.
  useEffect(() => {
    if (!menuOpen) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        burgerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !menuRef.current) return;
      const items = Array.from(menuRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  if (state.status === "connected") {
    return (
      <header className="pub-header pub-header--connected">
        <Link className="pub-return-link" href={state.href}>
          <span aria-hidden="true">←</span>
          Retour à mon espace
        </Link>
        <Link className="brand" href="/" aria-label="Mon E-Carnet, accueil">
          <BrandMark variant="duo" />
        </Link>
      </header>
    );
  }

  /* Fermer avant de naviguer : la page doit pouvoir défiler jusqu'à l'ancre (#parcours…) dès le clic. */
  const close = () => {
    document.documentElement.style.overflow = "";
    setMenuOpen(false);
  };
  const hash = (id: string): Current => (section === id ? "location" : undefined);
  const page = (path: string): Current => (pathname === path ? "page" : undefined);

  return (
    <>
      {/* En-tête public : le logo seul, centré en haut, sans fond ni nom, qui défile avec la page. La navigation est dans le menu (bouton à trois traits, fixé en bas). */}
      <header className="pub-header">
        <Link className="brand" href="/" aria-label="Mon E-Carnet, accueil" onClick={close}>
          <BrandMark variant="duo" />
        </Link>
      </header>
      <button
        ref={burgerRef}
        type="button"
        className="pub-burger"
        aria-expanded={menuOpen}
        aria-controls="pub-menu"
        aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
        onClick={() => setMenuOpen((value) => !value)}
      >
        <span aria-hidden="true" />
      </button>
      <div className="pub-menu" id="pub-menu" ref={menuRef} role="dialog" aria-modal="true" aria-label="Menu principal" data-open={menuOpen ? "true" : "false"} data-lenis-prevent inert={!menuOpen}>
        <div className="pub-menu__top">
          <div className="pub-menu__langs notranslate" translate="no" role="group" aria-label="Langue du site">
            {LANGUAGES.map((item) => (
              <button type="button" key={item.code} lang={item.code} aria-label={item.native} aria-current={item.code === language ? "true" : "false"} disabled={languageBusy} onClick={() => void chooseLanguage(item.code)}>
                {item.code.toUpperCase()}
              </button>
            ))}
          </div>
          <Link className="pub-menu__logo" href="/" aria-label="Mon E-Carnet, accueil" onClick={close}>
            <BrandMark variant="duo" />
          </Link>
          <button ref={closeRef} type="button" className="pub-menu__close" aria-label="Fermer le menu" onClick={() => { close(); burgerRef.current?.focus(); }}>
            <span className="pub-menu__close-text">Fermer</span>
            <span className="pub-menu__close-x" aria-hidden="true"><Icon name="close" size={20} /></span>
          </button>
        </div>
        <nav className="pub-nav" aria-label="Navigation principale">
          <NavLink href="/#parcours" current={hash("parcours")} onNavigate={close}>Comment ça marche</NavLink>
          <NavLink href="/#profils" current={hash("profils")} onNavigate={close}>Pour qui</NavLink>
          <NavLink href="/#questions" current={hash("questions")} onNavigate={close}>Questions</NavLink>
          <NavLink href="/a-propos" current={page("/a-propos")} onNavigate={close}>À propos</NavLink>
          <NavLink href="/#contact" current={hash("contact")} onNavigate={close}>Contact</NavLink>
          <NavLink href="/connexion" current={page("/connexion")} onNavigate={close}>Se connecter</NavLink>
        </nav>
        <div className="pub-menu__bottom">
          <nav className="pub-menu__social" aria-label="Nous joindre">
            {socialLinks().map((link) => {
              const icon = link.id === "email" ? <Icon name="mail" size={22} /> : <SocialIcon name={link.id} />;
              if (!link.href) return <span key={link.id} className="pub-menu__social-item is-soon" role="img" aria-label={`${link.label} : bientôt disponible`} title="Bientôt">{icon}</span>;
              return link.external
                ? <a key={link.id} className="pub-menu__social-item" href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label}>{icon}</a>
                : <Link key={link.id} className="pub-menu__social-item" href={link.href} aria-label={link.label} onClick={close}>{icon}</Link>;
            })}
          </nav>
          <p className="pub-menu__copy">© 2026 <span className="notranslate" translate="no">Mon E‑Carnet</span></p>
        </div>
      </div>
    </>
  );
}
