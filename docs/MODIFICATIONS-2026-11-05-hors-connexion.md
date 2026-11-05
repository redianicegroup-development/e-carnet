# 05/11/2026 — Hors connexion : bandeau, copie chiffrée, navigation sans réseau

Base : `e-carnet_V1_4_4.zip` (travail commencé sur la v1.4.1, reporté sans conflit de fond : seuls `confidentialite/page.tsx` et `package.json` demandaient un arbitrage ; `package.json` reste celui de la V1_4_4, qui découvre déjà tous les `tests/*.test.mjs`). Cette livraison ne contient que les fichiers modifiés ou ajoutés. Décompresser par-dessus la racine du projet (les chemins sont conservés).

## Demande

1. Un bandeau « vous êtes hors connexion » en haut de l'application (comme l'exemple Pinterest) et un message au retour de la connexion, dans **tous les espaces** (patient, professionnel, établissement), en s'inspirant de Kôkô Eats ; plus de « Failed to fetch » sur l'accueil patient.
2. Mettre les informations en cache, chiffrées ou hachées, pendant la coupure.
3. Naviguer sans réseau : paramètres, pages légales, pages « en savoir plus », écrans de l'application, déclarations.

## Réponse courte : oui, c'est faisable, avec trois précisions

- **« Chiffrer ou hasher »** : on **chiffre le contenu** (un hachage est à sens unique : on ne pourrait jamais relire les données) et on **hache les noms** des entrées (HMAC-SHA-256), pour qu'on ne devine pas quelles pages ont été consultées.
- **La clé est sur l'appareil** : cela protège contre la lecture du stockage, pas contre quelqu'un qui utilise le navigateur ouvert ni contre un script injecté. Voir `PWA-HORS-CONNEXION.md`, § Chiffrement.
- **Lecture seule** : sans réseau on relit ce qui a déjà été ouvert en ligne ; aucune création ou modification n'est possible (aucune file d'écriture).

## Ce qui a été fait

