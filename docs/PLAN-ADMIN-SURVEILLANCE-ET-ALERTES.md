# Console admin, journaux, surveillance et alertes

**Date :** 27 octobre 2026  
**Statut :** plan d’évolution basé sur l’implémentation actuelle.

## 1. Réponse courte

Oui, la console admin doit être mise à jour, mais il faut distinguer deux systèmes :

1. **Le journal d’audit métier et sécurité**, déjà présent : qui a fait quoi, quand, sur quel établissement ou quel accès. Il est append-only, protégé et ne doit pas contenir de contenu médical.
2. **La surveillance technique**, encore incomplète : l’API répond-elle, la base est-elle joignable, les erreurs augmentent-elles, les sauvegardes fonctionnent-elles, le disque est-il presque plein ?

La surveillance technique ne doit pas dépendre uniquement de l’interface admin. Si Django ou PostgreSQL tombe, l’admin tombe aussi. Il faut donc une surveillance externe qui détecte la panne, puis une console admin qui explique l’état et l’historique lorsque le service fonctionne à nouveau.

## 2. Ce qui existe déjà dans le projet

### Console admin existante

- Gestion et validation des établissements.
- Suspension/réactivation d’un établissement.
- Remplacement d’un administrateur nominatif.
- Journal staff d’établissement limité aux événements autorisés.
- Récupérations de compte et demandes de contact.
- Graphiques d’activité existants.
- Journaux métier liés aux accès et actions sensibles.

### Surveillance existante

- `GET /api/v1/health/live/` : le processus API répond.
- `GET /api/v1/health/ready/` : l’API et la dépendance PostgreSQL sont prêtes.
- `ops/monitoring-check.sh` : sonde externe liveness/readiness, statut HTTP uniquement et webhook en cas d’échec.
- `ops/backup-db.sh` et un smoke de restauration PostgreSQL local.
- Tests d’audit, de suspension, d’isolation et d’ouverture établissement.

### Ce qui manque

- Une page admin dédiée à l’état opérationnel.
- L’historique des incidents techniques.
- Les métriques de latence p50/p95/p99 et de taux d’erreur.
- La date de dernière sauvegarde réussie et de dernière restauration testée.
- La surveillance du stockage privé, du disque, du cache et des connexions PostgreSQL.
- Des alertes structurées avec sévérité, accusé de prise en compte et responsable.
- Des logs applicatifs structurés avec `request_id` et sans données médicales.
- Une vraie chaîne d’alerte externe indépendante de l’application.

## 3. Organisation proposée dans `/admin`

Ajouter une rubrique **Surveillance technique** visible uniquement par les comptes d’exploitation autorisés, idéalement `is_superuser` ou un rôle futur `ops_admin`. Un administrateur d’établissement, un professionnel et un patient ne doivent jamais voir cette rubrique.

### Écran A — Vue d’ensemble

Afficher des cartes simples :

- **API :** opérationnelle, dégradée ou indisponible.
- **Base de données :** prête ou inaccessible.
- **Dernier contrôle externe :** date, durée et résultat.
- **Erreurs HTTP 5xx :** taux sur 5 minutes et 1 heure.
- **Latence API p95 :** sur les parcours non sensibles et les endpoints internes agrégés.
- **Stockage :** pourcentage utilisé et seuil d’alerte.
- **Sauvegarde :** dernière sauvegarde réussie, âge, empreinte et résultat du dernier test de restauration.
- **Version déployée :** commit ou identifiant d’artefact, jamais un secret.

Les cartes doivent afficher une couleur, une valeur, l’heure de la mesure et la source. Une valeur inconnue doit être affichée comme « non mesurée », jamais comme « OK ».

### Écran B — Incidents techniques

Chaque incident contient uniquement :

- identifiant technique ;
- sévérité : information, avertissement, majeur, critique ;
- catégorie : API, base, stockage, sauvegarde, e-mail, cache ou sécurité ;
- début, dernière observation et fin ;
- symptôme court ;
- statut : ouvert, reconnu, en cours, résolu ;
- responsable ;
- note de résolution sans donnée patient.

Actions autorisées : reconnaître, affecter, marquer résolu et consulter l’historique. La suppression silencieuse est interdite. Les changements d’état sont eux-mêmes audités.

### Écran C — Journaux techniques

Afficher des événements structurés filtrables par :

