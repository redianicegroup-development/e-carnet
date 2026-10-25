"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { BrandMark } from "../ui/BrandMark";
import { Icon, type IconName } from "../ui/Icon";
import "./sidebar.css";

/* Sidebar unique des quatre espaces (patient, professionnel, établissement, administration).
   Même structure et même rendu partout, façon Claude : en-tête logo + bouton de repli, navigation en lignes arrondies,
   compte en bas qui ouvre un menu. Sur mobile, la même navigation devient la barre basse des maquettes.
   Chaque espace ne fournit que ses données : entrées, compte, menu du compte. */

export type SidebarItem = {
  id: string;
  /** Libellé court, affiché sous l’icône dans la barre basse mobile. */
  label: string;
  /** Libellé complet, affiché dans la sidebar desktop. */
  long: string;
  icon: IconName;
  active: boolean;
  /** Lien interne (Next) ; sans `href`, l’entrée est un bouton qui appelle `onSelect`. */
  href?: string;
  /** Lien externe, ouvert dans un nouvel onglet. */
  external?: boolean;
  onSelect?: () => void;
  /** Nom accessible complet (par défaut `long`). */
  ariaLabel?: string;
  badge?: number;
  /** Titre de groupe affiché au-dessus de l’entrée (desktop) ; remplacé par un filet quand la sidebar est repliée. */
  heading?: string;
  /** Entrée « compte » : gardée dans la barre basse mobile, mais sur desktop on y accède par le menu du compte. */
  account?: boolean;
  /** Mode onglets (administration) : id du bouton et id du panneau qu’il commande. */
  domId?: string;
  controls?: string;
};

export type SidebarMenuItem = {
  id: string;
  label: string;
  icon: IconName;
  href?: string;
  external?: boolean;
  onSelect?: () => void;
  tone?: "danger";
  disabled?: boolean;
};

export type SidebarAccount = { name: string; email?: string; initials: string; avatarUrl?: string };

export type AppSidebarProps = {
  ariaLabel: string;
  brand: { href: string; title: string; subtitle: string };
  items: SidebarItem[];
  /** "tablist" : les entrées pilotent des panneaux d’une même page (flèches, Début, Fin). */
  listRole?: "tablist";
  listLabel?: string;
  account: SidebarAccount | null;
  /** Écran sans navigation (onboarding, activation) : le compte est un simple lien, sans menu. */
  accountHref?: string;
  menu: SidebarMenuItem[];
  /** Message d’erreur affiché sous le compte (ex. déconnexion échouée). */
  notice?: string;
  /** Outils de l’espace, hors de la liste des onglets (ex. notifications patient). */
  tools?: ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  bare?: boolean;
};

export function SidebarAvatar({ account }: { account: SidebarAccount }) {
  // eslint-disable-next-line @next/next/no-img-element -- avatar externe fourni par le compte
  return account.avatarUrl ? <img className="sb__avatar" src={account.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <span className="sb__avatar" aria-hidden="true">{account.initials}</span>;
}

/* Barre basse mobile : la pastille de l'onglet actif est une goutte (filtre gooey) qui glisse d'un onglet à l'autre.
   Deux gouttes : la première arrive vite, la seconde la rattrape en rebondissant, et le filtre les fond en une seule matière qui s'étire.
   Seules `--x` et `--y` sont écrites ici ; les transitions (et leur suppression en mouvement réduit) sont dans soft-skin.css. */
function useGooeyIndicator(activeId: string | undefined, count: number) {
  const scroll = useRef<HTMLDivElement>(null);
  const placed = useRef(false);

  const place = useCallback((animate: boolean) => {
    const host = scroll.current;
    const active = host?.querySelector<HTMLElement>(".sb__item.is-active");
    const goo = host?.querySelector<HTMLElement>(".sb__goo");
    if (!host) return;
    // Sur grand écran la sidebar est verticale et la goutte masquée : l'onglet actif garde alors son propre fond.
    if (!active || !goo || goo.offsetParent === null) { host.removeAttribute("data-goo"); return; }
    if (!animate) goo.dataset.still = "true";
    const a = active.getBoundingClientRect();
    const h = host.getBoundingClientRect();
    const size = Math.min(a.width, a.height);
    goo.style.setProperty("--size", `${size}px`);
    goo.style.setProperty("--x", `${a.left - h.left + (a.width - size) / 2}px`);
    goo.style.setProperty("--y", `${a.top - h.top + (a.height - size) / 2}px`);
    host.dataset.goo = "on";
    if (!animate) { void goo.offsetWidth; requestAnimationFrame(() => { delete goo.dataset.still; }); }
  }, []);

  // Premier placement et changement d'onglet : seul le changement d'onglet est animé.
  useEffect(() => { place(placed.current); placed.current = true; }, [activeId, count, place]);
  // Rotation, redimensionnement, polices qui s'installent : la goutte se repositionne sans animation.
  useEffect(() => {
    const host = scroll.current;
    if (!host) return;
    const onResize = () => place(false);
    window.addEventListener("resize", onResize);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onResize);
    observer?.observe(host);
    return () => { window.removeEventListener("resize", onResize); observer?.disconnect(); };
  }, [place]);
  return scroll;
}

