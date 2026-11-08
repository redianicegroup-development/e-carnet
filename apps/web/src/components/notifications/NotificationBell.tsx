"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../infrastructure/api/client";
import { Icon } from "../ui/Icon";
import { NOTIFICATIONS_REFRESH_EVENT, SERVICE_WORKER_PUSH_MESSAGE, announceNewNotifications } from "./notification-events";
import "./notification-bell.css";

export type PatientNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

type NotificationInbox = { items: PatientNotification[]; unread_count: number; total_count?: number };
type NotificationPulse = { unread_count: number; total_count: number; latest_at: string | null };
type NotificationBellProps = { placement?: "sidebar" | "mobile" };
type Tab = "new" | "all";

const BASE_URL = "/api/v1/patient/care/notifications/";
const INBOX_URL = "/api/v1/patient/care/notifications/inbox/";
const PULSE_URL = "/api/v1/patient/care/notifications/pulse/";
/* « Temps réel » : le serveur (gunicorn sur Render) ne tient pas de connexion ouverte ; la cloche interroge donc un pouls de quelques octets
   toutes les 5 s tant que l'écran est visible et en ligne, et ne recharge la boîte que si ce pouls change. Un push reçu la réveille aussitôt. */
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_BACKOFF_MS = 60_000;
const CONFIRM_CLEAR_MS = 4_000;
const PANEL_MAX_WIDTH = 360;
const PANEL_MIN_WIDTH = 200;
const PANEL_EDGE_MARGIN = 12;
const PANEL_OVERHANG = 8; // le panneau dépasse de 8 px du bouton (voir notification-bell.css)

type PanelFit = { align: "right" | "left"; width: number };

