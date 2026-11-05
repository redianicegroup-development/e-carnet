> **Référence d’état auditée le 05/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`ETAT-REEL-PROJET-2026-11-05.md`](ETAT-REEL-PROJET-2026-11-05.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# Modifications du 05/11/2026 — PRO-13

## Périmètre livré

- Écran professionnel « Ajouter une mesure » intégré au parcours de pré-consultation ; visible après sélection d’une autorisation active comportant le périmètre `preconsultation`.
- Catalogue partagé des sept types de mesure (température, pouls, SpO₂, tension, glycémie, poids, taille). Les textes tension/glycémie restent libres et aucune conversion, interprétation, alerte ou seuil clinique n’est ajouté.
- Lecture GET des mesures validées du patient dans l’établissement associé à l’autorisation, refus du propre dossier, contrôle du grant et de son périmètre, réponse `no-store`, journal d’audit `clinical_data.read`.
- Création conservée sur l’endpoint existant : l’API impose la source mesurée, le patient, le professionnel et l’établissement, puis journalise `establishment_record.measurement_created`.
- Provenance visible dans la liste médecin et dans le carnet patient sous la forme « Mesuré par … ».
- Contrat OpenAPI, cahier des charges, reste à faire et changelog mis à jour. Le NO-GO pour toute donnée de santé réelle demeure inchangé ; une recette staging reste requise.

## Vérifications

- Test web PRO-13 : **4 réussis / 4**.
- Typecheck complet du frontend : **réussi**.
- Contrat OpenAPI : **YAML valide**, GET et POST PRO-13 présents.
- Suite web complète : **289 réussis / 296**. Les 7 échecs ont été comparés à l’archive originale : même liste avant et après ce lot (285/292 dans l’archive, 289/296 après l’ajout de 4 tests PRO-13).
- `python3 -m py_compile` sur les vues, sérialiseurs et tests API modifiés : **réussi**.
- Tests Django non exécutés : Django n’est pas installé dans l’environnement de rédaction.
- Build frontend non exécuté.
- Lint ciblé non validé : ESLint 9 ne trouve pas de fichier `eslint.config.*` dans l’archive.
- Pas de recette staging, de test Playwright réel, de test mobile ou de décision Go/No-Go exécutés.

## À supprimer à la main

Aucun fichier à supprimer dans ce lot. Le correctif ZIP contient uniquement les fichiers créés ou mis à jour.
