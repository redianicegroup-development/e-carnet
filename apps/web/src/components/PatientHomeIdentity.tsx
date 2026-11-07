"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "../infrastructure/api/client";
import type { SpaceAccount } from "./shell/SpaceShell";
import { DossierCard, DossierRows, type DossierRow, type DossierTile } from "./DossierCard";
import { emergencyCardProfessionLabel } from "./emergency-card/EmergencyCardVisual";
import { useOwnProfession } from "./emergency-card/useEmergencyCard";
import { ageLabel } from "../lib/age";
import "./patient-sections.css";

type Profile = { first_name: string; last_name: string; birth_date: string | null; gender: string; phone: string; address: string; coverage_provider: string; coverage_number: string; coverage_expiry: string | null };
type Declaration = { id: string; kind: string; label: string; details: string; provenance?: { label: string } };
const GENDERS: Record<string, string> = { female: "Femme", male: "Homme", other: "Autre", prefer_not_to_say: "Préfère ne pas préciser" };
const KIND_LABELS: Record<string, string> = { allergy: "Allergie", antecedent: "Antécédent", treatment: "Traitement", blood_group: "Groupe sanguin", city: "Ville", emergency_contact: "Contact d’urgence", height: "Taille", weight: "Poids" };

/* « Dossier patient » : même présentation que le « Dossier médecin » (composant DossierCard : photo, nom en titre, informations en lignes ; lecture seule, on modifie dans les paramètres).
   Les informations restent celles du dossier patient : âge, genre, ville, téléphone, adresse, couverture santé, puis les autres déclarations avec leur provenance.
   Un SEUL bloc d'accueil : photo, nom, puis identité, couverture et déclarations dans la même carte (`unified`). La carte virtuelle et son QR se gèrent dans Moi (paramètres). */
export function PatientHomeIdentity({ account }: { account: SpaceAccount }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [declarations, setDeclarations] = useState<Declaration[] | null>(null);
  const [profileMessage, setProfileMessage] = useState("");
  const profession = useOwnProfession(account);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiGet<Profile>("/api/v1/patient/profile/"),
      apiGet<Declaration[]>("/api/v1/patient/declarations/"),
    ]).then(([nextProfile, nextDeclarations]) => {
      if (active) { setProfile(nextProfile); setDeclarations(nextDeclarations); }
    }).catch((error: unknown) => {
      if (active) setProfileMessage(error instanceof Error ? error.message : "Informations du profil indisponibles.");
    });
    return () => { active = false; };
  }, []);

  const city = declarations?.find((item) => item.kind === "city")?.label ?? "";
  const age = ageLabel(profile?.birth_date);
  const declared = (declarations ?? []).filter((item) => item.kind !== "city");
  const role = emergencyCardProfessionLabel(profession);
  const identityRows: DossierRow[] = [
    { label: "Âge", value: age || "Non renseigné" },
    { label: "Genre déclaré", value: profile?.gender ? GENDERS[profile.gender] ?? profile.gender : "Non renseigné" },
    { label: "Ville", value: city || "Non renseignée" },
    ...(profile?.phone ? [{ label: "Téléphone", value: profile.phone }] : []),
    ...(profile?.address ? [{ label: "Adresse", value: profile.address, wide: true }] : []),
  ];
  const coverageRows: DossierRow[] = [
    ...(profile?.coverage_provider ? [{ label: "Organisme", value: profile.coverage_provider }] : []),
    ...(profile?.coverage_number ? [{ label: "Numéro", value: profile.coverage_number }] : []),
    ...(profile?.coverage_expiry ? [{ label: "Expiration", value: new Date(`${profile.coverage_expiry.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR") }] : []),
  ];
  const declaredRows: DossierRow[] = declared.map((item) => ({
    label: KIND_LABELS[item.kind] ?? item.kind,
    value: <>
      <span>{item.label}{item.kind === "height" ? " cm" : item.kind === "weight" ? " kg" : ""}</span>
      {item.details && <small className="dossier__details">{item.details}</small>}
      <span className="badge declared">{item.provenance?.label ?? "Déclaré par vous"}</span>
    </>,
  }));
  // Rubriques du dossier, dans l'ordre : identité, couverture, autres déclarations. Les champs sont ceux du dossier patient d'origine.
  const tiles: DossierTile[] = [
    { key: "identity", title: "Identité et contact", icon: "user", hint: "Âge, genre, ville", content: <DossierRows rows={identityRows} /> },
    ...(coverageRows.length > 0 ? [{ key: "coverage", title: "Couverture santé", icon: "shield" as const, hint: "Organisme, numéro", content: <DossierRows rows={coverageRows} /> }] : []),
    { key: "declared", title: "Mes autres déclarations", icon: "pencil", hint: "Allergies, antécédents…", content: declarations === null ? <p className="muted">Chargement des déclarations…</p> : declared.length === 0 ? <p className="muted">Aucune autre déclaration enregistrée pour le moment.</p> : <DossierRows rows={declaredRows} /> },
  ];

  return <DossierCard
    account={account} eyebrow="Dossier patient" titleId="home-profile-title" role={role || undefined} sections={tiles} unified className="patient-dossier"
    note="Informations déclarées par vous : Mon E‑Carnet ne les certifie pas."
    actions={<><Link className="button" href="/patient/parametres">Modifier mon profil</Link><Link className="button" href="/patient/carnet">Gérer mes déclarations</Link></>}
  >
    {profileMessage && <p className="notice" role="status">{profileMessage}</p>}
  </DossierCard>;
}