function contextLink(kind: string) {
  const normalized = kind.toLocaleLowerCase("fr-FR");
  if (/consult|visit|rendez|appointment/.test(normalized)) return { href: "/patient/consultations", label: "Voir les visites" };
  if (/access|share|grant|partag/.test(normalized)) return { href: "/patient/historique#acces", label: "Voir les accès" };
  if (/vaccin/.test(normalized)) return { href: "/patient/carnet#vaccinations", label: "Voir mes vaccinations" };
  if (/medicat|treatment|rappel/.test(normalized)) return { href: "/patient/carnet#medications", label: "Voir mes traitements" };
  if (/profile|account|param/.test(normalized)) return { href: "/patient/parametres", label: "Voir le profil" };
  return { href: "/patient/carnet#notifications", label: "Voir dans mon carnet" };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date indisponible";
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1 && minutes > -2) return "À l’instant";
  if (minutes >= 1 && minutes < 60) return `Il y a ${minutes} min`;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function pulseSignature(pulse: Pick<NotificationPulse, "unread_count" | "total_count" | "latest_at">) {
  return `${pulse.unread_count}|${pulse.total_count}|${pulse.latest_at ?? ""}`;
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
  const [totalCount, setTotalCount] = useState(0);
  const [tab, setTab] = useState<Tab | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [marking, setMarking] = useState<Set<string>>(() => new Set());
  const [removing, setRemoving] = useState<Set<string>>(() => new Set());
  const [fit, setFit] = useState<PanelFit>({ align: "right", width: PANEL_MAX_WIDTH });
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const audioContext = useRef<AudioContext | null>(null);
  const knownIds = useRef<Set<string>>(new Set());
  const hasSeededNotifications = useRef(false);
  const soundRef = useRef(true);
  const signature = useRef<string | null>(null);
  const failures = useRef(0);
  const polling = useRef(false);
  const confirmTimer = useRef<number | null>(null);

  const unlockAudio = useCallback(async () => {
    if (!audioContext.current) audioContext.current = createNotificationAudio();
    if (audioContext.current?.state === "suspended") await audioContext.current.resume();
  }, []);

  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);

  /** Recharge la boîte complète (appelé seulement quand le pouls a changé, à l'ouverture, ou après une action). */
  const refresh = useCallback(async () => {
    try {
      const inbox = await apiGet<NotificationInbox>(INBOX_URL);
      const nextNotifications = Array.isArray(inbox.items) ? inbox.items : [];
      const incomingUnread = nextNotifications.filter((item) => !item.read_at && !knownIds.current.has(item.id));
      if (hasSeededNotifications.current && incomingUnread.length > 0) {
        if (soundRef.current) playNotificationChime(audioContext.current, incomingUnread.length);
        // Les écrans concernés (accès, QR affiché…) se rechargent tout de suite au lieu d'attendre leur propre rafraîchissement.
        announceNewNotifications(incomingUnread.map((item) => ({ kind: item.kind, title: item.title, body: item.body })));
      }
      nextNotifications.forEach((item) => knownIds.current.add(item.id));
      hasSeededNotifications.current = true;
      const unread = Number.isFinite(inbox.unread_count) ? Math.max(0, inbox.unread_count) : 0;
      setNotifications(nextNotifications);
      setUnreadCount(unread);
      setTotalCount(Number.isFinite(inbox.total_count) ? Math.max(0, Number(inbox.total_count)) : nextNotifications.length);
      setHasError(false);
      return true;
    } catch {
      // Une indisponibilité transitoire ne doit pas vider le panneau déjà chargé.
      setHasError(true);
      return false;
    } finally {
      setLoaded(true);
    }
  }, []);

  /** Un tour de pouls : une requête minuscule ; la boîte n'est rechargée que si le résumé du serveur a changé. */
  const poll = useCallback(async () => {
    if (polling.current) return;
    polling.current = true;
    try {
      const pulse = await apiGet<NotificationPulse>(PULSE_URL, 8000);
      const next = pulseSignature(pulse);
      if (next !== signature.current || !hasSeededNotifications.current) {
        const ok = await refresh();
        if (ok) signature.current = next;
      }
      failures.current = 0;
      setHasError(false);
      setLoaded(true);
    } catch {
      failures.current += 1;
      setHasError(true);
      setLoaded(true);
    } finally {
      polling.current = false;
    }
  }, [refresh]);

  useEffect(() => {
    let timer: number | null = null;
    let stopped = false;
    const canPoll = () => document.visibilityState === "visible" && navigator.onLine !== false;
    const schedule = () => {
      if (stopped) return;
      if (timer) window.clearTimeout(timer);
      const delay = Math.min(POLL_MAX_BACKOFF_MS, POLL_INTERVAL_MS * 2 ** Math.min(failures.current, 4));
      timer = window.setTimeout(tick, delay);
    };
    const tick = async () => {
      if (canPoll()) await poll();
      schedule();
    };
    // Reprise immédiate : retour sur l'onglet, retour du réseau, événement interne, push reçu par le service worker.
    const wakeUp = () => {
      if (!canPoll()) return;
      failures.current = 0;
      void poll().finally(schedule);
    };
    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === SERVICE_WORKER_PUSH_MESSAGE) wakeUp();
    };
    const first = window.setTimeout(wakeUp, 0);
    schedule();
    window.addEventListener("focus", wakeUp);
    window.addEventListener("online", wakeUp);
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, wakeUp);
    document.addEventListener("visibilitychange", wakeUp);
    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      window.clearTimeout(first);
      window.removeEventListener("focus", wakeUp);
      window.removeEventListener("online", wakeUp);
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, wakeUp);
      document.removeEventListener("visibilitychange", wakeUp);
      navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
    };
  }, [poll]);

  useEffect(() => () => { if (confirmTimer.current) window.clearTimeout(confirmTimer.current); }, []);

  // Le panneau reste toujours dans l'écran : il s'ancre côté bouton où il y a le plus de place (cloche du header mobile,
  // collée à droite sous le menu du compte ; cloche de la sidebar PC, collée à gauche) et se rétrécit si l'écran est étroit.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      if (placement === "sidebar") {
        // Barre latérale PC : la goutte s'ouvre toujours vers le haut, collée au bord gauche du bouton, et peut déborder sur la page.
        const width = Math.round(Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, window.innerWidth - rect.left - PANEL_EDGE_MARGIN)));
        setFit((current) => (current.align === "left" && current.width === width ? current : { align: "left", width }));
        return;
      }
      const room = { right: rect.right + PANEL_OVERHANG - PANEL_EDGE_MARGIN, left: window.innerWidth - rect.left + PANEL_OVERHANG - PANEL_EDGE_MARGIN };
      const align = room.right >= Math.min(PANEL_MAX_WIDTH, room.left) ? "right" : "left";
      const width = Math.round(Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, room[align])));
      setFit((current) => (current.align === align && current.width === width ? current : { align, width }));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, placement]);

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

  /** Après une action sur la boîte, le pouls change : on aligne la signature pour ne pas recharger inutilement. */
  function syncSignature(unread: number, total: number) {
    signature.current = pulseSignature({ unread_count: unread, total_count: total, latest_at: notifications[0]?.created_at ?? null });
  }

  async function removeOne(notification: PatientNotification) {
    if (removing.has(notification.id)) return;
    setRemoving((current) => new Set(current).add(notification.id));
    try {
      await apiDelete<unknown>(`${BASE_URL}${encodeURIComponent(notification.id)}/`);
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
      setUnreadCount((current) => Math.max(0, current - (notification.read_at ? 0 : 1)));
      setTotalCount((current) => Math.max(0, current - 1));
      signature.current = null; // le dernier élément a pu changer : le prochain pouls recharge proprement
    } catch {
      setHasError(true);
    } finally {
      setRemoving((current) => {
        const next = new Set(current);
        next.delete(notification.id);
        return next;
      });
    }
  }

  async function markAllAsRead() {
    if (bulkBusy || unreadCount === 0) return;
    setBulkBusy(true);
    const readAt = new Date().toISOString();
    try {
      await apiPost<unknown>(`${BASE_URL}read-all/`, {});
      setNotifications((current) => current.map((item) => item.read_at ? item : { ...item, read_at: readAt }));
      setUnreadCount(0);
      syncSignature(0, totalCount);
    } catch {
      setHasError(true);
    } finally {
      setBulkBusy(false);
    }
  }

  /** « Tout effacer » demande une seconde pression (4 s) : un geste involontaire ne vide pas la boîte. */
  async function clearAll() {
    if (bulkBusy || totalCount === 0) return;
    if (!confirmClear) {
      setConfirmClear(true);
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
      confirmTimer.current = window.setTimeout(() => setConfirmClear(false), CONFIRM_CLEAR_MS);
      return;
    }
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    setConfirmClear(false);
    setBulkBusy(true);
    try {
      await apiPost<unknown>(`${BASE_URL}clear/`, {});
      setNotifications([]);
      setUnreadCount(0);
      setTotalCount(0);
      signature.current = pulseSignature({ unread_count: 0, total_count: 0, latest_at: null });
    } catch {
      setHasError(true);
    } finally {
      setBulkBusy(false);
    }
  }

  const sorted = [...notifications].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  const activeTab: Tab = tab ?? (unreadCount > 0 ? "new" : "all");
  const latest = activeTab === "new" ? sorted.filter((item) => !item.read_at) : sorted;
  const truncated = totalCount > notifications.length;
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
          <div className="gm__item notification-bell__tabs" style={step()} role="tablist" aria-label="Filtrer les notifications">
            <button type="button" role="tab" id={`${panelId}-tab-new`} aria-selected={activeTab === "new"} aria-controls={`${panelId}-list`} className="notification-bell__tab" onClick={() => setTab("new")}>Les nouvelles{unreadCount > 0 && <span className="notification-bell__tab-count">{unreadCount}</span>}</button>
            <button type="button" role="tab" id={`${panelId}-tab-all`} aria-selected={activeTab === "all"} aria-controls={`${panelId}-list`} className="notification-bell__tab" onClick={() => setTab("all")}>Voir toutes{totalCount > 0 && <span className="notification-bell__tab-count is-muted">{totalCount}</span>}</button>
          </div>
          {!loaded && <p className="gm__item notification-bell__status" style={step()} role="status">Chargement des notifications…</p>}
          {loaded && latest.length === 0 && <p className="gm__item notification-bell__status" style={step()}>{activeTab === "new" ? "Aucune nouvelle notification." : "Vous n’avez pas encore de notification."}</p>}
          {latest.length > 0 && <ul className="notification-bell__list" id={`${panelId}-list`} role="tabpanel" aria-labelledby={`${panelId}-tab-${activeTab}`}>{latest.map((notification) => {
            const context = contextLink(notification.kind);
            const isMarking = marking.has(notification.id);
            const isRemoving = removing.has(notification.id);
            return <li className={`gm__item notification-bell__item${notification.read_at ? " is-read" : " is-unread"}`} style={step()} key={notification.id}>
              <div className="notification-bell__item-copy"><strong>{notification.title}</strong>{notification.body && <p>{notification.body}</p>}<time dateTime={notification.created_at}>{formatDate(notification.created_at)}</time></div>
              <div className="notification-bell__item-actions">
                <a href={context.href}>{context.label}</a>
                <span className="notification-bell__item-buttons">
                  {notification.read_at ? <span className="notification-bell__read-state">Lue</span> : <button type="button" onClick={() => void markAsRead(notification)} disabled={isMarking}>{isMarking ? "Marquage…" : "Marquer comme lue"}</button>}
                  <button type="button" className="notification-bell__delete" onClick={() => void removeOne(notification)} disabled={isRemoving} aria-label={`Effacer la notification « ${notification.title} »`}>{isRemoving ? "Effacement…" : "Effacer"}</button>
                </span>
              </div>
            </li>;
          })}</ul>}
          {truncated && activeTab === "all" && <p className="gm__item notification-bell__status" style={step()}>Les {notifications.length} plus récentes sur {totalCount}.</p>}
          {totalCount > 0 && <div className="gm__item notification-bell__toolbar" style={step()}>
            <button type="button" className="notification-bell__bulk" onClick={() => void markAllAsRead()} disabled={bulkBusy || unreadCount === 0}>Tout marquer comme lu</button>
            <button type="button" className={`notification-bell__bulk notification-bell__bulk--danger${confirmClear ? " is-confirming" : ""}`} onClick={() => void clearAll()} disabled={bulkBusy} aria-live="polite">{confirmClear ? "Confirmer : tout effacer" : "Tout effacer"}</button>
          </div>}
        </div>
      </div>
      <button ref={trigger} type="button" className="gm__trigger notification-bell__trigger" data-tour="notifications" aria-label={`Notifications : ${unreadLabel}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={panelId} onClick={() => void toggleOpen()}>
        <Icon name="bell" size={22} />
        <span className="notification-bell__label">Notifications</span>
        {unreadCount > 0 && <span className="notification-bell__badge" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
    </div>
  );
}
