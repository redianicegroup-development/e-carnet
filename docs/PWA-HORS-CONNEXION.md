> **Référence d’état auditée le 05/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`ETAT-REEL-PROJET-2026-11-05.md`](ETAT-REEL-PROJET-2026-11-05.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# PWA hors connexion

Mis à jour le 05/11/2026. Cette version remplace la décision du 02/11/2026 (« deux copies locales, et seulement deux ; le HTML des pages privées n'est jamais gardé »), à la demande du produit : rester dans l'application sans réseau, dans les trois espaces (patient, professionnel, établissement), y compris les paramètres, les pages d'information et les écrans déjà consultés.

## Ce que voit l'utilisateur

- **Bandeau en haut de l'application** (toutes les pages, tous les espaces) : « Vous êtes hors connexion » dès que l'appareil n'atteint plus le site ; **« Connexion rétablie »** au retour (4 s, ou 12 s avec un bouton **Actualiser** si des données affichées venaient de la copie locale). Il pousse la page (il ne recouvre pas l'en-tête) et reste collé en haut ; `prefers-reduced-motion` respecté. Composants : `components/network/` (`NetworkProvider`, `OfflineBanner`, `network-banner.css`).
- **Plus de « Failed to fetch »** : toute erreur réseau d'un appel du site vers son API devient « Vous êtes hors connexion. Vérifiez votre connexion Internet puis réessayez. » (ou, pour une action : « Cette action demande une connexion Internet… »). Les erreurs restent des `TypeError` : le code qui teste `instanceof TypeError` ne change pas.
- **Navigation sans réseau** : les écrans que l'on a déjà ouverts en ligne se rouvrent avec leurs dernières données, en lecture seule ; les pages d'information (Aide, À propos, Sécurité, Crédits, CGU, Confidentialité, Mentions légales, Conditions de rattachement, Proches et enfants) sont toujours disponibles.

## Qu'est-ce qui est « hors connexion » ? (`lib/network-status.ts`)

« Hors connexion » = **aucune réponse HTTP** : `navigator.onLine === false`, ou deux échecs consécutifs de `GET /api/v1/health/` sans réponse (Wi-Fi sans Internet). Un serveur lent ou en erreur (Render qui se réveille : 502, 503, délai dépassé) n'est **pas** hors connexion : le réveil est géré par `SpaceShell`, et le bandeau ne s'affiche pas à tort. Même distinction que Kôkô Eats entre « Internet » et « API indisponible ». Sonde toutes les 30 s (onglet visible), au retour de la connexion, au retour sur l'onglet, et dès qu'un appel du site échoue sans réponse.

## Les trois couches

### 1. Coquilles des écrans (service worker `sw.js`, v5)

- Les pages privées sont des composants navigateur : leur HTML **ne contient aucune donnée personnelle** (aucun `cookies()`/`headers()` côté serveur ; les données viennent de l'API). Le service worker en garde donc la coquille, **par adresse** (`ecarnet-shells-v1`, 80 au plus), réseau d'abord : sans réseau, la dernière coquille de l'adresse ; sans coquille connue, `/hors-connexion.html`.
- **Préchauffage** : une fois un espace ouvert en ligne, l'application demande (message `WARM_SHELLS`, au plus toutes les 30 min et au retour de la connexion) de garder la coquille de chaque onglet de l'espace et des pages d'information (liste : `lib/offline-routes.ts`, vérifiée par test contre les vraies pages), ainsi que les fichiers `/_next/static/` qu'elles référencent. Seules des adresses connues du site sont acceptées.
- Pages publiques : copie gardée à chaque visite. Images, polices, feuilles de style et scripts du site : réseau d'abord, copie gardée (`ecarnet-assets-v1`, 400 au plus).
- **Jamais** : une réponse d'API (`/api/` n'est pas intercepté), un autre site.
- Le service worker n'est enregistré qu'en production (`PwaRegister`) : tester avec `next build && next start`, pas avec `next dev`.

### 2. Copie chiffrée des lectures de l'API (`lib/offline-fetch.ts`, `lib/offline-cache.ts`)

- **Relais autour de `fetch`**, posé une fois à l'import de `NetworkProvider` (avant les effets des composants) : il couvre aussi les écrans qui n'utilisent pas `apiGet` (paramètres, accès, etc.).
  - lecture (GET) JSON réussie → copie chiffrée en tâche de fond ;
  - lecture sans réseau → réponse reconstruite depuis la copie (en-tête `X-Ecarnet-Offline-Copy`, événement `ecarnet:served-from-cache`) ; sans copie, erreur lisible ;
  - écriture sans réseau → erreur lisible, **rien n'est mis en attente** (aucune synchronisation montante) ;
  - écriture réussie → les lectures de la même ressource sont retirées de la copie ;
  - délai dépassé (`AbortError`) : transmis tel quel, jamais traité comme une absence de réseau.
- **Éligibles** : `/api/v1/patient/`, `/api/v1/professionals/`, `/api/v1/establishments/`, `/api/v1/identity/me/`, réponses JSON 200 de moins de 1 million de caractères, requêtes avec identifiants. **Jamais** (même sous ces préfixes) : jetons, QR, secrets, récupération de compte, mots de passe, fichiers, exports, PDF, médias, signatures, justificatifs, push, `csrf`, `health` ; ni l'administration (`/api/v1/admin/`), ni le personnel (`/api/v1/staff/`).
- **Durées** : 7 jours pour le patient et son compte ; **24 heures** pour les données de tiers (patients d'un médecin, dossiers d'un établissement). Constantes : `SNAPSHOT_MAX_AGE_MS`, `THIRD_PARTY_CACHE_MAX_AGE_MS` (`lib/offline-policy.ts`). 300 entrées au plus.
- **Identité** : sans réseau, `SpaceShell` saute la sonde de réveil et lit `/api/v1/identity/me/` depuis la copie. Sans copie (appareil jamais ouvert en ligne, ou copie effacée), l'écran dit d'ouvrir l'application une fois avec la connexion.

### 3. Carte d'urgence publique ouverte par QR (inchangée)

La réponse de `/api/v1/patient/emergency-card/qr/<token>/` est gardée **24 heures** sur l'appareil de celui qui la consulte (IndexedDB `ecarnet-public-emergency-v1`), supprimée à l'expiration et dès que le QR est désactivé ou renouvelé (404/410) ; elle n'est montrée que si le serveur ne répond pas. Elle n'entre pas dans la copie chiffrée (le jeton est dans l'adresse).

## Chiffrement : ce que cela protège, et ce que cela ne protège pas

- **Valeurs** : AES-GCM 256, clé générée sur l'appareil, **non extractible** (`extractable: false` : le navigateur ne la rend jamais en clair), stockée dans IndexedDB. Vecteur d'initialisation aléatoire à chaque écriture ; le nom de l'entrée est lié au chiffré (données authentifiées) : une entrée échangée ou altérée est refusée et supprimée.
- **Noms** : « hachés » par HMAC-SHA-256 avec une seconde clé non extractible (un hachage simple se devinerait en essayant les adresses de l'API). **Le contenu n'est pas haché** : un hachage est à sens unique et ne se relit pas ; il est chiffré. Restent en clair : l'espace concerné (`identity`, `patient`, `professional`, `establishment`) et les dates, nécessaires au nettoyage.
- **Effacer la base efface aussi les clés** : toute copie du disque faite avant devient illisible pour toujours.
- **Limite honnête** : la clé vit sur le même appareil. Cela protège contre la lecture du stockage (copie du profil du navigateur, outil d'inspection du disque). Cela **ne protège pas** contre une personne qui utilise le navigateur ouvert, ni contre un script injecté dans le site (XSS). Pour aller plus loin : verrouiller la copie par un code ou une biométrie (WebAuthn PRF) — non fait ; décision produit à prendre, surtout pour les espaces professionnel et établissement (données de tiers).

## Effacement

La copie (entrées **et** clés) est effacée : à la déconnexion (tous les écrans, `cleanUpBeforeLogout`), quand le serveur répond « session absente », au changement de compte (un autre compte repart de zéro), au changement d'espace, à la connexion/déconnexion (écritures sous `/api/v1/identity/` hors `me/`), à la désactivation du réglage, et par « Effacer de cet appareil ». Un changement de profil actif (patient/enfant) ou d'établissement actif efface tout **sauf l'identité du compte** : le profil actif est choisi côté serveur, une copie sans profil dans sa clé ne doit jamais être montrée sous le nom d'un autre. L'application ne change jamais d'elle-même le profil actif pour le copier (ce changement est journalisé côté serveur et appartient à la personne) : la copie n'écrit rien côté serveur et ne modifie jamais le profil actif.

## Réglage

Rubrique **Hors connexion** des paramètres, dans **les trois espaces** (`OfflineDataToggle`, `audience="third-party"` pour les espaces professionnel et établissement). Actif par défaut (`OFFLINE_CACHE_DEFAULT_ENABLED` / `OFFLINE_DECLARATIONS_DEFAULT_ENABLED` dans `lib/offline-policy.ts` : à passer à `false` pour exiger un accord préalable, à envisager pour les données de tiers). Couper le réglage efface la copie ; le préchauffage des coquilles s'arrête.

## Anciennes copies

L'ancienne copie **en clair** des déclarations (`ecarnet-offline-v1`, enregistrement `current`) n'est plus écrite et est **effacée au démarrage de chaque espace** (`OfflineCacheKeeper`). Le réglage (`prefs`) de cette base est conservé et sert d'interrupteur à la nouvelle copie. `lib/offline-sync.ts`, `lib/offline-snapshot.ts` (hors réglage) et `public/hors-connexion.js` ne servent plus qu'au repli `/hors-connexion.html` ; à retirer après recette.

## Aucune écriture hors connexion

Modifier, confirmer, révoquer, créer, envoyer un document : tout exige le réseau. Il n'existe ni file d'écriture ni synchronisation montante.

## Notifications push

L'abonnement est retiré du navigateur et du serveur à chaque déconnexion (patient, médecin, établissement, administration), avant la fin de la session : `lib/logout.ts`.

## Tests

`tests/hors-connexion-2026-11-05.test.mjs` (règles, chiffrement réel sur faux IndexedDB, relais `fetch`, routes préparées, branchement), `tests/service-worker-2026-11-02.test.mjs` (service worker dans un bac à sable : coquilles, préchauffage, assets), `tests/hors-connexion-2026-11-02.test.mjs` (carte d'urgence, déconnexion, textes). **Non vérifié ici** : essais sur appareils réels — rechargement d'un écran privé en mode avion après préchauffage, Wi-Fi sans Internet (le bandeau doit apparaître après deux échecs), iOS (PWA installée) et Android, `next build` (polices Google inaccessibles dans l'environnement de test).
