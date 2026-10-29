# Plans de suivi — PRO-12 / PAT-15

Le professionnel dispose désormais d’un écran **Plans de suivi** dans `Professionnel > Consultations`.

## Création

La création exige une autorisation active du patient avec le périmètre `consultations`. Le formulaire demande :

- l’autorisation / le patient concerné ;
- l’objectif du plan ;
- la fréquence ;
- le statut initial.

Le plan est rattaché au professionnel, à l’établissement et à l’autorisation clinique exacte qui l’a créé. Une autre autorisation ou un autre établissement ne peut pas le modifier.

## Statuts

Les statuts disponibles sont `active` (Actif), `paused` (En pause), `completed` (Terminé) et `cancelled` (Annulé). Le changement de statut est contrôlé côté serveur.

## Historique

Chaque création et chaque changement de statut ou d’objectif crée une révision append-only avec l’action, le statut, l’objectif et la date. Le professionnel voit le nombre d’événements et la dernière mise à jour ; le patient voit le statut et le nombre d’événements dans son carnet.

Les plans restent consultables par le patient via `GET /api/v1/patient/care/follow-up-plans/`. Le professionnel peut les lister via `GET /api/v1/patient/care/professional/follow-up-plans/`, les créer via `POST` et modifier le statut ou l’objectif via `PATCH /<uuid>/`.
