# Web Push — exploitation

Le Web Push permet d'afficher un rappel sur l'appareil du patient même quand l'application est fermée. La notification
**dans l'application** reste la source de vérité : le push n'est qu'un signal. Sans clés VAPID, tout est désactivé et
l'API fonctionne normalement.

## Activer (une fois par environnement)

1. `make lock` (ajoute `pywebpush` au `requirements.txt` verrouillé), puis `python manage.py migrate` (migration `0021`).
2. `python apps/api/scripts/generate-vapid-keys.py` → renseigner `ECARNET_VAPID_PUBLIC_KEY`, `ECARNET_VAPID_PRIVATE_KEY`
   (secret) et `ECARNET_VAPID_SUBJECT` (`mailto:` d'un contact réel). Ne jamais changer la paire ensuite : tous les appareils
   seraient désabonnés.
3. Planifier toutes les 5 minutes : `python manage.py send_due_reminders` (voir « Planification »).
4. Dans l'application : Paramètres → Notifications → « Activer les notifications ».

## Planification

| Hébergement | Comment |
|---|---|
| Hodi (cPanel) | Tâche cron : `*/5 * * * * cd /home/UTILISATEUR/ecarnet/apps/api && /home/UTILISATEUR/venv/bin/python manage.py send_due_reminders >> /home/UTILISATEUR/logs/reminders.log 2>&1` — **à confirmer par écrit avec Hodi** (Python + cron autorisés sur l'offre). |
| Render Free | **Impossible** : cron et workers ne sont pas gratuits, et le service s'endort après 15 min. Les rappels in-app fonctionnent, pas les rappels planifiés. |
| Render payant | Service « Cron Job » toutes les 5 minutes avec la même commande. |

La commande est **rejouable** : un créneau n'est traité qu'une fois, un retard de moins de 10 minutes est rattrapé
(`ECARNET_REMINDER_CATCHUP_MINUTES`), et elle n'écrit jamais dans `MedicationIntake`. Test à blanc :
`python manage.py send_due_reminders --dry-run`.

## Décisions de confidentialité (santé)

- Le texte poussé est **neutre** : « Rappel de prise — Ouvrez Mon E‑Carnet pour voir votre rappel ». Aucun nom de médicament
  ni dose sur l'écran verrouillé (`ECARNET_PUSH_SHOW_DETAILS=false` par défaut ; ne l'activez qu'après validation juridique).
- Aucune donnée de santé dans les journaux (identifiants techniques et compteurs seulement).
- Le serveur n'appelle que les services de push connus (Google, Mozilla, Apple, Microsoft) : adresse fournie par le
  navigateur filtrée contre le SSRF (`ECARNET_PUSH_ALLOWED_HOSTS`).

## Limites connues

- **iPhone / iPad** : Web Push seulement si l'application est ajoutée à l'écran d'accueil (iOS 16.4+). L'interface l'explique.
- Un appareil partagé continue de recevoir les rappels du dernier compte abonné tant qu'il n'est pas désabonné.
- Si l'appareil est éteint plus d'une heure (`ECARNET_PUSH_TTL_SECONDS`), le message expire : le rappel reste dans l'application.
