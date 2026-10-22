"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "../infrastructure/api/client";
import { ProfessionalCredentialsSettings, type Credentials } from "./ProfessionalCredentialsSettings";

/** Étape facultative de l'onboarding médecin : cachet et signature. « Passer » mène toujours à l'étape suivante (sécurité du compte). */
export function ProfessionalCredentialsOnboarding() {
  const router = useRouter();
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiGet<Credentials>("/api/v1/professionals/credentials/")
      .then((loaded) => { if (active) setCredentials(loaded); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Impossible de charger votre profil."); });
    return () => { active = false; };
  }, []);

  const next = () => router.push("/onboarding/securite");

  return <section className="card auth-form">
    {credentials
      ? <ProfessionalCredentialsSettings variant="onboarding" profile={credentials} onSaved={setCredentials} onDone={next} />
      : error
        ? <div className="stack"><h1>Cachet et signature</h1><p className="status" role="alert">{error}</p><div className="actions"><Link className="button" href="/professionnel/onboarding">Compléter mon profil</Link><button type="button" className="button primary" onClick={next}>Passer pour le moment</button></div></div>
        : <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /><i /></div>}
  </section>;
}