function ItemBody({ item }: { item: SidebarItem }) {
  return (
    <>
      <Icon name={item.icon} size={20} />
      <span className="sb__label">{item.label}</span>
      <span className="sb__long">{item.long}</span>
      {item.badge ? <span className="sb__badge" aria-hidden="true">{item.badge > 99 ? "99+" : item.badge}</span> : null}
    </>
  );
}

function NavItem({ item, tabs }: { item: SidebarItem; tabs: boolean }) {
  const className = `sb__item${item.active ? " is-active" : ""}${item.account ? " sb__item--account" : ""}`;
  // `data-tour` : repère de la visite guidée (components/tour) ; un onglet = une étape.
  const common = { className, "aria-label": item.ariaLabel ?? item.long, "data-tip": item.long, "data-tour": `nav-${item.id}` };
  if (tabs) {
    return <button type="button" role="tab" id={item.domId} aria-selected={item.active} aria-controls={item.controls} tabIndex={item.active ? 0 : -1} onClick={item.onSelect} {...common}><ItemBody item={item} /></button>;
  }
  if (item.href && item.external) {
    return <a href={item.href} target="_blank" rel="noopener noreferrer" {...common}><ItemBody item={item} /></a>;
  }
  if (item.href) {
    return <Link href={item.href} aria-current={item.active ? "page" : undefined} {...common}><ItemBody item={item} /></Link>;
  }
  return <button type="button" onClick={item.onSelect} aria-current={item.active ? "page" : undefined} {...common}><ItemBody item={item} /></button>;
}

/* Flèches / Début / Fin entre les onglets réellement visibles (certaines entrées sont masquées selon la largeur d’écran). */
function onTabsKeyDown(event: KeyboardEvent<HTMLUListElement>) {
  const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
  const backward = event.key === "ArrowUp" || event.key === "ArrowLeft";
  if (!forward && !backward && event.key !== "Home" && event.key !== "End") return;
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')).filter((tab) => tab.getClientRects().length > 0);
  if (tabs.length === 0) return;
  const current = tabs.indexOf(document.activeElement as HTMLElement);
  let next = Math.max(current, 0);
  if (forward) next = (current + 1) % tabs.length;
  else if (backward) next = (current - 1 + tabs.length) % tabs.length;
  else if (event.key === "Home") next = 0;
  else next = tabs.length - 1;
  event.preventDefault();
  tabs[next].focus();
  tabs[next].click();
}

export function MenuEntry({ entry, onDone }: { entry: SidebarMenuItem; onDone: () => void }) {
  const className = `sb__menu-item${entry.tone === "danger" ? " sb__menu-item--danger" : ""}`;
  const body = <><Icon name={entry.icon} size={18} /><span>{entry.label}</span></>;
  if (entry.href && entry.external) return <a role="menuitem" className={className} href={entry.href} target="_blank" rel="noopener noreferrer" onClick={onDone}>{body}</a>;
  if (entry.href) return <Link role="menuitem" className={className} href={entry.href} onClick={onDone}>{body}</Link>;
  return <button type="button" role="menuitem" className={className} disabled={entry.disabled} onClick={() => { onDone(); entry.onSelect?.(); }}>{body}</button>;
}

