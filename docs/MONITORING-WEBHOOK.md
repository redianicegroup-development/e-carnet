# Webhook de monitoring externe

Le backend expose un webhook générique compatible avec Render, Hodi ou un service d’uptime externe :

```text
POST /api/v1/identity/monitoring/webhook/
```

Il ne demande pas de session utilisateur. Il exige une signature HMAC-SHA256 calculée sur le corps JSON brut avec le secret `ECARNET_MONITOR_WEBHOOK_SECRET`.

## Configuration

Dans Render, puis plus tard sur Hodi :

```env
ECARNET_MONITOR_WEBHOOK_SECRET=une-valeur-longue-aleatoire
```

Ne jamais mettre ce secret dans le frontend, dans Git, dans une URL ou dans une alerte e-mail.

## En-tête attendu

```text
X-Ecarnet-Monitor-Signature: sha256=<hexadécimal HMAC-SHA256>
```

Exemple de calcul :

```python
import hashlib, hmac, json

body = json.dumps(payload, separators=(",", ":")).encode()
signature = hmac.new(
    b"une-valeur-longue-aleatoire",
    body,
    hashlib.sha256,
).hexdigest()
```

Le corps et la signature doivent être calculés sur exactement les mêmes octets.

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

La résolution externe est affichée dans `/admin`, avec la mention « Résolu par le monitoring externe ». Une résolution ne supprime jamais la trace technique.

## Protection

Une signature absente ou incorrecte retourne `401`. Le payload est strictement borné : aucun texte clinique, identifiant patient, e-mail, jeton ou corps de requête ne doit être envoyé. Le webhook ne remplace pas la sonde : il reçoit les événements d’un outil externe qui doit lui-même vérifier la disponibilité de l’API.
