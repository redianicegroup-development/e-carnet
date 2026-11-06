> **Référence d’état auditée le 05/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`../ETAT-REEL-PROJET-2026-11-05.md`](../ETAT-REEL-PROJET-2026-11-05.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# Chantier C — Partage A → B

## C0 livré

Les fondations déjà présentes sont réutilisées : `notify_patient()` avec coalescence, audit append-only et métadonnées filtrées (`referral_id`, `counterparty_establishment_id`), ainsi que les événements `referral.*`. Les réponses cliniques du snapshot sont `Cache-Control: no-store`.

## C1 — adressage initié par A

Le premier lot introduit l’application Django `apps.referrals` :

- `CareReferral` : patient, établissement/professionnel source, établissement destinataire, motif, état, expiration et durée de lecture ;
- `CareReferralItem` : sélection granulaire des consultations, pré-consultations clôturées, mesures validées, documents validés ou vaccinations confirmées ;
- `CareSnapshot` : instantané JSON immuable, hashé, créé au moment du consentement patient.

Le professionnel A ne peut proposer que des éléments effectivement rattachés à son établissement et à son profil professionnel. Le patient sélectionne les éléments et une durée de 7, 14 ou 30 jours. B ne voit jamais le carnet dans une recherche générale : il reçoit uniquement les adressages acceptés vers son établissement actif.

Routes principales :

- `POST /api/v1/referrals/` : créer un brouillon côté A ;
- `POST /api/v1/referrals/{id}/send/` et `/cancel/` : envoyer ou annuler ;
- `GET /api/v1/referrals/patient/` : voir les propositions côté patient ;
- `POST /api/v1/referrals/patient/{id}/accept/`, `/decline/`, `/revoke/` : consentir, refuser ou retirer ;
- `GET /api/v1/referrals/establishments/{id}/inbox/` : boîte B sans contenu clinique ;
- `GET /api/v1/establishments/{id}/referrals/inbox/` : alias officiel C1.3, également sans contenu clinique ;
- `GET /api/v1/patient/referrals/` : alias officiel de la liste patient ;
- `POST /api/v1/referrals/{id}/open/` : pré-ouverture côté professionnel B avant lecture ;
- `GET /api/v1/referrals/{id}/snapshot/` : lecture du snapshot par un professionnel rattaché à B ;
- `POST /api/v1/referrals/{id}/acknowledge/` : clôturer la consultation.

Le drapeau `ECARNET_REFERRALS_ENABLED` reste à `false` par défaut. Les limites sont `30/hour` pour les changements et `60/hour` pour les lectures. La révocation patient rend le snapshot immédiatement inaccessible.

## Vérifications

- migration `referrals/0001_initial` générée ;
- test d’intégration création → envoi → consentement granulaire → lecture B → révocation ;
- test du verrou par défaut ;
- `manage.py check` réussi.

## Interface et limite restante

Les pages `/patient/adressages` et `/professionnel/adressages` couvrent désormais le consentement granulaire, l’inbox sans contenu, l’ouverture explicite et l’affichage de l’instantané en lecture seule. La validation juridique du texte de consentement et la recette inter-établissements restent nécessaires avant activation production.
