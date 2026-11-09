import { RoleCta } from "./RoleCta";

/** Généré depuis la maquette (rôles) ; les boutons viennent de PROFILES (liens, suivi, objet du contact). */
export function RoleCards() {
  return (
    <>
      <div className="lp2-head lp2-rv">
        <span className="lp2-eyebrow">Pour chaque rôle</span>
        <h2 id="roles-title">Un espace adapté à chacun</h2>
      </div>
      <div className="lp2-roles">
        <article className="lp2-role lp2-lead-card lp2-rv">
          <span className="lp2-orb">
            <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>
          </span>
          <p className="lp2-label">Patients</p>
          <h3>Votre santé, organisée</h3>
          <ul>
            <li>
              <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
              {" "}
              Préparez vos consultations
            </li>
            <li>
              <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
              {" "}
              Gardez la maîtrise des accès
            </li>
          </ul>
          <RoleCta index={0} />
        </article>
        <article className="lp2-role lp2-rv">
          <span className="lp2-orb lp2-g">
            <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v6a4 4 0 0 0 8 0V4" /><circle cx="18" cy="16" r="3" /><path d="M14 10v2a4 4 0 0 0 1.2 2.9" /></svg>
          </span>
          <p className="lp2-label">Professionnels</p>
          <h3>Un accès patient par patient</h3>
          <ul>
            <li>
              <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
              {" "}
              Demandez une autorisation
            </li>
            <li>
              <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
              {" "}
              Consultez selon le périmètre accordé
            </li>
          </ul>
          <RoleCta index={1} />
        </article>
        <article className="lp2-role lp2-rv">
          <span className="lp2-orb">
            <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V5h9v15M14 10h5v10M3 20h18" /><path d="M8 9h3M8 13h3M8 17h3" /></svg>
          </span>
          <p className="lp2-label">Établissements</p>
          <h3>Gérez vos rattachements</h3>
          <ul>
            <li>
              <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
              {" "}
              Invitez les professionnels
            </li>
            <li>
              <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
              {" "}
              Traitez les demandes de rattachement
            </li>
          </ul>
          <RoleCta index={2} />
        </article>
      </div>
    </>
  );
}
