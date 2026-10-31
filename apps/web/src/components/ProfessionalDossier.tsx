"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet } from "../infrastructure/api/client";
import type { SpaceAccount } from "./shell/SpaceShell";
import { DossierCard, DossierRows, type DossierRow, type DossierTile } from "./DossierCard";
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
  const profileRows: DossierRow[] = [
    { label: "Profession", value: profile?.professional_title || "À renseigner" },
    { label: "Spécialité", value: profile?.specialty || "À renseigner" },
    { label: "Identifiant professionnel", value: credentials?.professional_identifier || "Non renseigné" },
    { label: "E-mail de connexion", value: account.email, wide: true },
  ];
  const role = profile?.professional_title ? [profile.professional_title, profile.specialty].filter(Boolean).join(" · ") : undefined;
  const tiles: DossierTile[] = [
    { key: "profile", title: "Profil professionnel", icon: "stethoscope", hint: "Profession, spécialité", content: <DossierRows rows={profileRows} /> },
    { key: "establishment", title: "Établissement actif", icon: "building", hint: active ? active.establishment_name : "Aucun pour le moment", content: active ? <span className="professional-dossier__etab"><EstablishmentLogo logo={active.establishment_logo} name={active.establishment_name} size={28} />{active.establishment_name}</span> : <p className="muted">Aucun établissement actif pour le moment.</p> },
    { key: "seals", title: "Cachet et signature", icon: "pencil", hint: "Pour vos ordonnances", content: <div className="professional-dossier__seals" aria-label="Cachet et signature">
      <div><span className="dossier__label">Cachet</span>{credentials?.stamp_uploaded ? <div className="seal-preview">{stamp ? <img src={stamp} alt="Votre cachet" /> : <span>…</span>}</div> : <p className="muted">Non ajouté</p>}</div>
      <div><span className="dossier__label">Signature</span>{credentials?.signature_uploaded ? <div className="seal-preview">{signature ? <img src={signature} alt="Votre signature" /> : <span>…</span>}</div> : <p className="muted">Non ajoutée</p>}</div>
    </div> },
  ];
  return <DossierCard
    account={account} eyebrow="Dossier médecin" titleId="dossier-title" role={role} tiles={tiles} className="professional-dossier"
    note="Informations déclarées par vous : Mon E‑Carnet ne les certifie pas, la vérification relève de l’établissement."
    actions={<Link className="button" href="/professionnel/parametres">Modifier dans mes paramètres</Link>}
  />;
}
