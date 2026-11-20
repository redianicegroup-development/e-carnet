"use client";

import { Children, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { PersonAvatar } from "./PersonAvatar";
import { ProfileSheet, type ProfileSheetProps } from "./ProfileSheet";
import "./profile.css";

export type ProfileStatus = { label: string; tone?: "ok" | "warn" | "off" };

export type ProfileProps = Omit<ProfileSheetProps, "onClose"> & {
  /** `tile` (par défaut) : la photo ronde et un nom court dessous, comme les dossiers patients. `photo` : la photo seule (équipe de l'établissement).
   *  `row` : photo, nom et une ligne d'état, avec une flèche. Les trois ouvrent la même fiche. */
  variant?: "tile" | "photo" | "row";
  size?: number;
  /** Texte court sous la photo (variante `tile`) : un prénom, le nom d'un établissement. À défaut, le nom complet. */
  label?: string;
  /** Pastille d'état posée sur la photo (variante `tile`) ; son texte est lu par les lecteurs d'écran, la fiche détaille l'état. */
  status?: ProfileStatus;
  /** Photo entourée d'un anneau plein : le profil choisi dans une liste de choix (« Pour qui est cette consultation ? »). */
  selected?: boolean;
  /** Ligne sous le nom dans la variante `row`. */
  meta?: string;
};

/* « Profil » : LE composant réutilisable des listes de personnes et d'établissements. Dans la liste on ne voit que la photo ronde (avec un nom court
   dessous) ; au toucher, la fiche complète s'ouvre en modal (ProfileSheet) avec les informations et les boutons d'action en bas.
   Les listes sont posées dans <ProfileGrid>. Pour une fiche ouverte depuis un autre déclencheur, utiliser directement ProfileSheet. */
export function Profile({ variant = "tile", size, meta, label, status, selected, ...sheet }: ProfileProps) {
  const [open, setOpen] = useState(false);
  const draw = (px: number) => (sheet.avatar ? sheet.avatar(px) : <PersonAvatar src={sheet.photo} name={sheet.name} size={px} />);
  const aria = `Voir la fiche de ${sheet.name}${status ? ` (${status.label})` : ""}${selected ? ", sélectionné" : ""}`;
  return (
    <>
      {variant === "tile" ? (
        <button type="button" className="profile-tile" data-selected={selected ? "true" : undefined} aria-haspopup="dialog" aria-label={aria} title={sheet.name} onClick={() => setOpen(true)}>
          <span className="profile-tile__photo">
            {draw(size ?? 64)}
            {status && <span className="profile-tile__dot" data-tone={status.tone ?? "ok"} aria-hidden="true" />}
            {selected && <span className="profile-tile__check" aria-hidden="true"><Icon name="check" size={14} /></span>}
          </span>
          <span className="profile-tile__name">{label ?? sheet.name}</span>
        </button>
      ) : variant === "photo" ? (
        <button type="button" className="profile-photo" aria-haspopup="dialog" aria-label={`Voir la fiche de ${sheet.name}`} title={sheet.name} onClick={() => setOpen(true)}>{draw(size ?? 64)}</button>
      ) : (
        <button type="button" className="profile-row" aria-haspopup="dialog" onClick={() => setOpen(true)}>
          {draw(size ?? 44)}
          <span className="profile-row__text"><strong>{sheet.name}</strong>{(meta ?? sheet.subtitle) && <small>{meta ?? sheet.subtitle}</small>}</span>
          <Icon name="chevron" size={18} />
        </button>
      )}
      {open && <ProfileSheet {...sheet} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Grille de tuiles : chaque enfant est un <Profile> (ou une autre tuile). Une grille = une liste, lue comme telle par les lecteurs d'écran.
 *  Children.toArray aplatit les tableaux imbriqués (le titulaire puis la liste des enfants) : chaque profil a SA case, jamais deux dans la même. */
export function ProfileGrid({ label, children }: { label: string; children: ReactNode }) {
  return <ul className="profile-tiles" aria-label={label}>{Children.toArray(children).map((child, index) => <li key={index}>{child}</li>)}</ul>;
}
