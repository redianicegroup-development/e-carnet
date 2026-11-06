> **Référence d’état auditée le 05/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`../ETAT-REEL-PROJET-2026-11-05.md`](../ETAT-REEL-PROJET-2026-11-05.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# A6-A7 — Alignement documentaire et risques établissement

## A6 — Documents alignés

Le flow établissement, le document de gouvernance et l’état réel doivent décrire le même comportement : un administrateur actif peut ouvrir temporairement les soins produits dans sa propre structure, uniquement après un motif valide. L’ouverture est auditée, notifiée au patient et limitée dans le temps. Elle n’ouvre jamais les soins d’une autre structure, ne donne pas accès aux données importées ou déclaratives hors périmètre et ne remplace pas le consentement professionnel.

Les routes actuelles sont `GET /establishments/{id}/patients/`, `POST /establishments/{id}/patients/{patient_id}/openings/`, `GET /establishments/{id}/openings/{opening_id}/record/` et `GET /establishments/{id}/patients/{patient_id}/view-history/`. L’ancien endpoint `/patient-records/` répond `410` pour forcer la mise à jour des PWA en cache.

La politique publique doit informer le patient que l’administrateur de sa structure peut ouvrir ses soins locaux avec un motif et qu’il recevra une notification. Cette formulation ne signifie pas qu’un administrateur peut lire les soins d’une autre structure, ni qu’il peut modifier ou exporter le carnet maître.

## A7 — Risques verrouillés

La coalescence est limitée aux notifications non lues dans la fenêtre prévue ; les événements d’audit restent exhaustifs. Les listes établissement ne renvoient aucun contenu clinique. Enfin, l’ancien endpoint est explicitement fermé en `410` plutôt que redirigé, afin d’éviter qu’une PWA ancienne contourne le nouveau parcours.

Le point juridique A8 reste séparé : avant production réelle, le juriste et le référent médical doivent confirmer la base légale d’un accès administrateur sans consentement préalable, le secret médical applicable à un administrateur non soignant et la promesse faite au patient. Le flag de déploiement permet de garder cette capacité fermée tant que cette validation n’est pas acquise.
