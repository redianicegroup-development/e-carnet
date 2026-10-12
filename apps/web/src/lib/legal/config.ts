/**
 * Données des pages juridiques — AKATech Module 8 (mode juridique).
 *
 * Règles :
 * - `lastUpdated` et `version` sont des DONNÉES : jamais calculées au rendu (un redéploiement ne change pas la date).
 * - Aucune information légale n'est inventée. Toute valeur inconnue reste absente de FIELD_VALUES et s'affiche
 *   « [À COMPLÉTER PAR LE CLIENT : …] » dans la page tant qu'elle n'est pas renseignée.
 * - Pour renseigner une information : ajouter UNE ligne dans FIELD_VALUES (jamais dans les pages).
 * - Pour lever le bandeau « version provisoire » : LEGAL_REVIEW.status = "validated" APRÈS avis écrit d'un juriste
 *   ivoirien ; le test tests/legal.test.mjs refuse ce statut tant qu'un champ reste à compléter.
 */

export type LegalDocKey = "mentions" | "privacy" | "terms";

export const LEGAL_REVIEW: { status: "pending" | "validated"; reviewer: string | null; reviewedOn: string | null } = {
  status: "pending",
  reviewer: null,
  reviewedOn: null,
};

export const LEGAL_DOCS: Record<LegalDocKey, { path: string; title: string; short: string; version: string; lastUpdated: string }> = {
  mentions: { path: "/mentions-legales", title: "Mentions légales", short: "Mentions légales", version: "2026-10-11-v1", lastUpdated: "2026-10-11" },
  privacy: { path: "/confidentialite", title: "Politique de confidentialité", short: "Confidentialité", version: "2026-10-11-v1", lastUpdated: "2026-10-11" },
  terms: { path: "/cgu", title: "Conditions générales d’utilisation", short: "Conditions d’utilisation", version: "2026-10-11-v1", lastUpdated: "2026-10-11" },
};

/** Date ISO (aaaa-mm-jj) → « 10 octobre 2026 », en UTC pour un rendu identique serveur/navigateur. */
export function formatLegalDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/* ------------------------------------------------------------------------------------------------------------------
   Registre des champs à compléter : [groupe, libellé affiché dans « [À COMPLÉTER PAR LE CLIENT : libellé] »]
   ------------------------------------------------------------------------------------------------------------------ */
const FIELDS = {
  // Éditeur
  "publisher.name": ["Éditeur", "dénomination complète ou nom de l’éditeur"],
  "publisher.legalForm": ["Éditeur", "forme juridique (ou « personne physique »)"],
  "publisher.registration": ["Éditeur", "numéro d’immatriculation (RCCM ou équivalent)"],
  "publisher.address": ["Éditeur", "adresse du siège ou de l’éditeur"],
  "publisher.email": ["Éditeur", "adresse e-mail de contact"],
  "publisher.director": ["Éditeur", "nom et qualité du directeur ou de la directrice de publication"],
  "ip.holder": ["Éditeur", "titulaire des droits sur le service, le nom et le logo"],
  "ip.terms": ["Éditeur", "conditions d’utilisation du nom, du logo et des contenus"],
  // Hébergement (environnement de test actuel)
  "hosting.web.details": ["Hébergement", "adresse et contact officiels de l’hébergeur de l’interface web (Vercel)"],
  "hosting.api.details": ["Hébergement", "adresse et contact officiels de l’hébergeur de l’API (Render)"],
  "hosting.db.details": ["Hébergement", "adresse et contact officiels de l’hébergeur de la base de données (Neon)"],
  "hosting.web.region": ["Hébergement", "région effective d’hébergement de l’interface web"],
  "hosting.api.region": ["Hébergement", "région effective d’hébergement de l’API"],
  "hosting.db.region": ["Hébergement", "région effective de la base de données et de ses sauvegardes"],
  // Confidentialité
  "privacy.controller": ["Confidentialité", "identité et coordonnées du responsable du traitement"],
  "privacy.roles": ["Confidentialité", "rôle de chaque acteur (responsable, conjoint, sous-traitant) pour chaque traitement"],
  "privacy.dpoContact": ["Confidentialité", "adresse dédiée ou correspondant à la protection des données"],
  "privacy.legalBasis": ["Confidentialité", "base ou condition juridique de chaque finalité"],
  "privacy.formalities": ["Confidentialité", "formalités accomplies auprès de l’Autorité de protection"],
  "privacy.staffAccess": ["Confidentialité", "règles d’accès du personnel exploitant aux données"],
  "privacy.smtpProvider": ["Confidentialité", "prestataire d’envoi d’e-mails et lieu de traitement"],
  "privacy.hostLogs": ["Confidentialité", "contenu et durée des journaux techniques des hébergeurs"],
  "privacy.transfers": ["Confidentialité", "régime applicable aux transferts hors de Côte d’Ivoire et hors CEDEAO"],
  "retention.account": ["Conservation", "durée de conservation des données de compte"],
  "retention.health": ["Conservation", "durée de conservation des déclarations de santé et pré-consultations"],
  "retention.consultations": ["Conservation", "durée de conservation des consultations et attestations"],
  "retention.access": ["Conservation", "durée de conservation des autorisations d’accès et de leur preuve"],
  "retention.audit": ["Conservation", "durée de conservation du journal d’audit"],
  "retention.membership": ["Conservation", "durée de conservation des rattachements, invitations et codes"],
  "retention.proofs": ["Conservation", "durée de conservation des pièces justificatives de structure reçues par e-mail"],
  "retention.backups": ["Conservation", "durée de conservation des sauvegardes"],
  "retention.visits": ["Conservation", "durée de conservation des statistiques de visites (la commande de nettoyage prévoit 90 jours sans visite, mais rien ne la planifie)"],
  "privacy.rights": ["Confidentialité", "procédure d’exercice des droits (vérification d’identité, délais de réponse)"],
  "privacy.minors": ["Confidentialité", "règles applicables aux mineurs et aux représentants légaux"],
  "privacy.helper": ["Confidentialité", "règles applicables à une personne qui aide à la saisie dans le compte d’un patient"],
  "privacy.incident": ["Confidentialité", "procédure de gestion et de notification des incidents de sécurité"],
  // CGU
  "terms.acceptance": ["Conditions d’utilisation", "mécanisme d’acceptation des conditions (information, case à cocher, version, horodatage)"],
  "terms.publisherDuties": ["Conditions d’utilisation", "nature et étendue des obligations de l’éditeur"],
  "terms.liability": ["Conditions d’utilisation", "clauses de responsabilité (rédaction par un juriste)"],
  "terms.closure": ["Conditions d’utilisation", "modalités et effets de la clôture d’un compte sur les données"],
  "terms.court": ["Conditions d’utilisation", "juridiction compétente et règlement amiable des litiges"],
} as const satisfies Record<string, readonly [string, string]>;

