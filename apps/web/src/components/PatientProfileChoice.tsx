"use client";

import { CHILD_LABEL, HOLDER_LABEL, profileName, selectProfile } from "../lib/patient-profiles";
import { Profile, ProfileGrid } from "./ui/Profile";
import { useSpaceAccount } from "./shell/SpaceShell";
import { usePatientProfiles } from "./usePatientProfiles";
import "./patient-profiles.css";

/* « Pour qui ? » en tête d'une consultation ou d'une pré-consultation : soi-même (le titulaire) ou l'un des profils d'enfants du compte.
   Chaque profil est une photo ronde (composant « Profil », comme partout) ; le profil choisi porte un anneau plein et une coche. Un toucher ouvre sa fiche,
   avec le bouton « Choisir pour cette consultation » : choisir un profil l'ouvre (même mécanisme que la flèche des paramètres), donc la pré-consultation
   et l'accès temporaire qui suivent sont ceux de ce profil. Rien ne s'affiche tant que le compte n'a aucun profil d'enfant. */
export function PatientProfileChoice() {
  const { usable, active, ready } = usePatientProfiles();
  const account = useSpaceAccount();
  if (!ready || usable.length === 0) return null;

  // Une erreur est relancée : la fiche affiche le motif.
  async function choose(patientId: string | null) {
    if ((active?.patient_id ?? null) === patientId) return;
    await selectProfile(patientId);
  }

  const holderName = account ? [account.first_name, account.last_name].filter(Boolean).join(" ") || "Moi" : "Moi";
  return (
    <fieldset className="profile-choice" data-tour="profile-choice">
      <legend>Pour qui est cette consultation ?</legend>
      <ProfileGrid label="Pour qui est cette consultation ?">
        <Profile
          name={holderName}
          label={account?.first_name || "Moi"}
          photo={account?.avatar_url}
          subtitle={HOLDER_LABEL}
          selected={!active}
          rows={[{ label: "Compte", value: HOLDER_LABEL }]}
          note={!active ? "Cette consultation est pour vous." : "Choisissez ce profil pour préparer votre propre consultation."}
          actions={!active ? [] : [{ label: "Choisir pour cette consultation", tone: "primary", onClick: async ({ close }) => { await choose(null); close(); } }]}
        />
        {usable.map((profile) => {
          const selected = profile.patient_id === active?.patient_id;
          return (
            <Profile
              key={profile.patient_id}
              name={profileName(profile)}
              label={profile.first_name}
              photo={profile.avatar_url}
              subtitle={CHILD_LABEL}
              selected={selected}
              rows={[{ label: "Compte", value: CHILD_LABEL }, ...(profile.birth_date ? [{ label: "Né(e) le", value: new Date(`${profile.birth_date.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR") }] : [])]}
              note={selected ? "Cette consultation est pour ce profil." : "Choisissez ce profil pour préparer sa consultation : son dossier est distinct du vôtre."}
              actions={selected ? [] : [{ label: "Choisir pour cette consultation", tone: "primary", onClick: async ({ close }) => { await choose(profile.patient_id); close(); } }]}
            />
          );
        })}
      </ProfileGrid>
    </fieldset>
  );
}
