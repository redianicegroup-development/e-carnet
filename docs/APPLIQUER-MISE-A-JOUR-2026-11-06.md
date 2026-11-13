# Appliquer l’overlay Mon E-Carnet — 06/11/2026

## Où l’ajouter

Cette archive est un **overlay différentiel**, pas une archive complète du projet. Elle est prévue pour l’extraction `e-carnetV1.5.2.zip` utilisée comme base. Faites une copie de sécurité de votre dépôt, puis extrayez le contenu du ZIP **à la racine de ce dépôt**, en conservant les dossiers (`apps/`, `docs/`) et en autorisant le remplacement des fichiers existants. N’extrayez pas les dossiers `apps/` dans un sous-dossier `apps/` supplémentaire.

Exemple depuis la racine d’un dépôt de travail :

```bash
unzip -o e-carnetV1.5.2-OVERLAY-MAJ-2026-11-06.zip -d .
```

Vérifiez le diff Git avant tout commit, puis appliquez les changements à votre branche de développement. Ne déployez pas directement à partir d’un overlay sans votre revue habituelle. Le paquet n’inclut pas de `.env` local, de secrets, de base SQLite, de `node_modules` ou de `.next`.

## Ce qu’il met à jour

Le ZIP comprend le maintien de session PWA par défaut pendant 30 jours glissants (fermer l’application sans choisir « Déconnexion » ne ferme pas le cookie), et les modèles d’environnement correspondants. Vérifiez également la valeur `ECARNET_SESSION_AGE_SECONDS=2592000` dans le tableau de bord de l’API : une configuration hébergée peut remplacer l’exemple du dépôt. Une session persistante ne rend pas le serveur accessible sans réseau.

Les pages Confidentialité, Sécurité, `/v1`, l’Aide, le README et les documents de référence distinguent maintenant le cache chiffré des lectures API de la copie QR de la carte d’urgence, qui est conservée jusqu’à 24 h dans une base IndexedDB séparée sans chiffrement applicatif. Utilisez cette fonction uniquement sur un appareil de confiance.

Le flag `ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ` est réglé à `false` dans les modèles fournis, en attente de la décision sur le rôle habilité et la base applicable. Attention : la référence « A8 » est incohérente entre les documents A6-A7 (accès clinique admin) et le questionnaire A1-A16 (champs de pré-consultation) ; cette numérotation doit être réconciliée avant toute activation. L’implémentation ETA-13/E4 des rôles propriétaire/gestionnaire n’est **pas** incluse ; les essais PAT-21 sur cinq personnes et Android faible débit ne sont pas déclarés réalisés. Les données de santé réelles restent interdites (`REAL_HEALTH_DATA_ALLOWED=false`).

Les documents datés antérieurs gardent leur contenu historique. Leurs liens vers l’état courant renvoient désormais vers `docs/ETAT-REEL-PROJET-2026-11-06.md`, qui précise ce qui a réellement été vérifié et ce qui ne l’a pas été.

## Contrôles exécutés sur cette révision

- 83 tests web ciblés réussis : juridique, données réelles, session/PWA, caches hors connexion et service worker.
- `npm run typecheck --workspace=@ecarnet/web` réussi.
- `npm run build --workspace=@ecarnet/web` réussi.

Ces contrôles locaux ne remplacent ni la suite complète, ni les tests API, ni la recette sur staging/production, ni les essais sur appareils réels.
