"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BrandMark } from "../components/ui/BrandMark";

/* Après une mise en ligne, une page ouverte depuis longtemps peut réclamer un fichier qui n'existe plus : un simple
   rechargement suffit alors. On le dit clairement au lieu d'afficher un écran blanc. */
function isStaleBundle(error: Error) {
  return error.name === "ChunkLoadError" || /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(error.message);
}

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Rien de médical dans le journal : le message technique reste dans la console, la référence sert au support.
    console.error(error);
  }, [error]);
  const stale = isStaleBundle(error);
  return (
    <main className="shell onboarding-choice">
      <section className="hero-page" role="alert">
        <BrandMark />
        <span className="eyebrow">{stale ? "Nouvelle version disponible" : "Un problème est survenu"}</span>
        <h1>{stale ? "Mon E‑Carnet vient d’être mis à jour." : "Cette page n’a pas pu s’afficher."}</h1>
        <p className="lead">
          {stale
            ? "Rechargez la page pour continuer. Ce que vous avez enregistré est conservé."
            : "Vos informations sont en sécurité. Réessayez ; si le problème continue, revenez à l’accueil ou contactez l’équipe."}
        </p>
        <div className="actions">
          {stale
            ? <button className="button primary" type="button" onClick={() => window.location.reload()}>Recharger la page</button>
            : <button className="button primary" type="button" onClick={reset}>Réessayer</button>}
          <Link className="button" href="/patient">Aller à mon espace</Link>
        </div>
        {error.digest && <p className="muted">Référence à communiquer au support : <code>{error.digest}</code></p>}
      </section>
    </main>
  );
}
