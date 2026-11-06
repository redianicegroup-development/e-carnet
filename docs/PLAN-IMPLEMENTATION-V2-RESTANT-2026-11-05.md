> **Référence d’état auditée le 06/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`docs/ETAT-REEL-PROJET-2026-11-06.md`](ETAT-REEL-PROJET-2026-11-06.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# Plan d’implantation V2 — état réel au 05/11/2026

**Source de vérité :** code présent dans l’archive de travail `/home/ubuntu/work/pat16`, contrôlé le 05/11/2026. Ce document remplace le plan joint `PLAN-IMPLEMENTATION-V2-RESTANT-2026-11-05(1).md`.

## Synthèse

Les chantiers fonctionnels suivants sont désormais **implantés dans le code** :

- PAT-13 — graphiques de tendance des mesures
- PRO-13 — saisie de mesures par le professionnel
- ETA-09 — ouverture et clôture du dossier établissement côté API et interface
- ETA-11 — modèles de pré-consultation, édition et validation médicale
- ETA-12 — tableau de bord établissement et compteur de codes actifs
- ADM-09 — mémoire anti-rejeu des événements de monitoring
- PAT-16 — rendez-vous patient, professionnel, établissement et rappels

Il reste deux chantiers opérationnels principaux :

1. **Hygiène du dépôt et validation CI**
2. **ADM-10 — sonde externe et recette staging**

ETA-09 possède en plus un **verrou de mise en production** : la décision juridique A8 et l’activation contrôlée du drapeau de lecture clinique. Ce n’est plus un manque d’implémentation dans le code.

Les données réelles restent interdites tant que le Go/No-Go n’est pas signé.

---

## 1. État vérifié des chantiers terminés

### PAT-13 — Graphiques de tendance — TERMINÉ côté code

Présent :

- `apps/web/src/lib/measurement-series.ts` : regroupement, tri, période, tension et glycémie sans conversion silencieuse.
- `apps/web/src/components/MeasurementTrends.tsx` : Recharts, périodes 7/30/90 jours et historique complet, états vide/chargement/erreur, résumé ARIA et tableau alternatif.
- Intégration dans `HealthMeasurements.tsx` et `ProfessionalMeasurementEntry.tsx`.
- Test : `apps/web/tests/measurement-series.test.mjs`.

Reste avant validation produit : captures Playwright 320/411 px et audit axe dans l’environnement de recette.

### PRO-13 — Saisie de mesures par le professionnel — TERMINÉ côté code

Présent :

- `ProfessionalHealthMeasurementCreateView` et route `professional/access-grants/<grant_id>/measurements/`.
- Périmètre `preconsultation`, refus de l’auto-accès, expiration/révocation du grant, provenance `measured`, rattachement professionnel/établissement et audit.
- `ProfessionalMeasurementEntry.tsx` dans le dossier professionnel.
- Catalogue partagé des types, lecture côté patient et provenance « Mesuré par… ».
- Tests web `professional-measurements-pro13.test.mjs` et tests API existants.

Reste avant validation produit : recette staging avec des comptes professionnel/patient réels de test.

### ETA-09 — Ouverture/clôture du dossier établissement — IMPLÉMENTÉ, ACTIVATION BLOQUÉE PAR DÉCISION

Présent :

- `EstablishmentRecordOpeningClosure` et migration `establishments.0014`.
- Route de clôture `.../openings/<id>/close/`.
- Refus de lecture après clôture, audit, notification patient et commande de rappel des ouvertures anciennes.
- `EstablishmentPatientRecords.tsx` avec ouverture, bandeau permanent et clôture.
- Lecture clinique désactivée par défaut par `ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ=false`.

Reste hors code : validation juridique A8, choix final de la personne autorisée à clôturer, validation de recette, puis activation progressive du drapeau. Ne pas l’activer avant ces validations.

### ETA-11 — Modèles de pré-consultation — TERMINÉ côté code

Présent :

- Validation de structure des champs, unicité par établissement, édition et désactivation.
- Validation médicale professionnelle avant activation.
- Interfaces `EstablishmentPreconsultationTemplates.tsx` et `ProfessionalTemplateApprovals.tsx`.
- Intégration du modèle actif dans la pré-consultation patient.
- Tests API `test_preconsultation_templates.py` et test web `preconsultation-templates.test.mjs`.

Reste avant validation produit : revue médicale et recette multi-établissements.

### ETA-12 — Tableau de bord établissement — TERMINÉ côté code

Présent :

- `EstablishmentKpis.tsx` avec graphiques et alternatives textuelles.
- Compteur de codes médecin actifs fourni par l’API, excluant les codes utilisés ou expirés.
- États vides et données d’équipe intégrés à `EstablishmentConsole.tsx`.

Reste avant validation produit : captures Playwright 320/411/1280 px et audit axe.

### ADM-09 — Mémoire anti-rejeu du webhook — TERMINÉ côté code

Présent :

- `MonitoringWebhookEvent`, migration `identity.0020` et contrainte d’unicité.
- Identifiant `X-Ecarnet-Monitor-Event-Id` inclus dans la signature.
- Rejeu accepté en `200 already_received` sans modification d’incident.
- Commande `cleanup_monitoring_webhook_events`.
- Documentation `docs/MONITORING-WEBHOOK.md` et tests `ops/test-monitoring-event.py`.

Reste avant validation produit : exécuter la recette dans l’environnement de staging.

### PAT-16 — Rendez-vous — TERMINÉ côté code

Présent :

- Lot A : options établissement/professionnel, validation du rattachement, parcours patient en deux étapes, statut initial demandé.
- Lot B : actions professionnelles confirmées, refus/annulation motivée, proposition de nouveau créneau, clôture, vue établissement limitée à date/statut, notifications et audit.
- Lot C : rappels neutres la veille et quelques heures avant, applicatif/push et idempotence.
- Migration `care.0027_appointment_workflow`.
- Écrans `PatientAppointments.tsx`, `ProfessionalAgenda.tsx` et intégration établissement.

Décision actuellement codée : le patient demande un horaire et le professionnel confirme ou propose un autre horaire. Si le produit exige finalement un catalogue de créneaux libres que le professionnel publie, il faudra un lot complémentaire (modèle de disponibilités, API et écran) ; ce n’est pas présent dans le CDC exécuté ni dans le code actuel.

Tests ciblés réalisés : Django 14/14 et agenda web 7/7.

---

## 2. Chantier restant n°1 — Hygiène du dépôt et validation CI

### État vérifié

Déjà fait :

- `.env`, `.env.production.local`, `db.sqlite3` absents de la copie de travail.
- `sidebar-action.css` absent.
- Workflow CI présent dans `.github/workflows/ci.yml`.
- Django `check` réussi avec `DJANGO_DEBUG=true`.
- Tests API ciblés PAT-16 : 14/14 réussis.

À faire :

1. Supprimer l’orphelin `apps/web/src/components/public/PublicFooterScrollToTop.tsx`.
2. Ajouter `default=""` à `FollowUpPlan.objective` dans `apps/api/apps/care/models.py` pour aligner le modèle sur sa migration.
3. Retirer de l’arborescence de livraison les artefacts non applicatifs encore présents : `jj`, `Fichier.txt`, `push-web.patch`, `akatech-v3.1.zip`, `docs/logo et diection.zip`. Les suppressions devront être listées dans le manifeste, car un ZIP différentiel ne supprime pas les fichiers.
4. Ajouter au script `apps/web/package.json` les 5 tests présents mais non référencés :
   - `tests/etablissement-landing-2026-10-20.test.mjs`
   - `tests/measurement-series.test.mjs`
   - `tests/modal-illustrations.test.mjs`
   - `tests/mon-e-carnet-v13.test.mjs`
   - `tests/notifications.test.mjs`
5. Exécuter la CI complète, puis corriger séparément les échecs réellement liés au code. Ne pas confondre les tests historiques de l’archive avec une régression PAT-16.
6. Régénérer le document de livraison et le manifeste après nettoyage.

**Sortie attendue :** dépôt livrable sans artefact parasite, script de tests exhaustif, CI verte ou écarts explicitement documentés.

---

## 3. ADM-10 — implantation livrée, configuration et recette staging restantes

### État vérifié

L’implantation est présente dans le dépôt : `ops/monitoring-check.sh` contrôle l’API et les composants hôte configurés ; `ops/monitoring-external-check.sh` fournit la sonde hors hébergeur ; `ops/send-monitoring-event.py` émet les événements signés ; la console et les incidents opérationnels sont présents ; ADM-09 fournit la protection anti-rejeu. Les deux exemples de planification et le runbook sont livrés.

Restent hors dépôt : installer les deux tâches dans les environnements choisis, renseigner les secrets dédiés et `ECARNET_OPERATIONS_ADMIN_EMAILS`, puis exécuter la recette staging réelle avec preuve de panne base, résolution et accusé audité. La simulation locale des scripts passe ; elle ne vaut pas recette staging.

**Sortie obtenue dans cette archive :** scripts et documentation ADM-10 livrés ; incident staging créé/résolu automatiquement non démontré faute d’instance staging et de dépendances Django disponibles dans le sandbox.

---

## 4. Ordre final recommandé

| Ordre | Action | Type |
|---|---|---|
| 1 | Nettoyer les deux fichiers/artefacts restants et aligner `FollowUpPlan.objective` | Code/hygiène |
| 2 | Ajouter les 5 tests manquants au script npm et exécuter la CI complète | Validation |
| 3 | Choisir et configurer la sonde externe ADM-10 | Infrastructure |
| 4 | Réaliser la recette staging monitoring | Validation |
| 5 | Faire la revue juridique A8 puis décider de l’activation ETA-09 | Go/No-Go |
| 6 | Effectuer les captures/audits UX restants puis signer le Go/No-Go | Produit |

## 5. Règle de livraison

Chaque ZIP différentiel doit :

- conserver les chemins relatifs d’origine ;
- inclure uniquement les fichiers ajoutés ou modifiés ;
- lister les suppressions dans `[deleted_not_packaged]` ;
- exclure secrets, caches, dépendances, builds, bases locales et données personnelles ;
- contenir un manifeste avec la baseline, les tests exécutés et les limites connues.
