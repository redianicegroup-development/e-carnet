# Sécurité, export Excel, ouverture de dossier, données réelles — 04/11/2026

Ce zip **remplace** `e-carnet_navigation-mobile_2026-11-03.zip` (il en contient tous les fichiers) et s'applique **après** `e-carnet_v1_5_fusion-hors-connexion_2026-11-03.zip`, par-dessus la racine du projet.

## ⚠️ À faire à la main
1. Supprimer `apps/web/src/components/public/PublicFooterScrollToTop.tsx` (remplacé par `ScrollToTopOnNavigate.tsx`, voir la note de navigation).
2. Réinstaller les dépendances : `npm ci` (Next.js 16.4.4) et, pour l'API, `pip install --require-hashes -r apps/api/requirements.txt` (`cryptography` 50.0.0).

## Ce qui change
- **Next.js 16.3.8 → 16.4.4** (`eslint-config-next` aussi) et **`cryptography` 47.0.0 → 50.0.0** (`requirements.in` : `>=50,<51` ; empreintes de `requirements.txt` prises sur PyPI, installation vérifiée avec `--require-hashes`, `pip check` propre). 50.0.2 existe : le correctif d'un cran reste possible.
- **Export Excel** : `URL_FORMAT_OVERRIDE: None` dans `settings.py`. Les 4 tests d'export, en échec depuis v1.4-final, passent.
- **Ouverture de dossier par l'administrateur d'établissement** : 30 minutes par défaut, 4 heures au plus, jamais illimitée ; les anciennes ouvertures sans échéance sont refusées ; lecture clinique **désactivée par défaut** (`ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ=true` pour l'activer, après validation A8 et création de l'écran, qui n'existe pas).
- **Données réelles** : un seul interrupteur, `apps/web/src/lib/data-policy.ts` (`REAL_HEALTH_DATA_ALLOWED = false`), lu par la FAQ de l'accueil, l'Aide, la politique de confidentialité et `/v1` : « phase de test, données fictives ». Détail, critères et marche à suivre : `docs/DONNEES-REELLES-DECISION.md`. Un test refuse de passer l'interrupteur à `true` tant que la copie hors connexion est active par défaut et non chiffrée.
- **Tests** : `tests/helpers/register-ts-resolver.mjs` (le script `npm test` l'importe : un module peut importer un autre sans extension), `donnees-reelles-2026-11-04.test.mjs` (7), `test_patient_records.py` (20, dont 4 nouveaux).

## Vérifications
API : 492 tests réussis (SQLite, variables de la CI), `manage.py check` sans erreur. Web : 292 tests, 289 réussis ; les 3 échecs (centre d'aide `/faq`, QR de visite, schémas) existaient déjà dans v1.4-final ; typage et ESLint des fichiers modifiés sans erreur. Non vérifié : `next build` (polices Google inaccessibles ici), essais sur téléphone réel.

## Constats non traités (voir `DONNEES-REELLES-DECISION.md`)
`zod` < 4.6.6 (`npm audit`, sévérité haute) ; migration `0025` manquante pour `FollowUpPlan.objective` (la CI échoue) ; documents médicaux chez Cloudinary ; copie hors connexion non chiffrée ; `ESLint` : 3 erreurs existantes (règles React Compiler : `AdminAuditJournal`, `EstablishmentKpis`, `PatientConsultations`).
