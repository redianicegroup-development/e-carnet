> **Référence d’état auditée le 05/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`ETAT-REEL-PROJET-2026-11-05.md`](ETAT-REEL-PROJET-2026-11-05.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# Décision « données de santé réelles » — état au 04/11/2026

**Verdict affiché par le code : NON.** Mon E-Carnet est en phase de test, données fictives uniquement. Tous les textes publics (FAQ de l'accueil, Aide, politique de confidentialité, page `/v1`) lisent **un seul interrupteur** : `REAL_HEALTH_DATA_ALLOWED` dans `apps/web/src/lib/data-policy.ts` (`false`). Le NO-GO de `GO-NO-GO-2026-10-05.md` est donc respecté partout.

## Pourquoi le code seul ne décide pas
Le code est une condition nécessaire, pas suffisante : la plupart des portes du NO-GO ne se vérifient pas dans le dépôt (hébergement, restauration réelle, validations signées, cadre ARTCI). Avant le 04/11, la FAQ, l'Aide et la politique de confidentialité affirmaient l'inverse (« en production interne, de vraies informations de santé peuvent être saisies » ; « la production interne traite déjà de vraies données de santé ») : écart n° 1 du CDC v13. **Question à trancher par le responsable produit :** des données réelles ont-elles déjà été saisies en production ? Si oui, arrêter la saisie et traiter la question ARTCI avant toute autre chose.

## Portes vérifiables dans le code (état au 04/11/2026)
| Porte | État | Preuve |
|---|---|---|
| Dépendances web à jour | Fait | Next.js **16.4.4** (au lieu de 16.3.8, vulnérable), `eslint-config-next` 16.4.4 |
| Dépendances API à jour | Fait | `cryptography` **50.0.0** (empreintes vérifiées, `pip check` propre) |
| Dépendance restante | **À traiter** | `npm audit` (production) : `zod` < 4.6.6, sévérité haute (mémoire épuisée sur collections surdimensionnées, GHSA-mrhx-c7xc-m3w5). Le projet utilise zod 3.25 ; la correction passe par zod 4 (changement majeur) |
| Export Excel du carnet | Fait | `URL_FORMAT_OVERRIDE: None` ; les 4 tests d'export, en échec depuis v1.4-final, passent |
| Ouverture de dossier par l'administrateur d'établissement | Fait côté API | Durée **indéterminée par défaut** : jusqu’à clôture du motif ; une expiration positive reste configurable, plafonnée à 4 h ; lecture clinique **désactivée par défaut** (`ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ=true` pour l'activer) |
| Écran d'ouverture de dossier | **Absent** | L'accès n'existe que par l'API ; à construire (motif, état jusqu'à clôture, historique) avant d'activer la lecture |
| Copie hors connexion des déclarations | **Non chiffrée, active par défaut** | `OFFLINE_DECLARATIONS_DEFAULT_ENABLED = true`, IndexedDB en clair. Acceptable avec des données fictives ; **bloquant** avec de vraies données. Un test refuse `REAL_HEALTH_DATA_ALLOWED = true` tant que ces deux conditions persistent |
| Double authentification (équipe, professionnels) | Absente — **décision : pas pour le moment** | À reconsidérer avant les données réelles |
| Documents médicaux | **Stockage tiers** | Les téléversements passent par Cloudinary (`apps/cloudinary_storage.py`, livraison privée) : « bloquant CDC avant données réelles » ; migrer vers un stockage privé ou obtenir une décision écrite |
| Migrations | **À corriger** | `makemigrations --check` échoue (champ `objective` de `FollowUpPlan`, migration `0025` manquante) alors que la CI le lance |
| Tests | API : 492 réussis. Web : 3 échecs hérités de v1.4 (centre d'aide `/faq`, QR de visite, schémas) | |

## Portes hors code (toujours ouvertes)
Staging PostgreSQL 16 et restauration avec RPO/RTO approuvé ; hébergement ivoirien confirmé (A13) ; cadre ARTCI et validation juridique (A1–A16, dont A8 : base légale de la lecture clinique par l'administrateur) ; validation médicale ; recette staging CA-01 à CA-24 signée ; essais mobiles Android/4G et iOS avec QR réel ; audit WCAG 2.2 AA ; SMTP et OAuth de staging.

## Comment lever le NO-GO (le jour venu)
1. Faire signer les portes ci-dessus (produit, médical, juridique, sécurité, hébergement) et dater la décision ici.
2. Traiter les points « À traiter / Absent / Non chiffrée » du tableau, au minimum : copie hors connexion (désactivée par défaut **ou** chiffrée avec un code de l'utilisateur), documents médicaux, zod, migration, écran d'ouverture si la lecture par l'administrateur est activée.
3. Passer `REAL_HEALTH_DATA_ALLOWED` à `true` dans `lib/data-policy.ts` : FAQ, Aide, confidentialité et `/v1` changent ensemble. Les tests dans `tests/donnees-reelles-2026-11-04.test.mjs` échouent tant que le garde-fou sur la copie hors connexion n'est pas levé.
4. Mettre à jour le CDC et le reste-à-faire, et publier la notice validée.

## Réglages API de cette décision
| Variable | Défaut | Effet |
|---|---|---|
| `ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ` | `false` | `true` autorise l'ouverture et la lecture du contenu clinique par l'administrateur d'établissement |
| `ECARNET_RECORD_OPENING_TTL_MINUTES` | `0` | `0` = jusqu'à clôture du motif ; valeur positive = expiration optionnelle, plafond 240 |
