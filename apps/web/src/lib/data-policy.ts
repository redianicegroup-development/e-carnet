/**
 * Décision « données de santé réelles » : UN seul interrupteur pour tous les textes publics (FAQ de l'accueil, Aide, politique de
 * confidentialité, page /v1). Tant qu'il est à `false`, Mon E-Carnet est en phase de test : données fictives uniquement, conformément au
 * NO-GO documenté (docs/GO-NO-GO-2026-10-05.md, docs/DONNEES-REELLES-DECISION.md).
 *
 * Ne le passer à `true` qu'après la décision écrite et signée (produit, médicale, juridique/ARTCI, sécurité, hébergement, recette
 * staging et restauration). Le code seul ne suffit pas : ces conditions ne se vérifient pas dans le dépôt. Les tests refusent aussi la
 * combinaison « données réelles autorisées + copie hors connexion activée par défaut et non chiffrée ».
 * Sans dépendance (testable en Node).
 */
export const REAL_HEALTH_DATA_ALLOWED = false;

export type DataPolicyText = {
  /** Nom de l'environnement dans la liste des prestataires. */
  environmentLabel: string;
  faq: { q: string; a: string };
  providersNote: string;
  inputNote: string;
  hostingNote: string;
  /** Périmètre affiché sur la page /v1 (liste de garanties). */
  v1Scope: string;
};

export function dataPolicy(realDataAllowed: boolean): DataPolicyText {
  const nurse = "L’infirmier n’a pas de compte : la pré-consultation se fait dans l’espace du patient. Le service n’est pas ouvert au grand public.";
  if (realDataAllowed) {
    return {
      environmentLabel: "environnement de production interne",
      faq: { q: "Puis-je saisir mes vraies données de santé ?", a: `Oui. En production interne, de vraies informations de santé peuvent être saisies dans l’espace du patient. ${nurse}` },
      providersNote: "Cet environnement accepte de vraies informations de santé ; les services susceptibles de les traiter, leurs régions et leurs accès doivent donc rester documentés et vérifiés.",
      inputNote: "La production interne accepte la saisie de vraies informations de santé. Les prestataires listés peuvent traiter les données nécessaires à leur rôle dans le service ; les régions, copies de sauvegarde et modalités d’accès d’assistance ne sont pas toutes confirmées.",
      hostingNote: "Un hébergement en Côte d’Ivoire est à l’étude. Comme la production interne traite déjà de vraies données de santé, les régions d’hébergement, les copies, les journaux et les accès d’assistance doivent être confirmés pour chaque prestataire ; le service n’est pas ouvert au grand public.",
      v1Scope: "Isolation stricte entre établissements",
    };
  }
  return {
    environmentLabel: "environnement du service",
    faq: { q: "Puis-je saisir mes vraies données de santé ?", a: `Pas encore. Mon E-Carnet est en phase de test : saisissez uniquement des données fictives. Les données de santé réelles ne seront acceptées qu’après les validations juridique, médicale, de sécurité et d’hébergement . ${nurse}` },
    providersNote: "Pendant la phase de test, ne saisissez que des données fictives : aucune donnée de santé réelle n’est attendue. Ces prestataires sont listés dès maintenant pour que leurs régions et leurs accès soient documentés et vérifiés avant toute ouverture aux données réelles.",
    inputNote: "Le service est en phase de test : la saisie de données de santé réelles n’est pas autorisée à ce stade. Les prestataires listés peuvent traiter les données nécessaires à leur rôle dans le service ; les régions, copies de sauvegarde et modalités d’accès d’assistance ne sont pas toutes confirmées, ce qui est l’une des conditions de l’ouverture aux données réelles.",
    hostingNote: "Un hébergement en Côte d’Ivoire est à l’étude. Avant toute ouverture aux données de santé réelles, les régions d’hébergement, les copies, les journaux et les accès d’assistance doivent être confirmés pour chaque prestataire ; le service n’est pas ouvert au grand public.",
    v1Scope: "Isolation stricte entre établissements et données fictives uniquement",
  };
}

export const DATA_POLICY = dataPolicy(REAL_HEALTH_DATA_ALLOWED);
