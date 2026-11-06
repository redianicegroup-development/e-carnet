# Session persistante de la PWA — 6 novembre 2026

## Changement

La session serveur Django conserve maintenant une durée par défaut de **30 jours sans activité**, renouvelée à chaque requête authentifiée. Le cookie n’expire pas à la fermeture du navigateur (`SESSION_EXPIRE_AT_BROWSER_CLOSE = False`) : quitter ou fermer la PWA ne déconnecte donc pas la personne. Une expiration serveur, une déconnexion explicite ou la révocation de la session continuent de nécessiter une nouvelle connexion. La durée reste configurable avec `ECARNET_SESSION_AGE_SECONDS` ; l’exemple d’environnement est passé à `2592000` secondes.

L’aide et l’inventaire des cookies affichent cette durée. Le test `legal.test.mjs` vérifie l’accord entre la configuration, l’exemple d’environnement et la durée déclarée.

## Hors connexion

Le comportement hors connexion existant est conservé : les écrans préparés par la PWA s’ouvrent avec leur coquille et les données précédemment consultées peuvent provenir de la copie chiffrée locale, en lecture seule. L’API n’est pas mise en cache par le service worker ; aucune écriture n’est mise en attente ou rejouée hors connexion. La copie locale reste soumise aux durées d’expiration déjà définies et est supprimée à la déconnexion. Le maintien de session ne transforme donc pas l’accès hors ligne en accès serveur et ne contourne pas un refus d’authentification.

## Vérifications

- Suites ciblées session, cookies, service worker et hors connexion : 44 tests réussis.
- TypeScript : réussi.
- La suite web générale avait déjà un échec sans rapport dans `tests/boutons-gooey-aide.test.mjs:82` ; un essai de suite globale a reproduit cet échec.
- Les essais PAT-21 avec cinq personnes sur appareils mobiles réels, dont une personne âgée, ne sont pas déclarés réalisés par cette modification.

## Limites de périmètre

- **ETA-13 / E4 n’est pas implémenté** : rôles propriétaire/gestionnaire, invitations, migrations et fermeture/révocation des sessions d’administrateur ne sont pas modifiés. Les prérequis indiqués restent la fin des vagues A et B et la décision sur le rôle pouvant ouvrir un dossier. Le garde-fou `ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ=false` n’est pas modifié.
- **PAT-21 / E5** : les éléments existants du lot faible débit restent en place ; cette modification n’ajoute pas de changement de performance, de formulaire ou de flux d’écriture.
