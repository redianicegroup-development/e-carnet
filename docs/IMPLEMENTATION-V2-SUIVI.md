# Implémentation V2 — prévention et suivi quotidien

## Incrément livré

Cette tranche implémente le premier socle fonctionnel de la V2 :

- mesures patient manuelles : poids, température, pouls, tension systolique/diastolique et glycémie ;
- provenance explicite « mesuré » ou « déclaré » ;
- unités et plages plausibles contrôlées côté API ;
- historique des mesures, filtrable par type ;
- plans de suivi prescrits par un professionnel dans le périmètre d’un consentement clinique actif ;
- items de plan avec mesure, fréquence, objectif et consignes ;
- rappels de médicaments avec horaires, dosage, consignes, dates et stock restant ;
- confirmation de prise via `MedicationIntake` ;
- notifications in-app privées au patient ;
- notifications lors d’une demande d’accès, de son acceptation, de son expiration et de la consultation de la carte d’urgence ;
- écran patient du carnet pour les mesures, plans, médicaments et notifications ;
- tests API ciblés sur les plages de mesures, l’isolement patient et la notification de création d’un rappel.

## Navigation regroupée

Chaque espace comporte désormais cinq onglets au maximum :

- **Patient** : Accueil, Carnet, Visites, Partage, Moi. Le Carnet regroupe les documents, vaccinations et traitements ; Visites regroupe consultations et rendez-vous ; Partage regroupe accès et carte d’urgence.
- **Professionnel** : Accueil, Patients, Suivi, Établissement, Moi. Suivi regroupe consultations, ordonnances et plans de suivi ; Établissement regroupe le rattachement et le contexte professionnel.
- **Établissement** : Accueil, Équipe, Demandes, Paramètres. Équipe regroupe les professionnels et administrateurs ; Paramètres regroupe pré-consultation, modèle d’ordonnance et compte.

Les pages spécialisées restent accessibles depuis leurs liens contextuels, mais ne créent plus d’onglets supplémentaires dans la navigation principale.

## Routes ajoutées

- `GET/POST /api/v1/patient/care/measurements/`
- `GET /api/v1/patient/care/follow-up-plans/`
- `POST /api/v1/patient/care/professional/follow-up-plans/`
- `GET/POST /api/v1/patient/care/medication-reminders/`
- `PATCH /api/v1/patient/care/medication-reminders/<id>/`
- `POST /api/v1/patient/care/medication-reminders/<id>/intakes/`
- `GET /api/v1/patient/care/notifications/`
- `PATCH /api/v1/patient/care/notifications/<id>/read/`

## Fichiers principaux

- `apps/api/apps/care/models.py`
- `apps/api/apps/care/serializers.py`
- `apps/api/apps/care/views.py`
- `apps/api/apps/care/urls.py`
- `apps/api/apps/care/migrations/0013_followupplan_followupplanitem_medicationreminder_and_more.py`
- `apps/api/apps/care/test_v2_tracking.py`
- `apps/api/apps/patients/views.py` — notification de consultation de la carte d’urgence publique.
- `apps/web/src/components/HealthMeasurements.tsx`
- `apps/web/src/components/FollowUpPlans.tsx`
- `apps/web/src/components/MedicationReminders.tsx`
- `apps/web/src/components/PatientNotifications.tsx`
- `apps/web/src/components/PatientAppointments.tsx`
- `apps/web/src/components/PatientCarnet.tsx`
- `apps/web/playwright.config.ts`
- `apps/web/tests/e2e/smoke.spec.ts`
- `apps/api/apps/care/migrations/0014_appointment_preconsultationtemplate.py`

## Limites assumées de cette tranche

- les notifications sont in-app ; les push et SMS nécessitent encore un fournisseur et une politique de consentement ;
- le plan est créé par l’API professionnelle avec un `access_grant_id` actif et le scope `consultations` ; une interface professionnelle dédiée reste à ajouter ;
- aucun diagnostic automatique, seuil d’alerte ou conseil médical automatique n’est généré ;
- les graphiques visuels riches restent à finaliser après validation des données et du design ;
- la réinitialisation de mot de passe avec preuve e-mail/SMS, les tests end-to-end, l’observabilité et la console équipe complète restent dans le Lot A de la roadmap.

## Vérifications

- migrations générées et `makemigrations --check` : OK ;
- tests V2 ciblés : 9 tests OK avec les documents existants ;
- lint frontend : OK, avec seulement des avertissements historiques sur l’usage de quelques balises image ;
- typecheck frontend : OK ;
- tests frontend : 94 réussis ;
- build Next.js : OK ;
- smoke test Playwright : 1 réussi.
- navigation regroupée : 5 onglets maximum par espace, vérifiée par le typecheck et la suite web.

## Incrément ergonomie et recette

- tableaux de bord Recharts patient, professionnel et établissement : `apps/web/src/components/RoleDashboards.tsx` ;
- progression et rappels contextuels dans `PatientHome.tsx`, `ProfessionalHome.tsx` et `EstablishmentConsole.tsx` ;
- actions ajoutées aux états vides des notifications et plans de suivi ;
- recette Playwright desktop et mobile dans `apps/web/playwright.config.ts` et `apps/web/tests/e2e/smoke.spec.ts` ;
- rapport d’audit et de recette : `docs/AUDIT-RECETTE-V2-2026-10-18.md`.
