> **Référence d’état auditée le 06/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`docs/ETAT-REEL-PROJET-2026-11-06.md`](ETAT-REEL-PROJET-2026-11-06.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# Plan d’implantation V2 — état réel et corrections au 05/11/2026

**Source de vérité actualisée :** archive reçue `e-carnetv.1.4.2.zip`, inspectée le 05/11/2026 et mise à jour par la tranche C7. Les résultats historiques sont conservés comme tels ; les nouveaux résultats ne sont publiés qu’après exécution, le nombre source étant généré par script et les journaux CI restant la référence. L’implantation de C7 ne vaut pas recette staging.

**Taille :** S = moins d’une journée, M = 1 à 3 jours (ordre de grandeur, pas un engagement).

## Vocabulaire de statut (à respecter dans tous les documents)

| Statut | Condition |
|---|---|
| **Implémenté** | Le code existe. Aucun test exécuté n’est exigé. |
| **Vérifié** | Suite Django (SQLite) et tests web rejoués, `makemigrations --check` vide, aucun échec lié au chantier. |
| **Recetté** | Vérifié sur PostgreSQL 16 et en staging, avec des comptes de test. |

Aucun chantier n’est « terminé » tant qu’il n’est pas **Vérifié**. L’écart du référent médical (C1) est passé inaperçu parce que ce mot a été employé sans exécution.

## Synthèse

| Chantier | Statut au 05/11/2026 | Ce qui bloque ou manque |
|---|---|---|
| PAT-13 graphiques de tendance | Implémenté | Test inclus dans `npm test` (C6) ; captures 320/411 px et axe à faire |
| PRO-13 saisie de mesures par le médecin | Implémenté | Recette staging |
| ETA-09 ouverture et clôture du dossier | **Implanté R1, à vérifier** | Durée jusqu’à clôture du motif par défaut ; base légale A8, recette et choix de qui peut clôturer |
| ETA-11 modèles de pré-consultation | Implémenté (C1) | Suite Django et `makemigrations --check` à exécuter ; recette staging |
| ETA-12 tableau de bord | Implémenté | Captures et axe |
| ADM-09 anti-rejeu du webhook | Implémenté | OpenAPI et garde-fou C7 ajoutés ; vérifier par CI et recetter en staging |
| PAT-16 rendez-vous | **Implanté C2–C5, à vérifier** | Tests Django C2–C5 à exécuter ; durée de validité et avertissement de chevauchement restent à trancher |
| ADM-10 sondes | Livré, non recetté | Installation, secrets, recette staging |

Les données réelles restent interdites tant que le Go/No-Go n’est pas signé.

Le code PAT-16 C2–C5 est présent dans cette archive et couvert par `test_pat16_patient_identity.py`, `test_pat16_input_validation.py`, `test_pat16_appointment_transitions.py` et `test_pat16_proposal_audit.py`. Ces tests n’ont pas été exécutés dans le sandbox de livraison faute de Django installé ; le statut reste donc « implanté, à vérifier ».

---

## 1. Corrections à faire (contrôle du 05/11/2026)

### P0 — Blocages

#### C1 — Référent médical absent (ETA-11) — S à M

**Constat.** `is_medical_referent` figure dans la migration `establishments.0015`, dans `MembershipSerializer`, dans `care/views.py` (lignes d’éligibilité et d’approbation), dans le front et dans les tests. Il **n’existe pas** dans le modèle `EstablishmentMembership`, et la route `…/memberships/<id>/medical-referent/` appelée par l’écran et par `test_preconsultation_templates.py` **n’existe pas**. Conséquences : toute requête `is_medical_referent=True` lève une `FieldError` ; nul ne peut être référent ; aucun modèle ne peut être activé ; `makemigrations --check` détecterait une suppression de champ.

**À faire**
1. `apps/api/apps/establishments/models.py` : ajouter `is_medical_referent = models.BooleanField(default=False)` à `EstablishmentMembership` (identique à la migration 0015 : aucune nouvelle migration ne doit apparaître).
2. Créer `MembershipMedicalReferentView` dans `establishments/views.py` et la route `<uuid:establishment_id>/memberships/<uuid:membership_id>/medical-referent/` dans `urls.py` (POST).
   - Réservée à l’administrateur actif de l’établissement (`active_administrator`).
   - Le rattachement doit appartenir à cet établissement, être `active`, et son professionnel `verification_status == "verified"`.
   - Corps `{"is_medical_referent": true|false}` : booléen strict, sinon 400. `select_for_update` sur le rattachement.
   - Audit `establishment.medical_referent_changed` (identifiants et nouvelle valeur, aucun contenu clinique). Notification au professionnel concerné.
   - Retirer le rôle n’invalide pas les modèles déjà approuvés (`approved_by` est conservé).
3. Rendre `is_medical_referent` **en lecture seule** dans `MembershipSerializer` : seul cet endpoint peut le modifier.
4. Un rattachement suspendu, quitté ou terminé perd de fait le rôle : les vues d’éligibilité filtrent déjà `status="active"` ; le couvrir par un test.
5. **À trancher :** l’administrateur peut-il se désigner lui-même si son compte a aussi un profil professionnel dans la structure ? Proposition : non (la validation médicale doit être une seconde lecture).

**Tests.** Désignation par l’administrateur (200) ; par un non-administrateur (403) ; autre établissement (refus) ; rattachement non actif ou professionnel non vérifié (refus) ; valeur non booléenne (400). Chaîne complète : brouillon → approbation par un référent → actif ; approbation par un non-référent (403). `test_preconsultation_templates.py` doit passer sans modification.
**Sortie.** Un modèle passe de brouillon à actif par un référent désigné ; plus aucune `FieldError`.

#### C2 — Identité du patient absente de l’agenda du médecin (PAT-16) — **implanté, à vérifier**

**Constat.** Le front type `patient_name` mais `AppointmentSerializer` ne le renvoie pas, et l’écran n’affiche que le motif et le statut.

**À faire**
1. Ne pas ajouter l’identité au sérialiseur côté patient. Créer `ProfessionalAppointmentSerializer` (prénom et nom du **profil** patient, y compris pour un profil enfant ; ni date de naissance, ni contact, ni donnée médicale) et l’utiliser dans `ProfessionalAppointmentListView` uniquement.
2. `ProfessionalAgenda.tsx` : afficher le nom dans chaque rendez-vous.
3. La vue établissement reste limitée à date et statut, sans nom ni motif : le dire dans l’OpenAPI.

**Tests.** Le professionnel voit le nom de ses patients et seulement les siens ; l’endpoint patient et la vue établissement n’exposent aucun nom ; profil enfant.
**Sortie.** Un médecin sait pour qui est chaque rendez-vous.

### P1 — Bugs moyens

#### C3 — Erreurs 500 sur entrées mal formées (PAT-16) — **implanté, à vérifier**

**Constat.** Un `Appointment.objects.filter(...)` avec un texte invalide lève une `ValidationError` Django, que DRF ne convertit pas : 500 pour `?establishment_id=` (options), `?from=` et `?to=` (agenda médecin), et pour un `starts_at` invalide dans l’action `propose` (la chaîne est affectée telle quelle au modèle).

**À faire**
1. Options : valider l’UUID (`uuid.UUID`), 400 si mal formé ; un établissement inconnu donne une liste vide de professionnels (pas d’énumération).
2. Agenda médecin : analyser `from` et `to` (`parse_datetime`/`parse_date`, rendus conscients du fuseau), 400 si invalides ; fenêtre maximale (ex. 92 jours) et plafond de lignes.
3. `propose` : passer par un petit sérialiseur (`starts_at` obligatoire, conscient du fuseau et futur ; `ends_at` facultatif et postérieur ; motif ≤ 500) au lieu d’affecter `request.data` au modèle.
4. Filet général : un gestionnaire d’exceptions DRF (`config/exception_handler.py`) qui convertit `django.core.exceptions.ValidationError` en 400, s’il n’en existe pas déjà un.

**Tests.** Chaque entrée mal formée répond 400, jamais 500.

#### C4 — Déplacement et transitions des rendez-vous (PAT-16) — **implanté, à vérifier**

**Constat.** `propose` exige le statut « demandé » ; un rendez-vous confirmé ne peut qu’être annulé. Et `confirm-proposal` n’accepte aussi que « demandé ».

**À faire**
1. Table explicite des transitions dans le code (`APPOINTMENT_TRANSITIONS`) et matrice de tests.
2. Autoriser `propose` depuis `requested` **et** `confirmed`. Sur un rendez-vous confirmé, le créneau d’origine reste valable jusqu’à ce que le patient accepte.
3. `confirm-proposal` accepte `requested` et `confirmed` quand une proposition est en attente ; ajouter `decline-proposal` (efface la proposition sans changer le statut).
4. **À trancher :** durée de validité d’une proposition (proposition : 48 h) ; avertissement (sans blocage) en cas de chevauchement avec un autre rendez-vous confirmé du professionnel.

**Tests.** Matrice complète des transitions valides et refusées ; déplacement d’un rendez-vous confirmé, accepté puis refusé.

#### C5 — Cohérence des propositions et audit (PAT-16) — **implanté, à vérifier**

**Constat.** Un médecin qui confirme alors qu’une proposition est en attente laisse `proposed_starts_at` et `proposed_ends_at` affichés. Le patient qui confirme un créneau proposé n’écrit aucun événement d’audit.

**À faire**
1. `confirm` est refusé (409) tant qu’une proposition est en attente ; ajouter `withdraw-proposal` côté professionnel (efface les champs `proposed_*`).
2. Événements d’audit `appointment.proposal_confirmed` et `appointment.proposal_declined` ; notification au professionnel concerné.
3. Toute sortie d’une proposition (acceptée, refusée, retirée, rendez-vous annulé) remet `proposed_*` à vide.

**Tests.** `confirm` avec proposition en attente (409) ; champs `proposed_*` vides après chaque issue ; événements d’audit écrits.

#### C6 — Tests non lancés par `npm test` — S

**Constat.** `measurement-series.test.mjs` n’est pas dans le script ; quatre autres fichiers non plus (`etablissement-landing-2026-10-20`, `modal-illustrations`, `mon-e-carnet-v13`, `notifications`).

**À faire**
1. Ajouter ces fichiers au script `test` de `apps/web/package.json`. Les 4 anciens ont montré 3 échecs dans un rejeu sans dépendances : les rejouer en CI, corriger ou isoler ceux qui échouent réellement.
2. Ajouter un test de registre qui échoue si un `tests/*.test.mjs` n’est pas référencé par le script : plus d’oubli silencieux.

**Sortie.** Tous les fichiers de test sont lancés ; le registre est vert.

#### C7 — Documentation et chiffres — Vérifié sur SQLite et web ; PostgreSQL à exécuter

**Constat initial.** L’OpenAPI omettait les routes récentes et l’en-tête d’idempotence du webhook ; les comptes de tests des notes historiques ne correspondaient plus au code.

**Implanté**
1. `docs/api/openapi.yaml` documente les routes rendez-vous (y compris le `PATCH` de compatibilité), pré-consultations, ouvertures de dossier, désignation du référent, compteur de codes actifs et webhook de monitoring. Pour le webhook, les trois en-têtes signés, l’HMAC `sha256=` sur les octets de `horodatage.identifiant.corps` et la réponse idempotente `already_received` sont décrits.
2. `scripts/check-openapi-routes.py` compare les routes Django résolues et méthodes C7 aux chemins/opérations OpenAPI ; la CI l’exécute et échoue sur une dérive.
3. `scripts/count-api-tests.py` génère depuis l’AST le décompte des définitions de tests API ; la CI affiche ce résultat. Les documents actifs renvoient aux journaux CI au lieu de maintenir un nombre copié à la main.
4. `apps/api/tests/test_migration_consistency.py` lance `makemigrations --check --dry-run` au sein de la suite Django. Le job API est configuré en matrice SQLite et PostgreSQL.

**Statut.** Suite Django SQLite complète, suite web, `manage.py check`, `makemigrations --check --dry-run`, parse YAML et contrôle de routes exécutés avec succès. Le test ciblé C8 passe sur PostgreSQL 16.15 ; la suite Django PostgreSQL complète reste à exécuter. Aucune recette staging n’est revendiquée.

#### C8 — Migration `care.0026` sur PostgreSQL — Vérifié

**Constat initial.** La migration combine changements de schéma, `RunPython` de remise en brouillon et contraintes dans une même transaction, avec un risque redouté de « pending trigger events » sous PostgreSQL.

**Essai exécuté.** Le test `apps.care.test_migration_0026_postgres` utilise PostgreSQL 16.15 : retour à `care.0025`, insertion de modèles actifs/inactifs avec plusieurs actifs dans un même établissement, migration à `care.0027`, vérification du statut `draft`, de `active=False` et des deux contraintes, puis rollback à `care.0025` et restauration des migrations terminales.

**Sortie vérifiée.** Le test ciblé passe (1 réussi, aucun échec). Aucun découpage de migration n’est nécessaire ; les fichiers `care.0026` et `care.0027` restent inchangés. La suite Django complète sur PostgreSQL reste distinctement à exécuter.

### À réappliquer (décisions et correctifs du 05/11, absents de l’archive v1.4.1)

#### R1 — ETA-09 : durée indéterminée — appliqué

Décision reconfirmée le 05/11/2026 : l’ouverture reste valable **jusqu’à la clôture du motif**. Le lot R1 applique désormais cette décision : `clinical_views.py` (`record_opening_ttl_minutes()` renvoie `None` par défaut), `settings.py` (`ECARNET_RECORD_OPENING_TTL_MINUTES=0`), tests, ADR-004 et alignement des documents disponibles (ADR-002, Reste à faire, DEPLOYMENT, DONNEES-REELLES-DECISION, README, CHANGELOG). Le CDC v13 n’est pas présent dans l’archive reçue. La clôture et la commande de rappel déjà codées deviennent le contrôle de cette durée. `ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ` reste `false` jusqu’à la base légale A8, la recette et le choix de qui peut clôturer.

#### R2 — `.gitignore`

L’ancien fichier ignore `*.cdc` (donc tout `docs/.cdc`), `globals.css` et `docs/prod.md`. Réappliquer le nouveau `.gitignore` et son test, restaurer `docs/.cdc` (CDC v13, Reste à faire) dans le dépôt, puis vérifier que `git status` les voit.

#### R3 — Hygiène de l’archive (la version précédente de ce plan la donnait pour faite)

Présents dans `v1.4.1` : `apps/api/.env` (4 006 octets), `apps/web/.env.production.local`, `apps/api/db.sqlite3`, `sidebar-action.css`, `PublicFooterScrollToTop.tsx` (3 tests web en échec à cause de ces deux fichiers), `jj`, `Fichier.txt`, `push-web.patch`, `akatech-v3.1.zip`, `docs/logo et diection.zip`. Les supprimer, renouveler les secrets, mettre `CLINICAL_READ=false` dans `.env.example` et `apps/api/.env.production.example`. Point réglé : la migration `care.0025` aligne désormais `FollowUpPlan.objective` sur le modèle, il n’y a plus de `default=""` à ajouter.

---

## 2. Chantiers livrés (état de la lecture du code)

### PAT-13 — Graphiques de tendance — Implémenté
`lib/measurement-series.ts` (regroupement, tri, période, tension et glycémie sans conversion silencieuse), `MeasurementTrends.tsx` (Recharts, 7/30/90 jours et tout, états vide/chargement/erreur, résumé ARIA, tableau alternatif), intégré à `HealthMeasurements.tsx` et `ProfessionalMeasurementEntry.tsx`. Quatre tests réussis. **Reste :** C6, captures Playwright 320/411 px, audit axe.

### PRO-13 — Saisie de mesures par le professionnel — Implémenté
Route `professional/access-grants/<grant_id>/measurements/` (périmètre `preconsultation`, refus de l’auto-accès, provenance `measured`, audit), `ProfessionalMeasurementEntry.tsx`, provenance « Mesuré par… » côté patient. Huit tests web réussis. **Reste :** recette staging.

### ETA-09 — Ouverture et clôture — Implémenté, écart avec la décision
`EstablishmentRecordOpeningClosure` (append-only, migration `establishments.0014`), clôture `…/openings/<id>/close/` protégée contre la double exécution, liste des ouvertures, refus de lecture après clôture, audit, notification, commande `remind_open_establishment_record_openings`, écran avec bandeau permanent et clôture. Lecture clinique désactivée par défaut. **Reste :** R1, base légale A8, qui peut clôturer, recette.

### ETA-11 — Modèles de pré-consultation — Bloqué par C1
Validation de structure, unicité, édition, désactivation, statut brouillon/actif/désactivé, un seul modèle actif par établissement (contrainte), champs d’approbation en lecture seule, écrans administrateur et référent, modèle actif proposé au patient selon ses rendez-vous à venir. **Reste :** C1, C8, revue médicale, recette multi-établissements.

### ETA-12 — Tableau de bord — Implémenté
`EstablishmentKpis.tsx` avec alternatives textuelles ; compteur de codes actifs via `…/join-codes/active-count/`. **Reste :** captures 320/411/1280 px et audit axe.

### ADM-09 — Anti-rejeu du webhook — Implémenté
`MonitoringWebhookEvent` (unicité, migration `identity.0020`), identifiant d’événement signé, validation avant enregistrement, rejeu en 200 `already_received`, commande de nettoyage. **Reste :** C7 (OpenAPI), recette staging.

### PAT-16 — Rendez-vous — Implanté C2–C5, à vérifier
Lot A (options, validation du rattachement, parcours en deux étapes), lot B (confirmer, annuler avec motif, proposer, terminer ; vue établissement limitée à date et statut), lot C (rappels neutres la veille et quelques heures avant, idempotents), migration `care.0027`. **Reste :** C2, C3, C4, C5.
Décision codée : le patient demande un horaire, le professionnel confirme ou en propose un autre. Un catalogue de créneaux libres publiés par le professionnel serait un lot complémentaire (disponibilités, API, écran), absent du CDC exécuté.

### ADM-10 — Sondes — Livré, non recetté
`ops/monitoring-check.sh`, `ops/monitoring-external-check.sh`, `ops/send-monitoring-event.py`, exemples de planification, tests `ops/test-monitoring-*.py` réussis. **Reste hors dépôt :** installer les deux tâches, renseigner les secrets dédiés et `ECARNET_OPERATIONS_ADMIN_EMAILS`, recette staging avec panne simulée, résolution et accusé audité.

---

## 3. Ordre recommandé

| Ordre | Action | Taille |
|---|---|---|
| 1 | **C1** champ, vue et route du référent médical (débloque ETA-11) | S–M |
| 2 | **C3** erreurs 500 et gestionnaire d’exceptions | S |
| 3 | **C2** identité patient dans l’agenda | S |
| 4 | **C4 + C5** machine d’états des rendez-vous, propositions, audit | M |
| 5 | **R1 + R2 + R3** réappliquer durée indéterminée, `.gitignore`, nettoyage de l’archive | S |
| 6 | **C6** tests branchés et test de registre | S |
| 7 | Rejouer la suite Django (SQLite) puis **C8** sur PostgreSQL 16 ; ajouter `makemigrations --check` aux tests | S |
| 8 | **C7** OpenAPI, garde-fou de routes, chiffres générés | M |
| 9 | ADM-10 : installation, secrets, recette staging | M |
| 10 | Revue juridique A8, décision d’activation ETA-09, captures et axe, Go/No-Go | — |

Les étapes 1 à 7 font passer les chantiers de **Implémenté** à **Vérifié**. La recette (statut **Recetté**) exige PostgreSQL 16 et un staging.

## 4. Règle de livraison

Chaque ZIP différentiel doit :

- conserver les chemins relatifs d’origine ;
- inclure uniquement les fichiers ajoutés ou modifiés ;
- lister les suppressions dans `[deleted_not_packaged]` ;
- exclure secrets, caches, dépendances, builds, bases locales et données personnelles ;
- contenir un manifeste avec la baseline, **les tests réellement exécutés (commande et résultat)** et les limites connues ;
- n’employer « Vérifié » ou « Recetté » que selon le vocabulaire ci-dessus.