export type FieldKey = keyof typeof FIELDS;

/** Renseigner ici, et nulle part ailleurs. Exemple : "publisher.name": "Société Exemple SARL". */
export const FIELD_VALUES: Partial<Record<FieldKey, string>> = {};

// Seule valeur issue de l'environnement : la même adresse que le bouton « Demander l'ouverture » (voir .env.example).
const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
if (contactEmail) FIELD_VALUES["publisher.email"] = contactEmail;

export const fieldLabel = (key: FieldKey): string => FIELDS[key][1];
export const fieldValue = (key: FieldKey): string | null => FIELD_VALUES[key]?.trim() || null;

/** Tous les champs encore à compléter, groupés, pour la Compliance Matrix et le test de publication. */
export function pendingFields(): { key: FieldKey; group: string; label: string }[] {
  return (Object.keys(FIELDS) as FieldKey[])
    .filter((key) => !fieldValue(key))
    .map((key) => ({ key, group: FIELDS[key][0], label: FIELDS[key][1] }));
}

/* ------------------------------------------------------------------------------------------------------------------
   Faits techniques issus du code (LEGAL DATA INPUT) — à re-vérifier à chaque changement de stack.
   Sources : apps/api/config/settings.py, apps/api/apps/<app>/models.py, render.yaml, docs/DEPLOYMENT.md.
   ------------------------------------------------------------------------------------------------------------------ */

/** Environnement d'essai actuel (V1/V2). Régions et contrats non établis : voir FIELDS « hosting.*.region ». */
export const HOSTS = [
  { id: "web", role: "Interface web", name: "Vercel", detailsKey: "hosting.web.details", regionKey: "hosting.web.region" },
  { id: "api", role: "API applicative", name: "Render", detailsKey: "hosting.api.details", regionKey: "hosting.api.region" },
  { id: "db", role: "Base de données PostgreSQL", name: "Neon", detailsKey: "hosting.db.details", regionKey: "hosting.db.region" },
] as const satisfies readonly { id: string; role: string; name: string; detailsKey: FieldKey; regionKey: FieldKey }[];

/** Durées de VALIDITÉ TECHNIQUE (et non de conservation) présentes dans le code et la documentation produit. */
export const TECH_VALIDITY = {
  session: "8 heures par défaut, renouvelées à chaque échange avec le serveur",
  qr: "5 minutes, usage unique",
  accessInitial: "2 heures",
  accessExtension: "2 prolongations d’une heure au plus",
  invitation: "48 heures, usage unique",
  joinCode: "48 heures, usage unique",
} as const;

/** Cookies déployés par l'application. `essential` : strictement nécessaire au fonctionnement (sinon : mesure de fréquentation). Aucun outil tiers ni publicité. */
export const COOKIES = [
  {
    name: "sessionid",
    essential: true,
    purpose: "Maintenir votre connexion et protéger le parcours de connexion avec un fournisseur d’identité.",
    duration: "8 heures par défaut, prolongées à chaque échange avec le serveur",
    attributes: "HttpOnly ; Secure ; SameSite=None en configuration de test (Lax en développement)",
  },
  {
    name: "csrftoken",
    essential: true,
    purpose: "Protéger les formulaires et les requêtes contre les envois non voulus (CSRF).",
    duration: "Durée par défaut du framework Django (52 semaines) : la configuration ne la modifie pas",
    attributes: "Secure ; SameSite=None en configuration de test ; lisible par le script de l’application (non HttpOnly)",
  },
  {
    name: "ecarnet_visitor",
    essential: false,
    purpose: "Mesurer la fréquentation du service : identifiant aléatoire de visiteur, sans lien avec un compte.",
    duration: "30 jours",
    attributes: "HttpOnly ; Secure ; SameSite=None en configuration de test (Lax en développement)",
  },
] as const;
