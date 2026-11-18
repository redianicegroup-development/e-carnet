"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { PersonAvatar } from "./PersonAvatar";
import { ProfileSheet, type ProfileSheetProps } from "./ProfileSheet";
import "./profile.css";

export type ProfileProps = Omit<ProfileSheetProps, "onClose"> & {
  /** `photo` : la photo ronde seule (équipe de l'établissement). `row` : photo, nom et une ligne d'état, avec une flèche (liste de profils). */
  variant?: "photo" | "row";
  size?: number;
  /** Ligne sous le nom dans la variante `row`. */
  meta?: string;
};

/* « Profil » réutilisable : ce qu'on voit dans une liste (photo ronde ou ligne) et, au clic, la fiche complète (ProfileSheet) avec ses
   informations et ses boutons d'action en bas. Pour une fiche ouverte depuis un autre déclencheur (ligne de demande, carte…), utiliser
   directement ProfileSheet. */
export function Profile({ variant = "photo", size, meta, ...sheet }: ProfileProps) {
  const [open, setOpen] = useState(false);
  const draw = (px: number) => (sheet.avatar ? sheet.avatar(px) : <PersonAvatar src={sheet.photo} name={sheet.name} size={px} />);
  return (
    <>
      {variant === "photo" ? (
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
