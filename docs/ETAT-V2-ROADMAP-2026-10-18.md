# État de mise en œuvre de la roadmap V2 — 18 octobre 2026

## Périmètre demandé

Cette tranche couvre les lots de consolidation, de pilote fictif et de prévention/suivi de la roadmap V2. La messagerie patient–médecin est explicitement maintenue en V3. L’espace pharmacie et l’espace laboratoire sont explicitement exclus de cette tranche et restent reportés à V6. Aucun développement ne doit créer d’accès clinique implicite pour ces rôles.

## Implémenté dans le dépôt

| Domaine | État | Preuve dans le code |
|---|---|---|
| Carnet de mesures | Implémenté | `HealthMeasurement`, API `/measurements/`, écran `HealthMeasurements.tsx` |
| Plans de suivi | Implémenté au niveau API et lecture patient | `FollowUpPlan`, `FollowUpPlanItem`, endpoint professionnel et écran patient |
| Rappels de médicaments | Implémenté | `MedicationReminder`, `MedicationIntake`, `MedicationReminders.tsx` |
| Notifications in-app | Implémenté | `PatientNotification`, écran patient et événements accès/rappel/carte d’urgence |
| CI backend | Présente et renforcée historiquement | `.github/workflows/ci.yml` |
| Tests backend V2 | Implémenté | `apps/api/apps/care/test_v2_tracking.py` |
| Export d’ordonnance PDF | Implémenté précédemment | endpoint prescription patient |
| Documents médicaux | Implémenté précédemment | documents privés Cloudinary |
| Vaccinations | Implémenté précédemment | API et écran carnet |
| Modèle d’ordonnance établissement | Implémenté précédemment | configuration établissement + logo Cloudinary |
| Export PDF du carnet | Implémenté | `PatientCarnetExportView`, route `/patient/care/export/` et bouton patient |
| Rendez-vous | Implémenté en première tranche | `Appointment`, API patient et `PatientAppointments.tsx` |
| Modèles de pré-consultation | Implémenté au niveau API | `PreconsultationTemplate`, API établissement protégée |
| CI typecheck/tests web | Ajouté à la CI | `apps/web/package.json`, `.github/workflows/ci.yml` |
| E2E Playwright | Smoke test ajouté et exécuté | `apps/web/playwright.config.ts`, `apps/web/tests/e2e/smoke.spec.ts` |

## Lot A à finaliser

Les points suivants restent des chantiers de consolidation et ne doivent pas être présentés comme terminés :

- réinitialisation avec vérification email/SMS et parcours anti-énumération complet ;
- validation de la délivrabilité SMTP en staging, SPF/DKIM/DMARC et alerte opérateur sur échec ;
- interface complète de remplacement d’administrateur, suspension/réactivation établissement et journal d’audit consultable par l’équipe ;
- tests end-to-end navigateur Playwright sur les parcours métier principaux : le smoke test d’accueil est livré ; les scénarios authentifiés et de consentement restent à étendre ;
- lint et typecheck frontend exécutés dans le registre qui fournit `@ecarnet/ui` ;
- observabilité frontend/backend sans données de santé dans les journaux ;
- audit clavier et lecteur d’écran avec matériel ou lecteur réel.

La CI existante lance déjà les contrôles Django, les migrations, les tests backend, le lint et le build web. Le typecheck local de cette archive reste bloqué par l’absence du paquet privé `@ecarnet/ui` dans le registre npm public.

## Lot B implémenté ou préparé

Les notifications sont maintenant générées pour une nouvelle demande d’accès, l’acceptation, l’expiration, la création d’un rappel de médicament et la consultation de la carte d’urgence. Elles sont strictement rattachées au patient et restent in-app. Les push, SMS et résumés périodiques nécessitent encore un fournisseur, une planification et une validation de consentement.

Le tableau de bord établissement, les compteurs de médecins/codes/demandes, l’audit accessibilité instrumenté et le résumé périodique des accès restent à construire dans une prochaine passe de consolidation.

## Lot C V2 restant

Après validation du Lot A, les sujets à implémenter sont :

- plusieurs administrateurs par établissement avec rôles et droits précis ;
- export contrôlé du carnet avec périmètre, avertissement, journal et révocation impossible d’un fichier déjà téléchargé ;
- lecture hors ligne limitée, chiffrée et effaçable sur appareil partagé ;
- modèles de pré-consultation configurables par établissement ;
- rendez-vous et rappels dépendant de données d’établissement fiables ;
- contenus éducatifs courts en français, relus médicalement ;
- suivi grossesse, enfant et croissance après cadrage des profils proches et du consentement ;
- statistiques anonymisées et minimisées ;
- mode faible débit/mobile hors ligne après analyse de menace et validation juridique.

## Hors périmètre explicite

La messagerie patient–médecin est reportée en V3. Les fonctions OTP SMS et MFA/TOTP sont également V3. Le partage inter-établissements, la téléconsultation, l’ordonnance électronique avec QR pharmacie, les intégrations laboratoire et le paiement mobile sont conditionnels et ne sont pas activés par cette tranche. Les espaces pharmacie et laboratoire sont reportés à V6.

## Vérifications réalisées

- `manage.py check` : OK ;
- `makemigrations --check --dry-run` : OK ;
- suite explicite des applications backend : 248 tests réussis, 3 ignorés ;
- tests V2 ciblés : inclus dans cette suite ;
- compilation Python : OK ;
- lint frontend : OK avec avertissements non bloquants sur des images historiques ;
- typecheck frontend : OK ;
- tests frontend : 94 réussis ;
- build Next.js : OK ;
- smoke test Playwright : 1 réussi ;
- `npm ci --dry-run` : OK.

## Conditions avant données réelles

Les données de santé réelles restent interdites tant que le staging PostgreSQL/Render/Vercel, les sauvegardes/restaurations, le RPO/RTO, l’hébergement, la validation médicale, la validation juridique, l’audit sécurité et la recette mobile/accessibilité n’ont pas reçu un Go/No-Go formel.
