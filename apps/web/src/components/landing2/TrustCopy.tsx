import Link from "next/link";

/** Généré depuis la maquette (confiance). */
export function TrustCopy() {
  return (
    <>
      <div className="lp2-rv">
        <h2 id="trust-title">Vous gardez la main sur chaque accès.</h2>
        <ul className="lp2-guards">
          <li>
            <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z" /><path d="M9 12l2.2 2.2L15 10" /></svg>
            {" "}
            Montrer votre QR, c’est donner votre accord
          </li>
          <li>
            <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
            {" "}
            Le contenu et la durée sont visibles
          </li>
          <li>
            <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            {" "}
            Vous pouvez y mettre fin, et chaque décision reste dans l’historique
          </li>
        </ul>
        <p>
          Essayez la démonstration : autorisez, puis révoquez l’accès.
          {" "}
          <Link href="/securite">Voir la page Sécurité</Link>
          .
        </p>
      </div>
    </>
  );
}
