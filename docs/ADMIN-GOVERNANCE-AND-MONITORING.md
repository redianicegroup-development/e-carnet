# Gouvernance des établissements et surveillance

## Contrôle des rôles

Deux périmètres restent distincts côté serveur :

- les opérations de gouvernance (remplacement, suspension/réactivation et lecture du journal) exigent une session authentifiée avec le rôle staff Django (`is_staff`, via `IsAdminUser`) ;
- les opérations courantes d’un établissement exigent un administrateur actif rattaché à cet établissement (`active_administrator`). Cela inclut la consultation des dossiers ayant une pré-consultation clôturée ou une consultation dans sa structure, via `GET /api/v1/establishments/{id}/patient-records/`. La requête ne retourne que les enregistrements associés à cet établissement; elle ne donne pas accès aux routes staff ni aux dossiers d’autres établissements.

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

`apps/api/apps/establishments/test_admin_governance.py` et `test_patient_records.py` exercent l’API avec des comptes de test et la base relationnelle : séparation staff/administrateur/tiers, remplacement des droits, suspension, accès local aux dossiers, cloisonnement entre établissements et journalisation. Le workflow CI exécute la suite Django sur PostgreSQL 16.

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

`ops/monitoring-check.sh` interroge les endpoints publics liveness et readiness. Il n’affiche que les statuts HTTP; il ne journalise ni corps de réponse ni données de santé. Exemple de configuration dans un ordonnanceur externe :

```bash
ECARNET_MONITOR_BASE_URL=https://api.example.tld \
ECARNET_MONITOR_WEBHOOK_URL="$MONITORING_WEBHOOK_URL" \
./ops/monitoring-check.sh
```

Exécuter la sonde toutes les cinq minutes depuis un service indépendant de l’hébergeur. Stocker l’URL de webhook dans le gestionnaire de secrets de l’ordonnanceur, jamais dans le dépôt. Liveness mesure que le processus répond; readiness vérifie aussi la base de données. Une panne de webhook ne masque pas l’échec de la sonde : le script retourne un code non nul.

**À configurer par l’exploitant avant ouverture :** l’ordonnanceur externe, le webhook/outil d’alerte, les destinataires, les seuils et l’escalade. Le code ne peut pas créer ou authentifier un compte de surveillance externe sans configuration et accès opérateur.