| Besoin | Réalisation |
|---|---|
| Bandeau hors connexion / connexion rétablie | `components/network/` : `NetworkProvider` (état + sonde), `OfflineBanner`, `network-banner.css` ; monté dans `app/layout.tsx` (toute l'application, pages publiques comprises). Barres collantes décalées sous le bandeau (`sidebar.css`, `site-pages.css`). |
| Inspiré de Kôkô Eats | Même séparation « Internet de l'appareil » / « API indisponible » que `NetworkContext` de Kôkô, avec deux différences : bandeau fixe en haut plutôt que toast, et un serveur qui se réveille (Render) ne déclenche jamais « hors connexion ». |
| « Failed to fetch » | `lib/offline-fetch.ts` : relais `fetch` global (couvre aussi les écrans qui n'utilisent pas `apiGet`) ; erreurs lisibles, toujours des `TypeError`. |
| Copie chiffrée | `lib/offline-cache.ts` : AES-GCM 256, clé non extractible, noms HMAC, 7 jours (patient) / 24 h (tiers), effacement total avec les clés. Règles pures dans `lib/offline-policy.ts`. |
| Navigation sans réseau | `public/sw.js` v5 : coquilles des pages privées gardées par adresse, pages publiques copiées, images/polices/scripts, préchauffage `WARM_SHELLS` (`lib/offline-routes.ts`, `lib/offline-warmup.ts`, `components/OfflineCacheKeeper.tsx`). `SpaceShell` : identité lue depuis la copie sans réseau. |
| Tous les espaces | Rubrique « Hors connexion » ajoutée aux paramètres des espaces professionnel et établissement (`OfflineDataToggle`, variante données de tiers). |
| Effacement | Déconnexion, session absente, changement de compte/espace/profil/établissement, réglage coupé, bouton « Effacer ». |
| Textes | Politique de confidentialité, aide, accueil, `PWA-HORS-CONNEXION.md`, `SECURITY.md`, `CHANGELOG.md`. |

## Décisions à valider

1. **Ça renverse la décision du 02/11** (« deux copies seulement ; jamais le HTML des pages privées »). Le HTML des pages privées ne contient aucune donnée (vérifié : aucune lecture de cookie/en-tête côté serveur), donc le garder est sans risque ; garder les **réponses d'API**, chiffrées, est le vrai changement.
2. **Espaces professionnel et établissement** : la copie contient des données de **patients** (24 h, chiffrées, effaçables). Actif par défaut. Si tu préfères un accord préalable pour ces deux espaces, mettre `OFFLINE_DECLARATIONS_DEFAULT_ENABLED` à `false` (`lib/offline-policy.ts`) — ou je sépare le réglage par espace.
3. **Texte légal** : la politique de confidentialité a été réécrite pour décrire la copie chiffrée (section « Copie hors connexion chiffrée »). À relire par la personne qui valide les textes juridiques avant mise en ligne.
4. **Verrouillage par code/biométrie** de la copie (pour couvrir « quelqu'un utilise le navigateur ouvert ») : non fait, à décider (surtout pour les données de tiers).

## Fichiers

Voir le manifeste joint. Fichiers principaux : `apps/web/src/lib/{network-status,offline-cache,offline-fetch,offline-policy,offline-routes,offline-warmup,logout}.ts`, `apps/web/src/components/network/*`, `apps/web/src/components/{OfflineCacheKeeper,OfflineDataToggle,AccountSettingsClient,ProfessionalSettingsClient,EstablishmentSettingsClient}.tsx`, `apps/web/src/components/shell/{SpaceShell.tsx,sidebar.css}`, `apps/web/src/app/{layout.tsx,site-pages.css}`, `apps/web/public/sw.js`.

## Vérifications

- `tsc --noEmit` : sans erreur. ESLint sur les fichiers touchés : 0 erreur.
- Tests web sur la V1_4_4 + ces changements : **355 tests, 352 réussis**. Nouvelle suite `hors-connexion-2026-11-05.test.mjs` (20 tests : règles, chiffrement réel sur faux IndexedDB, relais `fetch`, routes préparées, branchement) ; service worker : 4 tests ajoutés (coquilles, préchauffage, pages publiques, assets).
- **Non vérifié** : essais sur appareils réels (mode avion, Wi-Fi sans Internet, iOS PWA installée, Android), `next build` (polices Google inaccessibles dans l'environnement de test).
- Le service worker n'existe qu'en production : tester avec `next build && next start`.
- **Premier chargement** : la copie se remplit au fil de la navigation en ligne ; un écran jamais ouvert en ligne n'a pas de données hors connexion (la coquille, elle, est préchauffée).

## À savoir (déjà présent dans la V1_4_4, non modifié ici)

- 3 tests échouent encore, pour des causes qui existaient avant ce travail : `/faq` (centre d'aide), « le document de décision existe » (le dossier `docs/` n'est pas dans l'archive V1_4_4), et « chaque usage du stockage navigateur est déclaré » (`components/public/PublicFooterScrollToTop.tsx` utilise `sessionStorage` sans être déclaré dans la politique). `lib/offline-cache.ts` est, lui, déclaré.
- **Le dossier `docs/` n'est pas dans l'archive V1_4_4.** J'ai livré `docs/PWA-HORS-CONNEXION.md` (réécrit en entier) et cette note. Je n'ai **pas** livré `CHANGELOG.md` ni `SECURITY.md` : ils n'étaient pas dans l'archive et mes versions, basées sur la v1.4.1, auraient pu écraser des entrées plus récentes. À reporter à la main :

### À ajouter en tête de `docs/CHANGELOG.md`

## 2026-11-05 — Hors connexion : bandeau, copie chiffrée, navigation sans réseau

- **Bandeau** « Vous êtes hors connexion » en haut de toute l'application, puis « Connexion rétablie » (avec « Actualiser » si des données venaient de la copie). Un serveur lent ou qui se réveille n'est pas « hors connexion ».
- **Plus de « Failed to fetch »** : les erreurs réseau de l'API sont lisibles dans tous les écrans (relais `fetch` global).
- **Navigation sans réseau** dans les trois espaces : coquilles des écrans gardées par le service worker (v5) avec préchauffage, pages d'information précachées, lectures de l'API copiées **chiffrées** (AES‑GCM 256, clé non extractible, noms hachés) — 7 jours pour le patient, 24 h pour les données de tiers. Aucune écriture hors connexion.
- Rubrique « Hors connexion » ajoutée aux paramètres des espaces professionnel et établissement ; effacement à la déconnexion, au changement de compte/profil/espace.
- L'ancienne copie en clair des déclarations est retirée. Textes de la politique de confidentialité, de l'aide et de l'accueil mis en accord.
- Détail : `PWA-HORS-CONNEXION.md`, `MODIFICATIONS-2026-11-05-hors-connexion.md`.

### À remplacer dans `docs/SECURITY.md` (les deux lignes correspondantes)

- **Copies locales hors connexion :** (1) la carte d’urgence ouverte par QR, 24 h, supprimée à l’expiration et dès que le serveur répond que le QR n’existe plus ; (2) depuis le 05/11/2026, une copie **chiffrée** (AES‑GCM 256, clé non extractible, noms hachés par HMAC) des lectures de l’API des trois espaces, en lecture seule — 7 jours pour le patient, 24 h pour les données de tiers —, effacée avec ses clés à la déconnexion, sur « session absente », au changement de compte/profil/espace et à la demande, désactivable dans Paramètres › Hors connexion. L’ancienne copie en clair est effacée. Limite : la clé est sur l’appareil, la copie ne protège pas d’une personne qui utilise le navigateur ouvert ni d’un script injecté ; voir `PWA-HORS-CONNEXION.md`.

- **PWA :** le service worker ne garde jamais de réponse d’API. Il garde la coquille HTML des pages privées (sans donnée personnelle : aucune lecture de cookie ou d’en-tête côté serveur dans ces pages) ; les données hors connexion viennent de la copie chiffrée décrite ci-dessus.