- période ;
- niveau ;
- service ;
- route normalisée ;
- code HTTP ;
- `request_id` ;
- version déployée.

Ne jamais afficher par défaut : corps de requête, corps de réponse, cookies, jetons, mots de passe, QR, codes de rattachement, noms de patients, e-mails complets, documents ou constantes médicales.

### Écran D — Journal d’audit métier

Le journal d’audit actuel reste séparé. Il sert à répondre à :

- quel professionnel a ouvert un dossier ;
- quel patient a accepté ou révoqué un accès ;
- quelle décision d’établissement a été prise ;
- quel événement de sécurité a eu lieu.

Il ne doit pas être mélangé avec les logs techniques de type « timeout PostgreSQL » ou « réponse HTTP 500 ».

## 4. Alertes à créer

### Critiques — notification immédiate

- readiness indisponible pendant deux contrôles consécutifs ;
- plus de 2 % de réponses HTTP 5xx sur 5 minutes ;
- PostgreSQL inaccessible ;
- sauvegarde échouée ou aucune sauvegarde depuis la période définie ;
- disque ou stockage privé à plus de 85 % ;
- suspicion de fuite de secret ou d’accès administrateur anormal.

### Majeures — notification rapide

- latence p95 supérieure à 1 seconde pendant 15 minutes ;
- taux de 5xx entre 0,5 % et 2 % ;
- cache/rate limit indisponible ;
- échec SMTP répété ;
- restauration de sauvegarde non testée dans le délai prévu ;
- hausse inhabituelle des erreurs de concurrence QR ou de révocation.

### Avertissements — revue quotidienne

- CPU ou RAM supérieurs à 75 % pendant 15 minutes ;
- connexions PostgreSQL supérieures à 70 % du plafond ;
- disque supérieur à 70 % ;
- tâches de nettoyage QR en retard ;
- dépendance logicielle critique à mettre à jour ;
- certificat TLS à moins de 14 jours de son expiration.

Les seuils sont des valeurs initiales. Ils doivent être ajustés après le pilote Hodi afin d’éviter les fausses alertes.

## 5. Architecture technique recommandée

```text
Sonde externe / Hodi monitoring / Uptime
             |
             +--> webhook ou e-mail d’alerte
             |
             +--> métriques et incidents

API Django --> logs structurés sans données médicales
           --> métriques RED : rate, errors, duration
           --> audit métier append-only séparé

Admin /surveillance <-- résumé agrégé protégé
```

La sonde externe est obligatoire car elle doit détecter une API complètement hors service. La console admin consomme seulement un résumé agrégé quand l’API est disponible.

Pour les métriques, il est préférable d’utiliser un outil d’observabilité adapté plutôt que de stocker chaque requête dans Django. La base de Mon E-Carnet ne doit pas devenir une base de logs haute fréquence. Django peut conserver les incidents, les accusés de réception et les preuves opérationnelles utiles ; les séries temporelles détaillées doivent rester dans l’outil de monitoring choisi et limité par une politique de conservation.

## 6. Modèles backend à ajouter plus tard

Les modèles suivants sont suffisants pour la première version :

### `OperationalIncident`

- `incident_key` unique ;
- `severity` ;
- `category` ;
- `status` ;
- `first_seen_at`, `last_seen_at`, `resolved_at` ;
- `summary` sans donnée personnelle ;
- `owner` ;
- `resolution_note` ;
- `created_by` et `updated_by` ;
- empreinte de l’événement externe si disponible.

### `HealthCheckSnapshot`

À conserver avec parcimonie, par exemple une agrégation toutes les 5 minutes :

- service ;
- statut ;
- durée ;
- code HTTP ;
- version ;
- mesuré à ;
- message technique nettoyé.

Ne pas y enregistrer les corps HTTP ou les données de santé.

### `AdminAlertDelivery`

- incident ;
- canal ;
- destinataire ou identifiant de canal masqué ;
- envoyé à ;
- accusé ou erreur ;
- nombre de relances.

## 7. Étapes de réalisation

### Étape 1 — maintenant, sans modifier les droits cliniques

- Ajouter `request_id` aux réponses et logs techniques.
- Formaliser les logs JSON et leur politique de masquage.
- Brancher `monitoring-check.sh` sur une surveillance externe indépendante.
- Définir les seuils et les destinataires d’alerte.
- Tester panne API, panne base, panne webhook et restauration.

