"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { apiGet } from "../../infrastructure/api/client";
import { BrandMark } from "../ui/BrandMark";

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

function NavLink({ href, current, onNavigate, children }: { href: string; current: Current; onNavigate: () => void; children: ReactNode }) {
  return <Link href={href} aria-current={current} onClick={onNavigate}>{children}</Link>;
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
  const headerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const section = useLandingSection(pathname === "/");

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

  // Menu mobile ouvert : Échap le ferme (le focus revient au bouton), un appui en dehors aussi, et il se referme si l'écran devient large.
  useEffect(() => {
    if (!menuOpen) return;
    // Le menu précède le bouton dans l'ordre de tabulation : on place le focus sur son premier lien.
    menuRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      burgerRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const wide = window.matchMedia("(min-width: 1200px)");
    const onWide = (event: MediaQueryListEvent) => { if (event.matches) setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    wide.addEventListener("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      wide.removeEventListener("change", onWide);
    };
  }, [menuOpen]);

  if (state.status === "connected") {
    return (
      <header className="pub-header pub-header--connected">
        <Link className="pub-return-link" href={state.href}>
          <span aria-hidden="true">←</span>
          Retour à mon espace
        </Link>
      </header>
    );
  }

  const close = () => setMenuOpen(false);
  const hash = (id: string): Current => (section === id ? "location" : undefined);
  const page = (path: string): Current => (pathname === path ? "page" : undefined);

  return (
    <header className="pub-header" ref={headerRef}>
      <Link className="brand" href="/" aria-label="Mon E-Carnet, accueil" onClick={close}>
        <BrandMark />
        <span className="brand-text"><strong>Mon E‑Carnet</strong><small>Carnet de santé numérique</small></span>
      </Link>
      <div className="pub-menu" id="pub-menu" ref={menuRef} data-open={menuOpen ? "true" : "false"}>
        <nav className="pub-nav" aria-label="Navigation principale">
          <NavLink href="/#parcours" current={hash("parcours")} onNavigate={close}>Comment ça marche</NavLink>
          <NavLink href="/#profils" current={hash("profils")} onNavigate={close}>Pour qui</NavLink>
          <NavLink href="/securite" current={page("/securite")} onNavigate={close}>Sécurité</NavLink>
          <NavLink href="/#questions" current={hash("questions")} onNavigate={close}>Questions</NavLink>
          <NavLink href="/a-propos" current={page("/a-propos")} onNavigate={close}>À propos</NavLink>
          <NavLink href="/#contact" current={hash("contact")} onNavigate={close}>Contact</NavLink>
        </nav>
        <Link className="pub-menu__login" href="/connexion" onClick={close}>Se connecter</Link>
      </div>
      <div className="pub-actions">
        <Link className="button ghost small" href="/connexion">Se connecter</Link>
        <Link className="button primary small" href="/connexion?mode=register">Créer mon carnet</Link>
      </div>
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
    </header>
  );
}
