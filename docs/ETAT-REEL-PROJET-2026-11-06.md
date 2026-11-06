# État réel du projet — 6 novembre 2026

## Portée

Photographie du dépôt après les corrections documentaires et de configuration du 6 novembre 2026. Elle est fondée sur le code, les tests et les modèles d’environnement présents dans l’archive, non sur une inspection d’un service hébergé. La présence d’une fonction dans le dépôt ne prouve ni son déploiement, ni une recette staging, ni une autorisation d’utiliser des données de santé réelles.

Les comptes rendus datés antérieurs restent des archives de leur état à la date indiquée. Pour toute décision actuelle, utiliser cette référence et le code correspondant.

## Connexion persistante et réouverture de la PWA

L’authentification est fondée sur une session Django côté serveur et un cookie de session HttpOnly. Le frontend vérifie la session existante auprès de l’API au démarrage d’un espace. Dans le code et les configurations de référence, le cookie est persistant après fermeture du navigateur (`SESSION_EXPIRE_AT_BROWSER_CLOSE = False`), la session est glissante et sa durée est de **30 jours sans activité** (`SESSION_SAVE_EVERY_REQUEST = True`, `ECARNET_SESSION_AGE_SECONDS=2592000`). Une déconnexion explicite, une session expirée/révoquée ou un refus du serveur demandent une nouvelle connexion. Une valeur du tableau de bord d’hébergement peut remplacer le modèle du dépôt ; l’environnement réellement en service n’a pas été inspecté.

Fermer ou quitter la PWA sans choisir « Déconnexion » ne supprime donc pas, à lui seul, le cookie persistant. En revanche, cela ne garantit pas une réponse du serveur hors ligne : l’accès hors connexion repose sur les caches locaux décrits ci-dessous.

## Mode hors connexion : deux copies distinctes

- Le service worker conserve les coquilles d’écrans et les ressources de l’application, pas les réponses d’API. Il permet de recharger des écrans préparés, mais ne crée pas une session serveur.
- Les lectures JSON éligibles de l’API sont conservées en lecture seule dans un cache IndexedDB chiffré AES-GCM 256, avec une clé non extractible propre à l’appareil. Durée : 7 jours pour les données du compte/patient, 24 heures pour les données de tiers. Ce cache s’efface selon les événements décrits dans `PWA-HORS-CONNEXION.md` et peut être désactivé dans Paramètres › Hors connexion. Aucune écriture n’est mise en attente ni rejouée hors réseau.
- **Exception importante :** la carte d’urgence publique ouverte par QR est enregistrée dans une base IndexedDB séparée pendant au plus 24 heures. La carte et le jeton associé y sont conservés sans chiffrement applicatif. Cette copie n’est pas contrôlée par le commutateur du cache des lectures API et le renouvellement du QR ne l’efface pas immédiatement sur un appareil hors ligne. La politique de confidentialité, la page Sécurité, l’Aide et `PWA-HORS-CONNEXION.md` le précisent désormais ; cette fonction doit être utilisée sur un appareil de confiance.

Le cache chiffré par une clé de l’appareil ne protège pas contre une personne utilisant un navigateur déjà ouvert. Le projet reste donc en phase de test avec données fictives ; le chiffrement technique du cache ne lève pas le NO-GO.

## Données réelles, accès clinique et ETA-13

- `REAL_HEALTH_DATA_ALLOWED` reste `false`. Les textes publics affichent la phase de test et demandent des données fictives uniquement.
- Le code serveur refuse par défaut l’ouverture/la lecture clinique par l’administrateur d’établissement (`ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ=false`). Les exemples `.env.example`, `apps/api/.env.production.example` et le Blueprint `render.yaml` sont réglés sur `false`. Les valeurs réelles d’un service hébergé peuvent toutefois différer et restent à vérifier.
- Des mécanismes API d’ouverture temporaire existent dans le dépôt, mais l’écran correspondant n’est pas présent dans l’interface et le garde-fou doit rester fermé jusqu’à la décision A8 et aux validations prévues. Cette existence technique ne signifie pas que l’accès est activé ou autorisé.
- **Références A8 incohérentes dans le dépôt :** les notes A6-A7/ETA-13 emploient A8 pour la décision juridique sur l’accès clinique admin, tandis que `QUESTIONNAIRE-DECISIONS-A1-A16.md` emploie A8 pour les champs de pré-consultation. Les identifiants doivent être réconciliés dans le registre avant toute activation ; cette incertitude ne change pas le garde-fou actuel (`false`).
- **ETA-13 / E4 n’est pas implémenté** : le dépôt ne met pas en place les rôles propriétaire/gestionnaire, le système d’invitations multi-administrateurs, la fermeture de toutes les sessions au retrait ni la migration PostgreSQL correspondante. Le modèle actuel d’administrateur d’établissement demeure. Aucun rôle habilité à ouvrir un dossier n’est décidé ici.

## Textes publics et revue juridique

La politique de confidentialité et les CGU ont été actualisées (versions techniques `2026-11-06-v4`) pour décrire les deux mécanismes de copie locale, les attributs réels des cookies selon `DEBUG`/l’environnement et l’ouverture clinique admin désactivée par défaut. Les mentions légales ne sont pas modifiées. Aucun de ces documents n’est juridiquement validé par ce changement : `LEGAL_REVIEW.status` reste `pending` et les champs « À compléter » restent à renseigner. Cette mise à jour décrit le code ; elle ne constitue pas un avis juridique.

La page `/v1` présente le périmètre de façon non indexée et indique les limites (données fictives uniquement, accès admin fermé par défaut, ETA-13 absent, copie QR hors ligne non chiffrée, validations PAT-21 et staging non établies). Les documents datés conservent leur contenu historique, mais leur en-tête renvoie vers cette photographie courante.

## PAT-21 / mode faible débit

Le dépôt contient des mesures hors connexion et certains messages explicites lorsque le réseau manque ; cela ne démontre pas les budgets de poids, d’images ou de temps d’affichage sur un Android modeste en 3G/4G bridée. Les cinq essais avec de vrais utilisateurs, dont une personne âgée, ne sont pas déclarés réalisés. Les essais d’accessibilité et sur appareils réels restent à faire.

## Configuration de déploiement présente dans le dépôt

`render.yaml` décrit un service API Render et des origines frontend Vercel ; le fichier d’environnement production documente PostgreSQL/Neon. Ce sont des modèles de configuration, pas une preuve que ces services sont effectivement connectés ou qu’ils possèdent les mêmes valeurs. Aucune configuration réelle, recette staging, restauration managée, latence ou RPO/RTO n’est établie par cette revue.

## Vérifications de cette révision

Dans cette archive locale : **83 tests web ciblés réussis** (confidentialité, garde-fou données réelles, session, PWA/hors connexion, service worker) ; `npm run typecheck --workspace=@ecarnet/web` réussi ; `npm run build --workspace=@ecarnet/web` réussi. La suite web complète, les tests API et les essais sur appareils réels ne sont pas couverts par ces résultats. Aucun résultat local ne constitue une preuve de staging ou de production.
