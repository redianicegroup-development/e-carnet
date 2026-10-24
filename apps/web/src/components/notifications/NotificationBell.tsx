"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { apiGet, apiPatch } from "../../infrastructure/api/client";
import { Icon } from "../ui/Icon";
import "./notification-bell.css";

export type PatientNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

type NotificationInbox = { items: PatientNotification[]; unread_count: number };
type NotificationBellProps = { placement?: "sidebar" | "mobile" };

const INBOX_URL = "/api/v1/patient/care/notifications/inbox/";
const REFRESH_INTERVAL_MS = 60_000;
const PANEL_MAX_WIDTH = 360;
const PANEL_MIN_WIDTH = 200;
const PANEL_EDGE_MARGIN = 12;
const PANEL_OVERHANG = 8; // le panneau dépasse de 8 px du bouton (voir notification-bell.css)

type PanelFit = { align: "right" | "left"; width: number };

function contextLink(kind: string) {
  const normalized = kind.toLocaleLowerCase("fr-FR");
  if (/consult|visit|rendez|appointment/.test(normalized)) return { href: "/patient/consultations", label: "Voir les visites" };
  if (/access|share|grant|partag/.test(normalized)) return { href: "/patient/acces", label: "Voir les accès" };
  if (/vaccin/.test(normalized)) return { href: "/patient/carnet#vaccinations", label: "Voir mes vaccinations" };
  if (/medicat|treatment|rappel/.test(normalized)) return { href: "/patient/carnet#medications", label: "Voir mes traitements" };
  if (/profile|account|param/.test(normalized)) return { href: "/patient/parametres", label: "Voir le profil" };
  return { href: "/patient/carnet#notifications", label: "Voir dans mon carnet" };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date indisponible";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function createNotificationAudio() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

function playNotificationChime(audioContext: AudioContext | null, count = 1) {
  if (!audioContext || audioContext.state === "suspended") return;
  const now = audioContext.currentTime;
  for (let index = 0; index < count; index += 1) {
    const start = now + index * 0.16;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(index % 2 === 0 ? 740 : 988, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.075, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.15);
  }
}

export function NotificationBell({ placement = "sidebar" }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<PatientNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [open, setOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [marking, setMarking] = useState<Set<string>>(() => new Set());
  const [fit, setFit] = useState<PanelFit>({ align: "right", width: PANEL_MAX_WIDTH });
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const audioContext = useRef<AudioContext | null>(null);
  const knownIds = useRef<Set<string>>(new Set());
  const hasSeededNotifications = useRef(false);

  const unlockAudio = useCallback(async () => {
    if (!audioContext.current) audioContext.current = createNotificationAudio();
    if (audioContext.current?.state === "suspended") await audioContext.current.resume();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const inbox = await apiGet<NotificationInbox>(INBOX_URL);
      const nextNotifications = Array.isArray(inbox.items) ? inbox.items : [];
      const incomingUnread = nextNotifications.filter((item) => !item.read_at && !knownIds.current.has(item.id));
      if (hasSeededNotifications.current && soundEnabled && incomingUnread.length > 0) {
        playNotificationChime(audioContext.current, incomingUnread.length);
      }
      nextNotifications.forEach((item) => knownIds.current.add(item.id));
      hasSeededNotifications.current = true;
      setNotifications(nextNotifications);
      setUnreadCount(Number.isFinite(inbox.unread_count) ? Math.max(0, inbox.unread_count) : 0);
      setHasError(false);
    } catch {
      // Une indisponibilité transitoire ne doit pas vider le panneau déjà chargé.
      setHasError(true);
    } finally {
      setLoaded(true);
    }
  }, [soundEnabled]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = window.setInterval(refreshWhenVisible, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  // Le panneau reste toujours dans l'écran : il s'ancre côté bouton où il y a le plus de place (cloche du header mobile,
  // collée à droite sous le menu du compte ; cloche de la sidebar PC, collée à gauche) et se rétrécit si l'écran est étroit.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const room = { right: rect.right + PANEL_OVERHANG - PANEL_EDGE_MARGIN, left: window.innerWidth - rect.left + PANEL_OVERHANG - PANEL_EDGE_MARGIN };
      const align = room.right >= Math.min(PANEL_MAX_WIDTH, room.left) ? "right" : "left";
      const width = Math.round(Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, room[align])));
      setFit((current) => (current.align === align && current.width === width ? current : { align, width }));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open]);

  // Même goutte que le menu du compte (classes `gm__*`, voir soft-skin.css) : la hauteur du panneau ouvert est celle de son contenu.
  useLayoutEffect(() => {
    const host = root.current;
    const inner = content.current;
    if (!host || !inner) return;
    const measure = () => host.style.setProperty("--gm-h", `${inner.offsetHeight}px`);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [fit.width]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
      if (event.key === "Tab") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    const firstFocusable = panel.current?.querySelector<HTMLElement>("a, button");
    const focusTimer = window.setTimeout(() => firstFocusable?.focus(), 80);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  async function toggleOpen() {
    await unlockAudio();
    setOpen((current) => !current);
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (next) void unlockAudio();
  }

  async function markAsRead(notification: PatientNotification) {
    if (notification.read_at || marking.has(notification.id)) return;
    const readAt = new Date().toISOString();
    const previousReadAt = notification.read_at;
    setMarking((current) => new Set(current).add(notification.id));
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: readAt } : item));
    setUnreadCount((current) => Math.max(0, current - 1));
    try {
      await apiPatch<unknown>(`/api/v1/patient/care/notifications/${encodeURIComponent(notification.id)}/read/`, {});
    } catch {
      setNotifications((current) => current.map((item) => item.id === notification.id && item.read_at === readAt ? { ...item, read_at: previousReadAt } : item));
      setUnreadCount((current) => current + 1);
      setHasError(true);
    } finally {
      setMarking((current) => {
        const next = new Set(current);
        next.delete(notification.id);
        return next;
      });
    }
  }

  // Hauteur du panneau = hauteur réelle du contenu (comme le menu du compte), et non plus une hauteur fixe de 420 px.
  useEffect(() => {
    const host = root.current;
    const inner = content.current;
    if (!host || !inner) return;
    const measure = () => host.style.setProperty("--nb-h", `${inner.offsetHeight}px`);
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(inner);
    return () => observer?.disconnect();
  }, [fit.width, notifications.length]);

  const latest = [...notifications].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()).slice(0, 6);
  const unreadLabel = unreadCount === 0 ? "aucune notification non lue" : `${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}`;
  let itemIndex = 0;
  const step = () => ({ "--i": itemIndex++ } as CSSProperties);

  return (
    <div className="notification-bell gm" data-placement={placement} data-open={open} data-align={fit.align} data-unread={unreadCount > 0} style={{ "--gm-w": `${fit.width}px` } as CSSProperties} ref={root}>
      <span className="gm__goo" aria-hidden="true"><i className="gm__anchor" /><i className="gm__blob" /></span>
      <div className="gm__panel notification-bell__panel" id={panelId} ref={panel} role="dialog" aria-labelledby={`${panelId}-title`} inert={!open}>
        <div className="gm__content notification-bell__content" ref={content}>
          <div className="gm__item notification-bell__panel-head" style={step()}>
            <div><h2 id={`${panelId}-title`}>Notifications</h2><span className="notification-bell__count" aria-live="polite">{unreadLabel}</span></div>
            <button type="button" className="notification-bell__sound" onClick={toggleSound} aria-pressed={soundEnabled} aria-label={soundEnabled ? "Désactiver la sonnerie" : "Activer la sonnerie"} title={soundEnabled ? "Sonnerie active" : "Sonnerie désactivée"}><span aria-hidden="true">{soundEnabled ? "♪" : "×"}</span></button>
          </div>
          {hasError && <p className="gm__item notification-bell__status" style={step()} role="status">Actualisation momentanément indisponible.</p>}
          {!loaded && <p className="gm__item notification-bell__status" style={step()} role="status">Chargement des notifications…</p>}
          {loaded && latest.length === 0 && <p className="gm__item notification-bell__status" style={step()}>Vous n’avez pas encore de notification.</p>}
          {latest.length > 0 && <ul className="notification-bell__list">{latest.map((notification) => {
            const context = contextLink(notification.kind);
            const isMarking = marking.has(notification.id);
            return <li className={`gm__item notification-bell__item${notification.read_at ? " is-read" : " is-unread"}`} style={step()} key={notification.id}>
              <div className="notification-bell__item-copy"><strong>{notification.title}</strong>{notification.body && <p>{notification.body}</p>}<time dateTime={notification.created_at}>{formatDate(notification.created_at)}</time></div>
              <div className="notification-bell__item-actions"><a href={context.href}>{context.label}</a>{notification.read_at ? <span className="notification-bell__read-state">Lue</span> : <button type="button" onClick={() => void markAsRead(notification)} disabled={isMarking}>{isMarking ? "Marquage…" : "Marquer comme lue"}</button>}</div>
            </li>;
          })}</ul>}
          <a className="gm__item notification-bell__all" style={step()} href="/patient/carnet#notifications">Voir toutes les notifications</a>
        </div>
      </div>
      <button ref={trigger} type="button" className="gm__trigger notification-bell__trigger" aria-label={`Notifications : ${unreadLabel}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={panelId} onClick={() => void toggleOpen()}>
        <Icon name="bell" size={22} />
        {unreadCount > 0 && <span className="notification-bell__badge" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
    </div>
  );
}
