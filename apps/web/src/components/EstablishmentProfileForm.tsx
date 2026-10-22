"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiGet } from "../infrastructure/api/client";
import { googleLinkUrl, shouldAutoLinkGoogle, type LinkableAccount } from "../lib/google-link";
import { BrandMark } from "./ui/BrandMark";
import { EstablishmentProfileEditor } from "./EstablishmentProfileEditor";

const next = "/connexion?next=%2Fetablissement%2Ffiche";

/* Fiche de l'établissement : étape d'onboarding après l'activation, puis page de modification.
   Le nom arrive pré‑rempli (vérifié par l'équipe) et se modifie ; le logo, la ville et le téléphone se renseignent ; l'adresse / BP est
   facultative ; l'e‑mail est celui du compte, verrouillé. Les règles vivent dans EstablishmentProfileEditor. */
export function EstablishmentProfileForm() {
  const router = useRouter();
  const [wasComplete, setWasComplete] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <main className="auth-shell">
      <section className="card auth-form establishment-profile" aria-labelledby="profile-title">
        <span className="brand"><BrandMark /></span>
        <span className="eyebrow">{wasComplete ? "Fiche de l’établissement" : "Dernière étape"}</span>
        <h1 id="profile-title">{wasComplete ? "Modifier la fiche de votre établissement" : "Complétez la fiche de votre établissement"}</h1>
        <p className="muted">Ces informations aident les médecins à reconnaître votre structure. Tant que le type, la ville et le téléphone ne sont pas renseignés, vous ne pouvez pas créer de code de rattachement.</p>
        <EstablishmentProfileEditor
          scope="all"
          submitLabel={wasComplete ? "Enregistrer les modifications" : "Enregistrer et accéder à mon espace"}
          onLoaded={(profile) => setWasComplete(profile.profile_complete)}
          onUnauthorized={() => router.replace(next)}
          onSaved={async (saved, completeBefore) => {
            if (completeBefore || !saved.profile_complete) return;
            setMessage("Fiche enregistrée. Dernière étape : sécuriser votre compte…");
            // Même enchaînement que les autres rôles : la récupération du compte vient après l'onboarding, sauf si elle existe déjà.
            const account = await apiGet<LinkableAccount & { recovery_configured?: boolean }>("/api/v1/identity/me/").catch(() => null);
            const after = account && !account.recovery_configured ? "/onboarding/securite" : "/etablissement";
            // Fiche remplie et compte connecté : on lie le compte Google qui porte la même adresse (le serveur vérifie qu'elle est identique).
            const providers = await apiGet<{ google?: boolean }>("/api/v1/identity/oauth/providers/").catch(() => null);
            if (shouldAutoLinkGoogle(account, Boolean(providers?.google))) {
              setMessage("Fiche enregistrée. Liaison de votre adresse Gmail avec Google…");
              window.location.assign(googleLinkUrl(after));
              return;
            }
            router.push(after);
          }}
          footer={wasComplete ? <Link className="button" href="/etablissement/parametres">Retour aux paramètres</Link> : null}
        />
        <p className="notice" role="status" aria-live="polite" hidden={!message}>{message}</p>
      </section>
    </main>
  );
}
