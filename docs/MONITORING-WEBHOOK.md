> **Référence d’état auditée le 05/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`ETAT-REEL-PROJET-2026-11-05.md`](ETAT-REEL-PROJET-2026-11-05.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# ADM-10 — Webhook et sondes de monitoring externe

Ce dispositif comporte **deux sondes**. La première s’exécute sur le serveur applicatif toutes les cinq minutes et vérifie l’API, la base, le cache, le stockage local, la fraîcheur de la dernière sauvegarde et la disponibilité TCP du SMTP. La seconde est une sonde HTTP indépendante de l’hébergeur : elle vérifie uniquement l’URL de santé publique de l’API. Elle reste capable de constater une panne totale de l’API, même si le webhook interne est alors temporairement injoignable.

La console privée « Surveillance technique » affiche les incidents techniques. Un incident est créé, mis à jour ou résolu automatiquement par `ops/monitoring-check.sh` via le webhook signé. L’accusé de réception humain se fait dans la console et est journalisé.

## 1. Webhook et secret dédié

Le backend expose :

```text
POST /api/v1/identity/monitoring/webhook/
```

Le secret `ECARNET_MONITOR_WEBHOOK_SECRET` doit être long, aléatoire, stocké dans le gestionnaire de secrets de l’environnement et **différent de `DJANGO_SECRET_KEY`, des mots de passe SMTP, du secret de session et de tout secret applicatif**. Il n’est jamais placé dans Git, une URL, une commande visible dans l’historique ou une alerte e-mail. La sonde hors hébergeur utilise son propre secret dédié, qui peut être distinct de celui de la sonde serveur.

Renseigner aussi, en staging et en production, la liste nominative :

```env
ECARNET_OPERATIONS_ADMIN_EMAILS=ops1@example.tld,ops2@example.tld
```

Une liste vide ferme l’accès à la console hors mode debug. En local, la valeur vide reste volontairement le défaut.

Le webhook exige les en-têtes suivants :

```text
X-Ecarnet-Monitor-Timestamp: <secondes Unix>
X-Ecarnet-Monitor-Event-Id: <UUID unique>
X-Ecarnet-Monitor-Signature: sha256=<HMAC-SHA256 de horodatage.identifiant.corps>
```

La fenêtre anti-rejeu est de 300 secondes par défaut. Les UUID acceptés sont idempotents et les événements d’ouverture, de réouverture, de changement de gravité et de résolution sont audités avec l’acteur `monitoring`. Les payloads ne contiennent ni donnée médicale, ni patient, ni adresse e-mail, ni secret.

## 2. Sonde sur le serveur — toutes les cinq minutes

Le choix de déploiement retenu est compatible avec Hodi/cPanel ou un cron système. Installer la tâche décrite dans [`ops/monitoring-cron.example`](../ops/monitoring-cron.example). Le fichier d’environnement doit être hors dépôt et protégé (`chmod 600`).

```cron
*/5 * * * * cd /home/UTILISATEUR/ecarnet && set -a && . /home/UTILISATEUR/.config/ecarnet/monitoring.env && set +a && /bin/bash ops/monitoring-check.sh >> /home/UTILISATEUR/logs/ecarnet-monitoring.log 2>&1
```

Activer les contrôles obligatoires en staging/production :

```env
ECARNET_MONITOR_BASE_URL=https://api-staging.example.tld
ECARNET_MONITOR_EVENT_BASE_URL=https://api-staging.example.tld
ECARNET_MONITOR_WEBHOOK_SECRET=<secret-webhook-dédié>
ECARNET_MONITOR_REQUIRE_COMPONENTS=true
ECARNET_MONITOR_DATABASE_HOST=127.0.0.1
ECARNET_MONITOR_DATABASE_PORT=5432
ECARNET_MONITOR_CACHE_HOST=127.0.0.1
ECARNET_MONITOR_CACHE_PORT=6379
ECARNET_MONITOR_STORAGE_PATH=/chemin/absolu/private-media
ECARNET_MONITOR_BACKUP_DIR=/chemin/absolu/backups
ECARNET_MONITOR_BACKUP_MAX_AGE_SECONDS=90000
ECARNET_MONITOR_SMTP_HOST=smtp.example.tld
ECARNET_MONITOR_SMTP_PORT=587
```

Chaque composant possède une clé stable (`api:liveness-down`, `database:unreachable`, `cache:unreachable`, `storage:write`, `backup:last-success`, `email:unreachable`). Un échec envoie `open`; le retour à la normale envoie `resolve`. Si l’API est totalement indisponible, le contrôle local peut constater la panne mais le webhook ne sera envoyé qu’au retour du service : c’est le rôle de la deuxième sonde et de l’alerte du fournisseur indépendant.

Le contrôle SMTP est volontairement un test de connexion TCP ; il ne transmet aucun e-mail réel et ne journalise aucun identifiant. La fraîcheur de sauvegarde est mesurée sur les fichiers du répertoire configuré, à l’exclusion des fichiers `.sha256` et `.metadata`.

## 3. Sonde HTTP hors hébergeur

Installer [`ops/monitoring-external-cron.example`](../ops/monitoring-external-cron.example) sur une machine indépendante ou dans le service de supervision externe retenu. Le script [`ops/monitoring-external-check.sh`](../ops/monitoring-external-check.sh) ne reçoit aucun accès base, cache, stockage ou SMTP :

```cron
*/5 * * * * cd /opt/ecarnet-monitor && set -a && . /etc/ecarnet-monitor.env && set +a && /bin/bash ops/monitoring-external-check.sh >> /var/log/ecarnet-monitoring-external.log 2>&1
```

```env
ECARNET_EXTERNAL_MONITOR_BASE_URL=https://api-staging.example.tld
ECARNET_EXTERNAL_MONITOR_EVENT_BASE_URL=https://api-staging.example.tld
ECARNET_EXTERNAL_MONITOR_WEBHOOK_SECRET=<secret-dédié-hors-hébergeur>
```

Le fournisseur doit déclencher sa propre notification lorsque l’URL `/api/v1/health/live/` est indisponible plusieurs passages consécutifs. Le script envoie l’ouverture/résolution de `api:liveness-down` lorsque le webhook redevient accessible. Ne pas configurer la sonde indépendante avec une URL interne ou une IP du même hébergeur.

## 4. Recette staging obligatoire

Utiliser uniquement des données synthétiques et conserver les heures, réponses HTTP et événements d’audit dans le ticket d’exploitation.

1. Vérifier les migrations, `ECARNET_OPERATIONS_ADMIN_EMAILS`, les deux secrets dédiés, les deux tâches cron et un passage sain : `monitoring=PASS`.
2. Simuler la panne de base sur staging (arrêt contrôlé ou règle réseau temporaire). Le passage suivant doit ouvrir l’incident de clé `database:unreachable` dans la console avec une catégorie `database` et une gravité `major` ou `critical`. Une panne de readiness doit aussi ouvrir `api:readiness-down` si elle est observée.
3. Rétablir la base. Dans les cinq minutes suivantes, le passage sain doit résoudre automatiquement l’incident. Vérifier `resolved_at`, la note « Résolu par le monitoring externe » pour l’événement webhook et les entrées d’audit `operations.incident.external_opened` puis `operations.incident.external_resolved`.
4. Depuis un compte dont l’adresse figure dans `ECARNET_OPERATIONS_ADMIN_EMAILS`, cliquer « Reconnaître » sur un incident de test avant sa résolution. Vérifier `acknowledged_at`, `acknowledged_by` et l’événement `operations.incident.acknowledged` dans le journal d’audit.
5. Couper temporairement l’API ou son accès réseau depuis l’hôte de la sonde indépendante. Vérifier que le fournisseur hors hébergeur alerte sans dépendre de la console interne, puis vérifier la résolution au rétablissement.
6. Supprimer les incidents de test et joindre les preuves au compte rendu ; ne jamais laisser une clé de test ouverte.

La recette est réussie uniquement si l’incident est créé et résolu automatiquement sur la panne simulée, si l’accusé de réception est audité et si la panne totale de l’API est détectée par une machine indépendante.

## 5. Commandes utiles

```bash
# Vérification locale des scripts sans secret réel
python3 ops/test-monitoring-check.py
python3 ops/test-monitoring-event.py

# Émission manuelle contrôlée depuis l’environnement secret (jamais en clair dans l’historique)
python3 ops/send-monitoring-event.py api:test open \
  --base-url https://api-staging.example.tld \
  --severity major --category api --summary "Test technique staging."
```

Les événements refusés (`401`), limités (`429`) ou rejoués sont attendus dans les tests de sécurité existants. Purger les UUID reçus avec `python manage.py cleanup_monitoring_webhook_events` selon la planification de nettoyage du serveur.
