"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { CHILD_LABEL, HOLDER_LABEL, profileInitials, profileName, selectProfile, type PatientProfileEntry } from "../lib/patient-profiles";
import { Icon } from "./ui/Icon";
import "./patient-profiles.css";

/* Flèche à côté de la pastille « Compte patient » / « Compte enfant » : ouvre la liste des profils du compte (le titulaire, puis chaque enfant).
   Choisir un profil le rend actif côté serveur et prévient l'application, qui recharge alors le contenu de ce profil.
   Menu à choix unique (role="menu" + menuitemradio) : flèches haut/bas pour naviguer, Échap pour fermer. */
export function PatientProfileSwitcher({ holderName, holderInitials, profiles, active, onError }: { holderName: string; holderInitials: string; profiles: PatientProfileEntry[]; active: PatientProfileEntry | null; onError?: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // Le menu est ancré à gauche de la pastille : sur un petit écran il déborderait à droite, on le ramène dans la fenêtre (marge de 16 px).
  useLayoutEffect(() => {
    if (!open) return;
    const menu = root.current?.querySelector<HTMLElement>(".profile-menu");
    if (!menu) return;
    menu.style.left = "0px";
    const overflow = menu.getBoundingClientRect().right - (window.innerWidth - 16);
    if (overflow > 0) menu.style.left = `${-overflow}px`;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const items = () => Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
    (items().find((item) => item.getAttribute("aria-checked") === "true") ?? items()[0])?.focus();
    const onPointerDown = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") { event.stopPropagation(); setOpen(false); button.current?.focus(); return; }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
    event.preventDefault();
    items[next]?.focus();
  }

  async function choose(patientId: string | null) {
    if (busy) return;
    if ((active?.patient_id ?? null) === patientId) { setOpen(false); return; }
    setBusy(true);
    try {
      await selectProfile(patientId);
      setOpen(false);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Impossible de changer de profil pour le moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="profile-switch" ref={root} onKeyDown={onKeyDown}>
      <button ref={button} type="button" className="profile-switch__button" aria-label="Changer de profil" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => setOpen((value) => !value)}>
        <Icon name="chevron" size={16} />
      </button>
      {open && (
        <ul id={menuId} className="profile-menu" role="menu" aria-label="Profils du compte">
          <li role="none">
            <button type="button" role="menuitemradio" aria-checked={!active} className="profile-menu__item" disabled={busy} onClick={() => void choose(null)}>
              <span className="profile-menu__avatar" aria-hidden="true">{holderInitials}</span>
              <span className="profile-menu__text"><strong>{holderName}</strong><small>{HOLDER_LABEL}</small></span>
              {!active && <Icon name="check" size={18} />}
            </button>
          </li>
          {profiles.map((profile) => (
            <li role="none" key={profile.patient_id}>
              <button type="button" role="menuitemradio" aria-checked={profile.patient_id === active?.patient_id} className="profile-menu__item" disabled={busy} onClick={() => void choose(profile.patient_id)}>
                <span className="profile-menu__avatar" aria-hidden="true">{profileInitials(profile)}</span>
                <span className="profile-menu__text"><strong>{profileName(profile)}</strong><small>{CHILD_LABEL}</small></span>
                {profile.patient_id === active?.patient_id && <Icon name="check" size={18} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