### Étape 2 — mise à jour admin

- Ajouter `GET /api/v1/identity/admin/operations/summary/`.
- Protéger la route par permission d’exploitation, pas uniquement par connexion.
- Ajouter la page `/admin/surveillance/`.
- Afficher la dernière mesure, l’état, la source et la date.
- Ajouter les incidents ouverts et leur accusé de prise en compte.
- Journaliser toutes les actions admin sur les incidents.

### Étape 3 — observabilité renforcée

- Ajouter métriques par endpoint normalisé.
- Ajouter p95/p99, 4xx/5xx, PostgreSQL, Redis et stockage.
- Ajouter alerte de sauvegarde et test de restauration Hodi.
- Ajouter dashboard de capacité pour décider Site Pro, Cyber+ ou Archipel.

### Étape 4 — multi-instance éventuelle

Avant un load balancer :

- Redis partagé ;
- stockage partagé ;
- sessions communes ;
- migrations séparées ;
- readiness fiable ;
- logs centralisés ;
- incidents testés pendant le retrait d’une instance.

## 8. Règles de confidentialité

- Le monitoring ne doit jamais recevoir de contenu médical.
- Les URLs doivent être normalisées pour ne pas contenir d’identifiants patient.
- Les e-mails et identifiants doivent être masqués ou hachés lorsque possible.
- Les alertes externes doivent dire « erreur API », « base indisponible » ou « sauvegarde échouée », jamais révéler le patient concerné.
- Les données d’audit métier sont conservées selon la politique juridique validée.
- Les logs techniques ont une durée courte et documentée ; ils ne remplacent pas le journal d’audit.

## 9. Décision recommandée

Oui, il faut mettre à jour l’admin, mais dans cet ordre :

1. surveillance externe indépendante ;
2. logs structurés et sans données médicales ;
3. alertes et procédure d’incident ;
4. endpoint de résumé protégé ;
5. écran `/admin/surveillance/` ;
6. métriques de capacité et décision Hodi.

L’écran admin améliore la compréhension et la gestion des incidents ; il ne remplace jamais la sonde externe. Cette séparation évite le paradoxe suivant : afficher « tout va bien » dans une console qui est elle-même indisponible.


## 10. Première implémentation livrée

La première version portable est maintenant branchée dans la console `/admin` :

- nouvel onglet **Surveillance** ;
- route protégée `GET /api/v1/identity/admin/operations/summary/` ;
- contrôle de la base, du cache et du répertoire médias ;
- affichage de l’environnement et de la version de release ;
- aucune donnée médicale, aucun secret et aucun corps de requête dans la réponse ;
- restriction par superadministrateur et par e-mail autorisé ;
- rafraîchissement manuel et automatique toutes les 60 secondes.

La variable backend est :

```env
ECARNET_OPERATIONS_ADMIN_EMAILS=ops@votre-domaine.ci
ECARNET_RELEASE_VERSION=2026.10.27-abc123
```

La connexion utilise le compte Django superadministrateur existant et son mot de passe normal. La variable ne contient donc pas de mot de passe partagé. Plusieurs e-mails peuvent être autorisés avec des virgules. Si la variable est vide en local, tout superadministrateur de test peut ouvrir l’onglet ; en staging et production, elle doit être renseignée.

Cette première version fonctionne avec Vercel + Render et ne dépend d’aucune API Hodi. Elle pourra donc être déplacée sur Hodi avec les mêmes variables d’environnement. Les métriques p95, 5xx, disque Hodi et sauvegardes restent à brancher à une surveillance externe, car elles ne doivent pas être calculées uniquement par l’application.


### Tranche incidents livrée

Le registre `OperationalIncident` est maintenant disponible côté API. Il conserve une clé technique, une sévérité, une catégorie, un résumé sans donnée médicale, les dates d’observation et l’état `open`, `acknowledged` ou `resolved`. La console permet de reconnaître puis de résoudre un incident ; ces transitions sont inscrites dans le journal d’audit protégé sous `operations.incident.acknowledged` et `operations.incident.resolved`.

Cette tranche ne crée pas encore automatiquement un incident à partir d’un outil externe. La prochaine étape sera d’ajouter un webhook signé ou un adaptateur de fournisseur de monitoring pour ouvrir ou actualiser les incidents automatiquement, sans accepter de webhook non authentifié.
