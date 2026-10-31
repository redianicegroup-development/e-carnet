# Webhook de monitoring externe

Le backend expose un webhook générique compatible avec Render, Hodi ou un service d’uptime externe :

```text
POST /api/v1/identity/monitoring/webhook/
```

Il ne demande pas de session utilisateur. Il exige une signature HMAC-SHA256 calculée avec le secret `ECARNET_MONITOR_WEBHOOK_SECRET` sur l’**horodatage et le corps JSON brut**.

## Configuration

Dans Render, puis plus tard sur Hodi :

```env
ECARNET_MONITOR_WEBHOOK_SECRET=une-valeur-longue-aleatoire
```

Ne jamais mettre ce secret dans le frontend, dans Git, dans une URL ou dans une alerte e-mail.

## En-têtes attendus

```text
X-Ecarnet-Monitor-Timestamp: <secondes Unix, ex. 1792000000>
X-Ecarnet-Monitor-Signature: sha256=<hexadécimal HMAC-SHA256 de "horodatage.corps">
```

Exemple de calcul :

```python
import hashlib, hmac, json, time

body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode()
timestamp = str(int(time.time()))
signature = hmac.new(
    b"une-valeur-longue-aleatoire",
    timestamp.encode() + b"." + body,
    hashlib.sha256,
).hexdigest()
```

Le corps et la signature doivent être calculés sur exactement les mêmes octets. L’horodatage fait partie de la signature : un événement capturé ne peut pas être rejoué au-delà de la tolérance (300 secondes, réglable avec `ECARNET_MONITOR_WEBHOOK_TOLERANCE_SECONDS`). L’horloge de l’émetteur doit donc rester à l’heure (NTP).

Un événement refusé, signé avec l’ancien format (sans horodatage), trop vieux ou daté du futur, répond `401`.

## Envoyer un événement : le script fourni

La plupart des services d’uptime ne savent pas calculer une signature HMAC. Le dépôt fournit un script sans dépendance :

```bash
ECARNET_MONITOR_WEBHOOK_SECRET=... python ops/send-monitoring-event.py api:readiness-down open \
  --base-url https://api.exemple.ci --severity critical --category api --summary "Readiness indisponible."

ECARNET_MONITOR_WEBHOOK_SECRET=... python ops/send-monitoring-event.py api:readiness-down resolve \
  --base-url https://api.exemple.ci --summary "Readiness revenue."
```

Le secret se lit uniquement dans l’environnement (jamais en argument). Codes de sortie : `0` accepté, `1` refusé ou injoignable, `2` mauvais usage. À appeler depuis la tâche planifiée qui exécute `ops/monitoring-check.sh`, ou depuis un relais de l’outil d’uptime.

## Ouvrir ou actualiser un incident

```json
{
  "incident_key": "api:readiness-down",
  "action": "open",
  "severity": "critical",
  "category": "api",
  "summary": "Readiness indisponible."
}
```

`incident_key` doit être stable pour un même incident. Un nouvel envoi avec la même clé actualise l’incident au lieu d’en créer un nouveau.

Valeurs autorisées :

- sévérité : `info`, `warning`, `major`, `critical` ;
- catégorie : `api`, `database`, `cache`, `storage`, `backup`, `email`, `security` ;
- action : `open` ou `resolve`.

## Résoudre un incident

```json
{
  "incident_key": "api:readiness-down",
  "action": "resolve",
  "severity": "critical",
  "category": "api",
  "summary": "Readiness revenue."
}
```

La résolution externe est affichée dans `/admin`, avec la mention « Résolu par le monitoring externe ». Une résolution ne supprime jamais la trace technique. Résoudre une clé inconnue ne crée aucun incident (réponse `200`, statut `unknown`) ; résoudre un incident déjà résolu ne change rien.

## Protection

- Signature absente, incorrecte, sans horodatage ou hors tolérance : `401`.
- Débit limité par adresse IP, requêtes refusées comprises : `ECARNET_RATE_MONITOR_WEBHOOK` (600 par heure par défaut), puis `429`.
- Journal d’audit : l’ouverture, la réouverture, le changement de gravité et la résolution d’un incident sont tracés (`operations.incident.external_opened` / `external_resolved`, acteur « monitoring »). Un même événement répété chaque minute n’est tracé qu’une fois.
- Le payload est strictement borné : aucun texte clinique, identifiant patient, e-mail, jeton ou corps de requête ne doit être envoyé. Le webhook ne remplace pas la sonde : il reçoit les événements d’un outil externe qui doit lui-même vérifier la disponibilité de l’API.
- Ne changez pas le format des en-têtes sans prévenir l’émetteur : l’ancien format (signature seule) n’est plus accepté depuis le 27/10/2026.
