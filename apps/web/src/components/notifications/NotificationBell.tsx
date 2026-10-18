"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
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

export function NotificationBell({ placement = "sidebar" }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<PatientNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [open, setOpen] = useState(false);
  const [marking, setMarking] = useState<Set<string>>(() => new Set());
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const refresh = useCallback(async () => {
    try {
      const inbox = await apiGet<NotificationInbox>(INBOX_URL);
      setNotifications(Array.isArray(inbox.items) ? inbox.items : []);
      setUnreadCount(Number.isFinite(inbox.unread_count) ? Math.max(0, inbox.unread_count) : 0);
      setHasError(false);
    } catch {
      // Une indisponibilité transitoire ne doit pas vider le panneau déjà chargé.
      setHasError(true);
    } finally {
      setLoaded(true);
    }
  }, []);

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
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    const firstFocusable = panel.current?.querySelector<HTMLElement>("a, button");
    firstFocusable?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

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
      // Conserver le contenu affiché et remettre l'état local en attente si le marquage échoue.
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

  const latest = [...notifications]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 6);
  const unreadLabel = unreadCount === 0 ? "aucune notification non lue" : `${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}`;

  return (
    <div className="notification-bell" data-placement={placement} data-open={open} data-unread={unreadCount > 0} ref={root}>
      <button
        ref={trigger}
        type="button"
        className="notification-bell__trigger"
        aria-label={`Notifications : ${unreadLabel}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="notification-bell__goo" aria-hidden="true"><i /><i /></span>
        <Icon name="bell" size={22} />
        {unreadCount > 0 && <span className="notification-bell__badge" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
      {open && (
        <div className="notification-bell__panel" id={panelId} ref={panel} role="dialog" aria-labelledby={`${panelId}-title`}>
          <div className="notification-bell__panel-head">
            <h2 id={`${panelId}-title`}>Notifications</h2>
            <span className="notification-bell__count" aria-live="polite">{unreadLabel}</span>
          </div>
          {hasError && <p className="notification-bell__status" role="status">Actualisation momentanément indisponible.</p>}
          {!loaded && <p className="notification-bell__status" role="status">Chargement des notifications…</p>}
          {loaded && latest.length === 0 && <p className="notification-bell__status">Vous n’avez pas encore de notification.</p>}
          {latest.length > 0 && (
            <ul className="notification-bell__list">
              {latest.map((notification) => {
                const context = contextLink(notification.kind);
                const isMarking = marking.has(notification.id);
                return (
                  <li className={`notification-bell__item${notification.read_at ? " is-read" : " is-unread"}`} key={notification.id}>
                    <div className="notification-bell__item-copy">
                      <strong>{notification.title}</strong>
                      {notification.body && <p>{notification.body}</p>}
                      <time dateTime={notification.created_at}>{formatDate(notification.created_at)}</time>
                    </div>
                    <div className="notification-bell__item-actions">
                      <a href={context.href}>{context.label}</a>
                      {notification.read_at ? <span className="notification-bell__read-state">Lue</span> : (
                        <button type="button" onClick={() => void markAsRead(notification)} disabled={isMarking}>
                          {isMarking ? "Marquage…" : "Marquer comme lue"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <a className="notification-bell__all" href="/patient/carnet#notifications">Voir toutes les notifications</a>
        </div>
      )}
    </div>
  );
}
