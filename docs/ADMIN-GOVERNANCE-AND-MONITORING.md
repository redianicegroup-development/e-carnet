> **Référence d’état auditée le 06/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`ETAT-REEL-PROJET-2026-11-06.md`](ETAT-REEL-PROJET-2026-11-06.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# Gouvernance des établissements et surveillance

## Contrôle des rôles

Deux périmètres restent distincts côté serveur :

- les opérations de gouvernance (remplacement, suspension/réactivation et lecture du journal) exigent une session authentifiée avec le rôle staff Django (`is_staff`, via `IsAdminUser`) ;
- les opérations courantes d’un établissement exigent un administrateur actif rattaché à cet établissement (`active_administrator`). La liste sans contenu passe par `GET /api/v1/establishments/{id}/patients/`. Le code comprend aussi des routes de demande d’ouverture et de lecture temporaire, mais `ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ=false` les bloque dans la configuration de référence ; il n’existe pas d’écran utilisateur d’ouverture. Garder ce garde-fou fermé jusqu’à la décision A8 et aux validations prévues. L’ancien endpoint `/patient-records/` répond `410` et aucun dossier d’une autre structure n’est accessible.

Le remplacement d’un responsable reste une opération du staff, avec confirmation explicite. La transaction verrouille l’établissement et son responsable courant; le précédent rôle est terminé et le nouveau rôle est créé par le service de provisionnement. Le compte personnel précédent n’est pas supprimé et les autres rôles de ce compte ne sont pas modifiés. L’événement `establishment.administrator.replaced` est inscrit au journal.

## Suspension et réactivation

Migration requise : `python apps/api/manage.py migrate`.

L’équipe peut appeler :

- `POST /api/v1/establishments/startup/{id}/status/` avec `{"action":"suspend","reason":"security_review"}` ;
- `POST /api/v1/establishments/startup/{id}/status/` avec `{"action":"reactivate"}`.

Les motifs autorisés sont `security_review`, `compliance_review`, `legal_request` et `operational`. Aucun texte libre n’est conservé dans les événements d’audit. Le motif et l’acteur de la dernière suspension sont gardés sur l’établissement; les événements de suspension et de réactivation restent dans le journal immuable.

La suspension ne supprime pas les comptes, rattachements, dossiers ni consentements. Elle bloque les routes administratives qui requièrent un établissement actif, les nouveaux rattachements par code et les lectures cliniques professionnelles associées, y compris celles utilisant un consentement antérieur. La réactivation rétablit l’éligibilité, mais un consentement révoqué ou expiré ne redevient pas actif.

## Journal de gouvernance

`GET /api/v1/establishments/startup/{id}/audit/` est staff-only et ne retourne que les 100 événements les plus récents. La réponse expose le type d’événement, l’acteur, son rôle, l’horodatage et les métadonnées explicitement autorisées. Aucun contenu médical, identifiant de patient, consultation ou autorisation clinique n’est inclus. L’interface staff affiche ces événements depuis la liste des établissements.

## Tests connectés

`apps/api/apps/establishments/test_admin_governance.py` et `test_patient_records.py` exercent l’API avec des comptes de test et la base relationnelle : séparation staff/administrateur/tiers, remplacement des droits, suspension, règles de l’API dossiers, cloisonnement entre établissements et journalisation. Ces tests n’établissent pas la valeur du flag sur un service hébergé. Le workflow CI exécute la suite Django sur PostgreSQL 16.

Commandes locales :

```bash
python apps/api/manage.py migrate
npm run test:api
npm run test:web
npm run lint
npm run build
npm run test:e2e --workspace=@ecarnet/web
```

La suite Django est la preuve d’intégration API/DB; les parcours réels de navigateur et téléphones doivent encore être exécutés dans une préproduction connectée avant usage avec des données réelles.

## Surveillance opérationnelle

`ops/monitoring-check.sh` interroge les endpoints publics liveness et readiness et, lorsqu’il est exécuté sur le serveur avec `ECARNET_MONITOR_REQUIRE_COMPONENTS=true`, vérifie aussi base, cache, stockage, fraîcheur de sauvegarde et SMTP. Il n’affiche que des statuts techniques; il ne journalise ni corps de réponse ni données de santé. La planification et la sonde indépendante sont détaillées dans [`MONITORING-WEBHOOK.md`](MONITORING-WEBHOOK.md).

```bash
ECARNET_MONITOR_BASE_URL=https://api.example.tld \
ECARNET_MONITOR_WEBHOOK_SECRET="$DEDICATED_MONITORING_SECRET" \
./ops/monitoring-check.sh
```

La sonde serveur s’exécute toutes les cinq minutes sur l’hébergement applicatif. Une seconde sonde HTTP s’exécute toutes les cinq minutes hors de cet hébergeur et ne partage aucun accès interne. Les deux utilisent un secret webhook dédié, jamais le secret applicatif. Une panne de webhook ne masque pas l’échec de la sonde : le script retourne un code non nul.

**À configurer par l’exploitant avant ouverture :** l’ordonnanceur externe, le webhook/outil d’alerte, les destinataires, les seuils et l’escalade. Le code ne peut pas créer ou authentifier un compte de surveillance externe sans configuration et accès opérateur.


## Console admin livrée

La console admin couvre désormais une rubrique séparée **Surveillance technique** : disponibilité API/base, cache, stockage local, configuration SMTP, incidents et accusés de prise en compte. Elle est réservée à l’exploitation autorisée et ne remplace pas la sonde externe, qui doit continuer à fonctionner même lorsque l’API est indisponible. Le déroulé de recette est décrit dans [`MONITORING-WEBHOOK.md`](MONITORING-WEBHOOK.md).
