"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import "./password-field.css";

/* Champ mot de passe avec l'œil pour afficher / masquer ce qu'on tape. Un œil par champ : on peut vérifier le nouveau mot de passe
   sans dévoiler sa confirmation. */
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string; hint?: ReactNode };

export function PasswordField({ label, hint, id, ...input }: Props) {
  const [shown, setShown] = useState(false);
  return <label className="field password-field" htmlFor={id}>
    <span>{label}</span>
    <span className="password-field__control">
      <input {...input} id={id} type={shown ? "text" : "password"} spellCheck={false} autoCapitalize="none" autoCorrect="off" />
      <button type="button" className="password-field__eye" onClick={() => setShown((value) => !value)} aria-pressed={shown} aria-label={shown ? `Masquer : ${label}` : `Afficher : ${label}`} title={shown ? "Masquer" : "Afficher"}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="password-field__icon">
          <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {shown && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </span>
    {hint}
  </label>;
}