function AccountMenu({ account, menu, notice, collapsed }: { account: SidebarAccount; menu: SidebarMenuItem[]; notice?: string; collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    const host = root.current;
    const inner = content.current;
    if (!host || !inner) return;
    const measure = () => {
      const rect = host.getBoundingClientRect();
      const width = collapsed
        ? Math.min(300, window.innerWidth - rect.right - 24)
        : host.clientWidth;
      host.style.setProperty("--gm-w", `${Math.max(180, width)}px`);
      host.style.setProperty("--gm-h", `${inner.offsetHeight}px`);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(inner);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [account.email, account.name, collapsed, menu, notice]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) root.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }, [open]);

  function close(returnFocus = false) {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); close(true); return; }
    if (event.key === "Tab") { setOpen(false); return; }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
    const entries = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'));
    if (entries.length === 0) return;
    const current = entries.indexOf(document.activeElement as HTMLElement);
    let next = 0;
    if (event.key === "ArrowDown") next = (current + 1) % entries.length;
    else if (event.key === "ArrowUp") next = (current - 1 + entries.length) % entries.length;
    else if (event.key === "End") next = entries.length - 1;
    event.preventDefault();
    entries[next].focus();
  }

  const safe = menu.filter((entry) => entry.tone !== "danger");
  const danger = menu.filter((entry) => entry.tone === "danger");
  let itemIndex = 0;
  const step = () => ({ "--i": itemIndex++ } as React.CSSProperties);

  return (
    <div className="sb__foot">
      <div className="gm gm--sidebar" ref={root} data-open={open}>
        <span className="gm__goo" aria-hidden="true"><i className="gm__anchor" /><i className="gm__blob" /></span>
        <div className="gm__panel" id={menuId} role="menu" aria-label={`Compte de ${account.name}`} inert={!open} onKeyDown={onMenuKeyDown}>
          <div className="gm__content" ref={content}>
            <p className="gm__who gm__item" style={step()}><strong>{account.name}</strong>{account.email && <small>{account.email}</small>}</p>
            {safe.map((entry) => <div className="gm__item" style={step()} key={entry.id}><MenuEntry entry={entry} onDone={() => close()} /></div>)}
            {danger.length > 0 && <div className="gm__sep gm__item" style={step()} role="separator" />}
            {danger.map((entry) => <div className="gm__item" style={step()} key={entry.id}><MenuEntry entry={entry} onDone={() => close()} /></div>)}
          </div>
        </div>
        <button ref={trigger} type="button" className={`sb__account gm__trigger${open ? " is-open" : ""}`} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} aria-label={`Compte de ${account.name}`} data-tip={account.name} data-tour="account" onClick={() => setOpen((current) => !current)}>
          <SidebarAvatar account={account} />
          <span className="sb__account-copy"><strong>{account.name}</strong>{account.email && <small>{account.email}</small>}</span>
          <Icon name="chevron" size={16} />
        </button>
      </div>
      {notice && !collapsed && <p className="sb__notice" role="alert">{notice}</p>}
    </div>
  );
}

export function AppSidebar({ ariaLabel, brand, items, listRole, listLabel, account, accountHref, menu, notice, tools, collapsed, onToggle, bare = false }: AppSidebarProps) {
  const tabs = listRole === "tablist";
  const rail = collapsed && !bare;
  const scroll = useGooeyIndicator(items.find((item) => item.active)?.id, items.length);
  return (
    <nav className={`sb${rail ? " is-collapsed" : ""}${bare ? " is-bare" : ""}`} aria-label={ariaLabel}>
      <div className="sb__head">
        <Link className="sb__brand" href={brand.href} aria-label={`${brand.title}, ${brand.subtitle.toLowerCase()} : retour à l’accueil`}>
          <BrandMark />
          <span className="sb__brand-text"><strong>{brand.title}</strong><small>{brand.subtitle}</small></span>
        </Link>
        <button type="button" className="sb__toggle" onClick={onToggle} aria-expanded={!rail} aria-label={rail ? "Déplier la navigation" : "Replier la navigation"} data-tip={rail ? "Déplier" : "Replier"}>
          <Icon name="sidebar" size={20} />
        </button>
      </div>

      {!bare && (
        <div className="sb__scroll" ref={scroll}>
          <span className="sb__goo" aria-hidden="true"><i className="sb__blob sb__blob--lead" /><i className="sb__blob sb__blob--trail" /></span>
          <ul className="sb__list" role={tabs ? "tablist" : undefined} aria-label={tabs ? listLabel : undefined} onKeyDown={tabs ? onTabsKeyDown : undefined}>
            {items.map((item) => (
              <li key={item.id} className="sb__row" role={tabs ? "presentation" : undefined}>
                {item.heading && <span className="sb__heading" aria-hidden="true">{item.heading}</span>}
                <NavItem item={item} tabs={tabs} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {!bare && <div className="sb__tools">{tools}</div>}

      {account && (bare
        ? (
          <div className="sb__foot">
            <Link className="sb__account" href={accountHref ?? brand.href} aria-label={`${account.name} — ouvrir le profil`} data-tip={account.name}>
              <SidebarAvatar account={account} />
              <span className="sb__account-copy"><strong>{account.name}</strong>{account.email && <small>{account.email}</small>}</span>
            </Link>
          </div>
        )
        : <AccountMenu account={account} menu={menu} notice={notice} collapsed={rail} />)}
    </nav>
  );
}
