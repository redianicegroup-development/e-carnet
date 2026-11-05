> **Référence d’état auditée le 05/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`docs/ETAT-REEL-PROJET-2026-11-05.md`](docs/ETAT-REEL-PROJET-2026-11-05.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# Plan d’implantation V2 — état réel et corrections au 05/11/2026

**Source de vérité :** archive de base `e-carnetv.1.4.1.zip`, correctif C1 fourni dans `e-carnetv1.4.zip`, puis correctifs C2 et C3 PAT-16. C1, C2 et C3 sont implémentés dans le code et des tests ciblés sont ajoutés ; les tests API restent à exécuter dans un environnement avec Django installé. La recette staging n’a pas été réalisée.
Ce document distingue le code livré de la vérification en test et en staging. Les modifications C1, C2 et C3 sont des correctifs de code ; elles ne valent ni vérification Django ni recette staging.

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
| PAT-13 graphiques de tendance | Implémenté | `measurement-series.test.mjs` est maintenant dans `npm test` (C6, 331/331) ; captures 320/411 px et axe à faire |
| PRO-13 saisie de mesures par le médecin | Implémenté | Recette staging |
| ETA-09 ouverture et clôture du dossier | Implémenté, **écart avec la décision** | Durée toujours à 30 minutes alors que la décision est « indéterminée » (R1) ; base légale A8 |
| ETA-11 modèles de pré-consultation | Implémenté (C1) | Suite Django et `makemigrations --check` à exécuter ; recette staging |
| ETA-12 tableau de bord | Implémenté | Captures et axe |
| ADM-09 anti-rejeu du webhook | Implémenté | Absent de l’OpenAPI (C7) ; recette staging |
| PAT-16 rendez-vous | Partiel — C2 à C5 implémentés | Tests Django C2–C5 à exécuter ; durée de validité et avertissement de chevauchement à trancher |
| ADM-10 sondes | Livré, non recetté | Installation, secrets, recette staging |

Les données réelles restent interdites tant que le Go/No-Go n’est pas signé.

---

## 1. Corrections à faire (contrôle du 05/11/2026)

### P0 — Blocages

#### C1 — Référent médical absent (ETA-11) — S à M — Implémenté, non vérifié

**Constat initial (corrigé par C1).** `is_medical_referent` figurait dans la migration `establishments.0015`, dans `MembershipSerializer`, dans `care/views.py` (lignes d’éligibilité et d’approbation), dans le front et dans les tests, mais pas dans le modèle `EstablishmentMembership`, et la route `…/memberships/<id>/medical-referent/` appelée par l’écran et par `test_preconsultation_templates.py` manquait. C1 a réaligné le modèle et ajouté la route ; les tests Django et `makemigrations --check` restent à exécuter.

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

#### C2 — Identité du patient absente de l’agenda du médecin (PAT-16) — S — Implémenté, tests non exécutés

**Constat initial.** Le front typait `patient_name` mais `AppointmentSerializer` ne le renvoyait pas, et l’écran n’affichait que le motif et le statut. Le correctif C2 ajoute `ProfessionalAppointmentSerializer`, réservé aux réponses du professionnel, et affiche le nom du profil patient dans l’agenda.

**Implémenté**
1. `ProfessionalAppointmentSerializer` expose uniquement le prénom et le nom du **profil** patient, y compris enfant ; aucune date de naissance, coordonnée ou donnée médicale n’est ajoutée. Il est utilisé dans la liste et les réponses d’action du professionnel.
2. `ProfessionalAgenda.tsx` affiche le nom dans chaque rendez-vous.
3. Les sérialiseurs patient restent sans nom ; la vue établissement ne renvoie que l’identifiant technique, dates et statut. Les limites sont documentées dans l’OpenAPI.

**Tests ajoutés, exécution à faire.** `test_pat16_patient_identity.py` vérifie l’isolation par professionnel, le nom du profil enfant, l’absence d’identité sur l’endpoint patient et les champs limités de la vue établissement. `py_compile` passe ; les tests Django ne sont pas exécutés dans cet environnement.
**Sortie.** L’identité minimale est visible au médecin autorisé, sans exposition dans les vues patient/établissement.

### P1 — Bugs moyens

#### C3 — Erreurs 500 sur entrées mal formées (PAT-16) — S — Implémenté, tests non exécutés

**Constat initial.** Des valeurs invalides utilisées dans les filtres Django ou affectées telles quelles au modèle pouvaient produire une erreur 500.

**Implémenté**
1. Options : l’UUID `establishment_id` est validé avant la requête ; valeur absente du format attendu (y compris vide) = 400. Un UUID inconnu renvoie une liste de professionnels vide.
2. Agenda professionnel : `from` et `to` acceptent date ISO ou date-heure ISO, les bornes naïves de type date sont rendues conscientes du fuseau courant, les entrées vides/mal formées et intervalles inversés renvoient 400. La plage combinée est limitée à 92 jours ; la réponse est plafonnée à 500 lignes.
3. Action `propose` : `ProposeAppointmentSerializer` exige `starts_at` futur et avec fuseau, valide `ends_at` facultatif et postérieur, et limite le motif à 500 caractères.
4. `config.exception_handler` convertit les `django.core.exceptions.ValidationError` restantes en réponses 400 via DRF ; le handler est configuré dans `REST_FRAMEWORK`.

**Tests ajoutés, exécution à faire.** `test_pat16_input_validation.py` couvre UUID vide/mal formé et inconnu, dates invalides/inversées/trop larges, plafond, propositions mal formées et validation globale. `py_compile` passe ; la suite Django est bloquée par l’absence du module Django dans le sandbox. OpenAPI actualisée ; staging non exécuté.

#### C4 — Impossible de déplacer un rendez-vous confirmé (PAT-16) — M — Implémenté, tests non exécutés

**Constat initial.** `propose` refusait les rendez-vous confirmés et le patient ne pouvait accepter une proposition que depuis le statut demandé.

**Implémenté**
1. `APPOINTMENT_TRANSITIONS` centralise les transitions patient/professionnel, et les actions serveur la consultent.
2. Le professionnel peut proposer un créneau depuis `requested` ou `confirmed`. Sur un rendez-vous confirmé, les dates originales et le statut confirmé restent inchangés tant que le patient n’a pas accepté.
3. Le patient peut accepter la proposition depuis `requested` ou `confirmed` ; le créneau proposé devient alors le créneau effectif. L’action `decline-proposal` efface la proposition sans changer le statut ni les dates originales.
4. L’écran professionnel autorise la proposition depuis un rendez-vous confirmé ; l’écran patient propose accepter/refuser pour un rendez-vous demandé ou confirmé.

**Tests ajoutés.** Matrice des transitions, déplacement depuis confirmé avec maintien de l’ancien créneau, acceptation depuis les deux statuts et refus sans changement de statut/créneau ; assertions web C4 ajoutées au test d’agenda. Tests web rejoués : 8/8. Tests Django ajoutés mais non exécutés (Django absent) ; staging non exécuté.

**Décisions restant à trancher, hors du comportement livré :** durée de validité d’une proposition (option de travail : 48 h) et avertissement non bloquant en cas de chevauchement avec un autre rendez-vous confirmé du professionnel.

#### C5 — Cohérence des propositions et audit (PAT-16) — S — Implémenté, tests non exécutés

**Constat initial.** Une confirmation professionnelle pouvait laisser une proposition en attente, l’acceptation patient n’était pas auditée et une annulation conservait les champs proposés.

**Implémenté**
1. `confirm` et `complete` sont refusés en 409 si une proposition est en attente. L’action professionnelle `withdraw-proposal` efface `proposed_starts_at` et `proposed_ends_at` ; une nouvelle proposition ne peut remplacer silencieusement une proposition pendante.
2. L’acceptation écrit `appointment.proposal_confirmed`, le refus écrit `appointment.proposal_declined`; le retrait professionnel est aussi audité (`appointment.proposal_withdrawn`). Les événements gardent seulement l’identifiant technique du rendez-vous et le statut, sans motif ni contenu clinique.
3. Acceptation, refus, retrait et annulation patient/professionnel remettent les champs `proposed_*` à vide. Une fin de rendez-vous est aussi bloquée pendant une proposition en attente.
4. L’acceptation ou le refus déclenche après commit une notification push au compte professionnel concerné, si les push sont configurées et qu’un abonnement est actif. Le professionnel dispose d’une action UI pour retirer sa proposition.

**Tests ajoutés.** 409 sur confirmation/fin, champs effacés pour acceptation/refus/retrait/annulation, événements d’audit et appel de notification. Tests web ciblés agenda : 9/9. Tests Django ajoutés mais non exécutés (Django absent) ; staging non exécuté.

#### C6 — Tests non lancés par `npm test` — S — Implémenté et vérifié

**Constat initial.** Cinq fichiers étaient oubliés par la liste manuelle de `npm test` : `measurement-series.test.mjs`, `etablissement-landing-2026-10-20.test.mjs`, `modal-illustrations.test.mjs`, `mon-e-carnet-v13.test.mjs` et `notifications.test.mjs`. Des assertions de plusieurs suites n’étaient plus alignées sur les composants et routes actuellement livrés.

**Implémenté**
1. Le script `apps/web/package.json` lance désormais `tests/*.test.mjs` par glob shell ; les cinq fichiers oubliés sont inclus.
2. `tests/test-registry.test.mjs` vérifie que le glob est toujours présent et s’inclut lui-même, empêchant le retour à une liste manuelle incomplète.
3. Les assertions périmées ont été corrigées pour refléter les composants et routes actuels (profil partagé, pré-consultation avec modèles liés, notifications, emplacement du QR, navigation, et FAQ redirigée). La route redondante `/faq` et un composant de scroll public inemployé ont été retirés. La politique de confidentialité décrit maintenant le marqueur `sessionStorage` temporaire, qui ne contient qu’un chemin et un horodatage.

**Sortie vérifiée.** `npm test` exécuté avec les dépendances installées : **38 fichiers, 331 tests réussis, 0 échec, 0 ignoré**. Test-registre vert.

#### C7 — Documentation et chiffres — M

**Constat.** L’OpenAPI ne décrit aucun des nouveaux endpoints ; l’en-tête `X-Ecarnet-Monitor-Event-Id` du webhook n’y figure pas. Le code compte 507 tests API (`def test_`), les documents disent 492 (rejoués le 04/11, avant les nouveaux chantiers).

**À faire**
1. `docs/api/openapi.yaml` : rendez-vous (options, liste et création, actions du détail, liste et actions professionnelles, liste établissement), ouvertures (création, liste, clôture, lecture), modèles de pré-consultation (liste, création, détail, désactivation, actifs côté patient, en attente et approbation côté professionnel), désignation du référent (C1), compteur de codes actifs, et le webhook (en-têtes `X-Ecarnet-Monitor-Timestamp`, `X-Ecarnet-Monitor-Event-Id`, signature `sha256=` sur `horodatage.identifiant.corps`, réponse 200 `already_received`).
2. Garde-fou : un script de CI qui compare les routes déclarées (`urls.py`) aux chemins de l’OpenAPI et signale les écarts.
3. Les nombres de tests ne s’écrivent plus à la main : un script les produit et les documents renvoient à la CI. Rejouer la suite Django (SQLite puis PostgreSQL) et ne publier que le résultat exécuté.
4. Ajouter à la suite Django un test `makemigrations --check` : il aurait détecté C1.

#### C8 — Migration `care.0026` sur PostgreSQL — S

**Constat.** La migration mélange schéma, `RunPython` (remise des anciens modèles en brouillon) et contraintes (`unique_active_preconsult_template`, `preconsultation_template_approval_ck`) dans une seule transaction. Sur PostgreSQL, modifier des lignes puis exécuter un `ALTER TABLE` dans la même transaction peut échouer (« pending trigger events »). Le `RunPython` ne touche que `status` et `active`, donc le risque est faible, mais non démontré.

**À faire**
1. Essai sur PostgreSQL 16 : migrer jusqu’à `care.0025`, insérer des modèles hérités (actifs et inactifs, plusieurs actifs dans le même établissement), migrer jusqu’à `care.0027`, vérifier que tout est en brouillon avec `active=False` et que les contraintes existent ; puis revenir à `care.0025`.
2. Si l’essai échoue : scinder en schéma, données, contraintes. Renuméroter seulement si aucune base partagée n’a appliqué 0026 et 0027 ; sinon créer une migration corrective après 0027.

**Sortie.** Aller et retour verts sur PostgreSQL avec des données héritées.

### À réappliquer (décisions et correctifs du 05/11, absents de l’archive v1.4.1)

#### R1 — ETA-09 : durée indéterminée

Décision reconfirmée le 05/11/2026 : l’ouverture reste valable **jusqu’à la clôture du motif**. Le code de `v1.4.1` applique encore 30 minutes (4 h au plus), refuse les ouvertures sans échéance, et les documents se contredisent (« 30 minutes » ou « sans limite par défaut »). Réappliquer le lot du 05/11 : `clinical_views.py` (`record_opening_ttl_minutes()` renvoie `None` par défaut), `settings.py` (`ECARNET_RECORD_OPENING_TTL_MINUTES=0`), tests, ADR-004 et alignement des documents (ADR-002, roadmap, CDC v13, Reste à faire, DEPLOYMENT, DONNEES-REELLES-DECISION, README, CHANGELOG). La clôture et la commande de rappel déjà codées deviennent le contrôle de cette durée. `ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ` reste `false` jusqu’à la base légale A8, la recette et le choix de qui peut clôturer.

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

### PAT-16 — Rendez-vous — Partiel
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
