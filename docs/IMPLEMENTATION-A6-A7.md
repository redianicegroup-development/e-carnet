> **Référence d’état auditée le 06/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`../ETAT-REEL-PROJET-2026-11-06.md`](ETAT-REEL-PROJET-2026-11-06.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# A6-A7 — Alignement documentaire et risques établissement

## A6 — Documents alignés

Le code contient des routes qui, si le garde-fou est activé, permettent à un administrateur actif d’ouvrir temporairement des soins produits dans sa propre structure après un motif valide. L’ouverture est auditée, notifiée au patient et limitée dans le temps. **État de référence au 06/11/2026 :** `ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ=false`, aucun écran utilisateur d’ouverture et décision A8 en attente. La présence de ces routes n’autorise donc pas l’ouverture actuelle. Elles ne concernent pas les soins d’une autre structure, ne donnent pas accès aux données importées ou déclaratives hors périmètre et ne remplacent pas le consentement professionnel.

Les routes actuelles sont `GET /establishments/{id}/patients/`, `POST /establishments/{id}/patients/{patient_id}/openings/`, `GET /establishments/{id}/openings/{opening_id}/record/` et `GET /establishments/{id}/patients/{patient_id}/view-history/`. L’ancien endpoint `/patient-records/` répond `410` pour forcer la mise à jour des PWA en cache.

Tant que le flag reste à `false`, les textes publics décrivent l’accès clinique admin comme désactivé par défaut. Si une future décision A8 autorise son activation, les textes devront alors expliquer la portée, le motif, l’audit et la notification au patient avant le déploiement. Cela n’autoriserait toujours pas la lecture des soins d’une autre structure, la modification ou l’export du carnet maître.

## A7 — Risques verrouillés

La coalescence est limitée aux notifications non lues dans la fenêtre prévue ; les événements d’audit restent exhaustifs. Les listes établissement ne renvoient aucun contenu clinique. Enfin, l’ancien endpoint est explicitement fermé en `410` plutôt que redirigé, afin d’éviter qu’une PWA ancienne contourne le nouveau parcours.

Le point juridique A8 reste séparé : avant production réelle, le juriste et le référent médical doivent confirmer la base légale d’un accès administrateur sans consentement préalable, le secret médical applicable à un administrateur non soignant et la promesse faite au patient. Le flag de déploiement permet de garder cette capacité fermée tant que cette validation n’est pas acquise.
