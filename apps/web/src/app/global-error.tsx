"use client";

/* Dernier filet : l'erreur est survenue dans la mise en page racine, donc ni les feuilles de style ni les composants du site
   ne sont garantis. Mise en forme volontairement autonome. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "#FFF7E6", color: "#1f2937", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
        <main role="alert" style={{ maxWidth: 480 }}>
          <h1 style={{ fontSize: "1.4rem" }}>Mon E‑Carnet est momentanément indisponible.</h1>
          <p>Vos informations sont en sécurité. Rechargez la page dans un instant.</p>
          <button type="button" onClick={reset} style={{ minHeight: 48, padding: "0 22px", borderRadius: 14, border: "1.5px solid #1f2937", background: "#fff", font: "inherit", fontWeight: 700, cursor: "pointer" }}>Réessayer</button>
          {error.digest && <p style={{ fontSize: ".85rem", opacity: .7 }}>Référence : {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
