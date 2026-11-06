# Session persistante de la PWA — 6 novembre 2026

## Changement

La session serveur Django conserve une durée de référence de **30 jours sans activité**, renouvelée à chaque requête (`SESSION_SAVE_EVERY_REQUEST = True`). Le cookie n’expire pas à la fermeture du navigateur (`SESSION_EXPIRE_AT_BROWSER_CLOSE = False`) : quitter ou fermer la PWA sans choisir « Déconnexion » ne termine donc pas la session. Une expiration serveur ou une déconnexion explicite nécessite une nouvelle connexion. La durée reste configurable avec `ECARNET_SESSION_AGE_SECONDS` ; `.env.example`, `apps/api/.env.production.example` et `render.yaml` indiquent maintenant `2592000` secondes. La valeur d’une instance déjà hébergée n’a pas été vérifiée.

L’aide et l’inventaire des cookies affichent cette durée. Le test `legal.test.mjs` vérifie l’accord entre la configuration, l’exemple d’environnement et la durée déclarée.

## Hors connexion

Le comportement hors connexion distingue deux copies : les lectures JSON éligibles de l’API sont chiffrées et lues en lecture seule ; la carte d’urgence ouverte par QR est conservée jusqu’à 24 h dans une IndexedDB séparée, sans chiffrement applicatif. Aucune écriture n’est mise en attente ou rejouée hors connexion. Le maintien d’un cookie ne transforme pas l’accès hors ligne en accès serveur et ne contourne pas un refus d’authentification.

## Vérifications

- Suites ciblées session, cookies, service worker et hors connexion : 44 tests réussis.
- TypeScript : réussi.
- La suite web générale avait déjà un échec sans rapport dans `tests/boutons-gooey-aide.test.mjs:82` ; un essai de suite globale a reproduit cet échec.
- Les essais PAT-21 avec cinq personnes sur appareils mobiles réels, dont une personne âgée, ne sont pas déclarés réalisés par cette modification.

## Limites de périmètre

- **ETA-13 / E4 n’est pas implémenté** : rôles propriétaire/gestionnaire, invitations, migrations et fermeture/révocation des sessions d’administrateur ne sont pas modifiés. Les prérequis indiqués restent la fin des vagues A et B et la décision sur le rôle pouvant ouvrir un dossier. Pour maintenir le garde-fou en attendant A8, les modèles d’environnement et le Blueprint Render fixent maintenant `ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ=false` ; les réglages d’une instance hébergée restent à vérifier.
- **PAT-21 / E5** : les éléments existants du lot faible débit restent en place ; cette modification n’ajoute pas de changement de performance, de formulaire ou de flux d’écriture.
