# Application de l’overlay AKATech — session PWA

## Où ajouter les fichiers

Décompresser cette archive **à la racine du dépôt e-carnet** (le dossier contenant `package.json`, `.env.example`, `apps/` et `docs/`) en conservant l’arborescence. Autoriser le remplacement des fichiers existants : l’archive ne contient que les fichiers modifiés, plus ce guide.

Fichiers remplacés :
- `.env.example`
- `apps/api/config/settings.py`
- `apps/web/src/lib/legal/config.ts`
- `apps/web/src/components/help/helpContent.ts`
- `apps/web/tests/legal.test.mjs`

Nouveau fichier de documentation :
- `docs/MODIFICATIONS-2026-11-06-session-pwa.md`

## Configuration du déploiement

Si la variable `ECARNET_SESSION_AGE_SECONDS` est déjà définie dans l’environnement serveur (par exemple Render), sa valeur remplace le défaut Python : la définir à `2592000` pour obtenir 30 jours glissants. Ne pas remplacer aveuglément le fichier `.env` privé ; `.env.example` n’est qu’un modèle.

Après application : installer les dépendances si nécessaire, exécuter `npm run build` puis les tests pertinents. Avant mise en production, vérifier la variable effective en staging et tester la reprise avec le même compte sur la vraie PWA. La durée longue concerne la session serveur et doit être revue dans le cadre de la politique de sécurité du service.
