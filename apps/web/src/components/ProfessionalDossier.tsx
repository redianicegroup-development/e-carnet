"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet } from "../infrastructure/api/client";
import { AvatarBadge, displayName, type SpaceAccount } from "./shell/SpaceShell";
import type { ProfessionalProfile } from "./ClinicalGate";
import { EstablishmentLogo } from "./EstablishmentLogo";
import { useSealImage } from "./useSealImage";
import "./establishment-logo.css";
import "./ink-capture.css";
import "./professional-dossier.css";

type Credentials = { professional_identifier: string; stamp_uploaded: boolean; signature_uploaded: boolean };

/* « Dossier médecin » : tout ce que le médecin a déclaré, en un coup d'œil, à l'accueil. Lecture seule ; la modification se fait dans les paramètres. */
export function ProfessionalDossier({ account, profile }: { account: SpaceAccount; profile: ProfessionalProfile | null }) {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  useEffect(() => {
    let active = true;
    apiGet<Credentials>("/api/v1/professionals/credentials/").then((loaded) => { if (active) setCredentials(loaded); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  const stamp = useSealImage("stamp", Boolean(credentials?.stamp_uploaded));
  const signature = useSealImage("signature", Boolean(credentials?.signature_uploaded));
  const active = profile?.memberships.find((item) => item.establishment_id === profile.active_establishment && item.status === "active");
  const rows: [string, string][] = [
    ["Profession", profile?.professional_title || "À renseigner"],
    ["Spécialité", profile?.specialty || "À renseigner"],
    ["Identifiant professionnel", credentials?.professional_identifier || "Non renseigné"],
    ["E-mail de connexion", account.email],
  ];
  return <section className="card professional-dossier" aria-labelledby="dossier-title">
    <div className="professional-dossier__head">
      <AvatarBadge account={account} size={56} />
      <div><span className="eyebrow">Dossier médecin</span><h2 id="dossier-title">{displayName(account)}</h2></div>
    </div>
    <dl className="professional-dossier__list">
      {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      <div><dt>Établissement actif</dt><dd>{active ? <span className="professional-dossier__etab"><EstablishmentLogo logo={active.establishment_logo} name={active.establishment_name} size={28} />{active.establishment_name}</span> : "Aucun pour le moment"}</dd></div>
    </dl>
    <div className="professional-dossier__seals" aria-label="Cachet et signature">
      <div><span className="professional-dossier__label">Cachet</span>{credentials?.stamp_uploaded ? <div className="seal-preview">{stamp ? <img src={stamp} alt="Votre cachet" /> : <span>…</span>}</div> : <p className="muted">Non ajouté</p>}</div>
      <div><span className="professional-dossier__label">Signature</span>{credentials?.signature_uploaded ? <div className="seal-preview">{signature ? <img src={signature} alt="Votre signature" /> : <span>…</span>}</div> : <p className="muted">Non ajoutée</p>}</div>
    </div>
    <p className="muted professional-dossier__note">Informations déclarées par vous : Mon E‑Carnet ne les certifie pas, la vérification relève de l’établissement.</p>
    <div className="actions"><Link className="button" href="/professionnel/parametres">Modifier dans mes paramètres</Link></div>
  </section>;
}
