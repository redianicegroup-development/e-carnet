> **Référence d’état auditée le 06/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`../ETAT-REEL-PROJET-2026-11-06.md`](../ETAT-REEL-PROJET-2026-11-06.md).

# ADR-004 — Durée indéterminée d’une ouverture de dossier ETA-09

- **Date :** 2026-11-05
- **Statut :** accepté, implantation R1
- **Domaine :** ouverture et clôture du dossier par l’administrateur d’établissement

## Décision

Une ouverture ETA-09 reste valable jusqu’à la clôture explicite du motif. `expires_at` est donc nullable et vaut `NULL` par défaut. Une valeur positive de `ECARNET_RECORD_OPENING_TTL_MINUTES` peut imposer une expiration automatique pour un environnement qui le souhaite, avec un plafond de 240 minutes ; `0` signifie « jusqu’à clôture ».

La clôture append-only est la fin normale de l’accès : elle est protégée contre la double exécution, auditée et notifiée au patient. Les anciennes ouvertures sans échéance ne sont plus rejetées pour cette seule raison. La lecture clinique reste désactivée par défaut tant que la base légale A8, l’écran d’ouverture, le choix des personnes autorisées à clôturer et la recette ne sont pas validés.

## Conséquences

- La liste et l’API peuvent retourner `expires_at: null` ; le client doit l’interpréter comme « jusqu’à clôture ».
- La commande de rappel ne traite que les ouvertures ayant une échéance.
- Les tests couvrent le défaut indéterminé, l’expiration positive configurable, le plafond et la clôture.
- Aucun changement de schéma n’est nécessaire : `expires_at` était déjà nullable.
