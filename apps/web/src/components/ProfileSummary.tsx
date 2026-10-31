"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { apiGet } from "../infrastructure/api/client";
import { ageLabel } from "../lib/age";
import { useEmergencyCard } from "./emergency-card/useEmergencyCard";
import { Icon } from "./ui/Icon";
import "./profile-summary.css";

export type ProfileStat = { label: string; value: string };

/* En-tête de « Moi » (patient, professionnel, établissement), comme la maquette : photo, nom en titre, trois repères (valeur en gras,
   libellé dessous), puis une barre d'état. Lecture seule : on modifie dans les sections juste en dessous. */
export function ProfileSummary({ avatar, eyebrow, name, stats, bar, children }: { avatar: ReactNode; eyebrow: string; name: string; stats: ProfileStat[]; bar?: ReactNode; children?: ReactNode }) {
  return (
    <section className="card profile-card" aria-label={eyebrow}>
      <div className="profile-card__head">
        {avatar}
        <div className="profile-card__id">
          <span className="eyebrow">{eyebrow}</span>
          <h2>{name}</h2>
          {stats.length > 0 && <dl className="profile-card__stats">{stats.map((stat) => <div key={stat.label}><dd>{stat.value || "—"}</dd><dt>{stat.label}</dt></div>)}</dl>}
        </div>
      </div>
      {bar && <div className="profile-card__bar">{bar}</div>}
      {children}
    </section>
  );
}

const GENDERS: Record<string, string> = { female: "Femme", male: "Homme", other: "Autre", prefer_not_to_say: "Non précisé" };

/** Repères du patient : genre, âge, naissance ; barre : la carte virtuelle et l'état de son QR. */
export function usePatientStats(): ProfileStat[] {
  const [profile, setProfile] = useState<{ birth_date: string | null; gender: string } | null>(null);
  useEffect(() => {
    let active = true;
    apiGet<{ birth_date: string | null; gender: string }>("/api/v1/patient/profile/").then((data) => { if (active) setProfile(data); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  const birth = profile?.birth_date ? new Date(`${profile.birth_date.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR") : "";
  return [
    { label: "Genre", value: profile?.gender ? GENDERS[profile.gender] ?? profile.gender : "" },
    { label: "Âge", value: ageLabel(profile?.birth_date) },
    { label: "Naissance", value: birth },
  ];
}

/** Barre « Carte virtuelle » : état du QR, lien vers la carte (accueil patient). */
export function CardBar({ href, label = "Carte virtuelle" }: { href: string; label?: string }) {
  const { card, loading } = useEmergencyCard();
  const state = loading ? "…" : card.qr_enabled ? "QR actif" : "QR désactivé";
  return <><Icon name="idcard" size={18} /><span>{label} · {state}</span><Link href={href}>Voir</Link></>;
}
