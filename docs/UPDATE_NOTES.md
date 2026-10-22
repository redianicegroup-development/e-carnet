# Mise à jour E‑Carnet — 11 octobre 2026

Cette archive contient uniquement les fichiers source, migrations, tests, dépendances et documentation modifiés. Elle exclut les secrets d’environnement, les caches, les dépendances installées et les artefacts de build.

## Changements inclus

- Séparation de l’enquête de découverte anonyme (après cinq pages publiques) et de l’enquête d’expérience (après une première action réussie dans un espace connecté).
- Nouveau questionnaire de découverte en quatre questions, enquête d’expérience centrée sur la facilité de la tâche, résultats et réponses distincts dans l’administration.
- Publication de la moyenne de facilité sur l’accueil seulement à partir de 30 réponses, sans commentaires ni distribution publique.
- Courbes administratives quotidiennes sur 30 jours, actualisation silencieuse toutes les deux minutes, légende adaptée au mobile.
- Bouton feedback global; la catégorie « Question » renvoie vers le centre d’aide.
- Centre d’aide unifié et textes produit simplifiés; suppression des mentions d’état pilote/version destinées à l’interface.
- Rappel explicite d’utiliser uniquement des données fictives pendant les essais.

## Application

1. Décompresser à la racine du dépôt en préservant les chemins.
2. Déployer les changements Django et Next.js ensemble. Le backend doit appliquer la migration `0011_anonymousvisitor_first_product_action_at_and_more` avant que le nouveau frontend soit utilisé. Dans la configuration Render actuelle, la commande de démarrage applique les migrations.
3. Installer les dépendances web à partir du `package-lock.json`, puis lancer le build habituel.

Aucun déploiement sur Render ou Vercel n’a été lancé depuis cet environnement. La plateforme est toujours en test : **ne saisissez que des données fictives, pas de données médicales réelles**. La page des conditions de rattachement conserve son avertissement de validation juridique.

## Vérifications exécutées

- Frontend : build Next.js réussi; 7 tests réussis; ESLint sans erreur (4 avertissements existants sur l’usage de `<img>` pour les avatars).
- Backend : 72 tests identité réussis; les 11 tests ciblés dashboard/enquêtes réussis; `makemigrations --check --dry-run` indique qu’aucune migration supplémentaire ne manque.
- Courbes : aperçu visuel desktop et mobile vérifié après correction de la légende et du bouton flottant.
