# 05/11/2026 — Version 1.5 : hors connexion, textes légaux et aide à jour

Base : `e-carnet_V1_4_4.zip`. Cette archive est le **projet complet**. Le dossier `docs/` n'était pas dans l'archive V1_4_4 : il a été rétabli depuis la v1.4.1 et mis à jour (voir « Documentation »).

## 1. Hors connexion (tous les espaces)

| Besoin | Réalisation |
|---|---|
| Bandeau hors connexion / connexion rétablie | `components/network/` (`NetworkProvider`, `OfflineBanner`, `network-banner.css`), monté dans `app/layout.tsx` : toute l'application, pages publiques comprises. Barres collantes décalées sous le bandeau. Un serveur lent ou qui se réveille (Render) ne déclenche jamais « hors connexion ». |
| Plus de « Failed to fetch » | `lib/offline-fetch.ts` : relais `fetch` global (couvre aussi les écrans qui n'utilisent pas `apiGet`) ; erreurs lisibles, toujours des `TypeError`. |
| Copie chiffrée des lectures | `lib/offline-cache.ts` : AES-GCM 256, clé non extractible de l'appareil, noms hachés (HMAC-SHA-256), 7 jours (patient) / 24 h (données de tiers), effacement total avec les clés. Règles : `lib/offline-policy.ts`. |
| Navigation sans réseau | `public/sw.js` v5 : coquilles des écrans gardées par adresse, pages d'information et publiques copiées, préchauffage (`lib/offline-routes.ts`, `lib/offline-warmup.ts`, `components/OfflineCacheKeeper.tsx`). `SpaceShell` lit l'identité depuis la copie sans réseau. |
| Réglage dans chaque espace | Rubrique « Hors connexion » aussi dans les paramètres des espaces professionnel et établissement. |

Chiffrer ou hacher : le **contenu est chiffré** (un hachage ne se relit pas) ; les **noms** des entrées sont hachés. Limite acceptée : la clé est sur l'appareil (protège le stockage, pas un navigateur resté ouvert). Détail : `PWA-HORS-CONNEXION.md`.

## 2. Textes légaux (version `2026-11-05-v3`) et aide

Audit des textes contre le code (modèles Django, réglages, composants). Rien n'est inventé : les champs « [À COMPLÉTER PAR LE CLIENT] » (éditeur, durées de conservation, bases juridiques, juridiction…) restent à compléter et `LEGAL_REVIEW.status` reste `pending`.

- **Politique de confidentialité** : données réellement enregistrées et absentes jusqu'ici ajoutées (documents, vaccinations, mesures de santé, plans de suivi, rappels de médicaments, rendez-vous, prescriptions et examens, carte d'urgence, profils représentés, notifications, avis/messages/enquêtes, demandes sur le compte, récupération de compte, modèles d'établissement) ; prestataires réels (**Cloudinary** pour les fichiers, services de notification des navigateurs) ; **mesure de fréquentation soumise à l'accord** (l'ancien texte disait « dès la première visite ») ; photo de profil chez Cloudinary (le texte disait « dans la base ») ; effets réels de la suppression de compte ; finalités, sécurité et section cookies/stockage (la phrase sur le service worker était devenue fausse).
- **CGU** : objet (fonctions réelles), copie hors connexion, suspension/suppression à l'initiative de l'utilisateur.
- **Mentions légales** : hébergeur de fichiers (Cloudinary), éléments tiers. **Sécurité** : copie hors connexion, mesure soumise à l'accord.
- **Aide** : 9 questions ajoutées ; réponse « hors connexion » réécrite. Landing : réponse « téléphone » mise à jour. `/faq` (doublon de `/aide`, déjà redirigé) supprimée.
- **À faire relire par un juriste avant toute mise en ligne** : ces textes décrivent l'état technique, ils ne valent pas avis juridique.

## 3. Constats à traiter (backend, non modifiés ici)

1. **Photo de profil : adresse devinable.** `identity/auth_views.py` envoie la photo chez Cloudinary avec `public_id = str(user.id)` en livraison publique (`delivery_type="upload"`). Sans `AUTH_USER_MODEL` personnalisé, `user.id` est un entier : l'adresse de la photo de tout compte se devine. Correctif proposé : identifiant aléatoire (`AccountProfile.public_id`).
2. **Photo, logos : non détruits à la suppression du compte** (les documents et les images de cachet/signature le sont). Le texte de confidentialité le dit honnêtement ; correctif : détruire aussi ces fichiers (`cloudinary_storage.destroy` est limité au type `private` : prévoir le type `upload`).
3. **Abonnements de notification** : `anonymize_and_disable_account` ne les supprime pas (la ligne du compte est conservée). À vérifier/ajouter.

## 4. Décisions

- Le chiffrement par clé de l'appareil **ne lève pas** le garde-fou « données réelles » : `REAL_HEALTH_DATA_ALLOWED` reste `false`, le critère de `DONNEES-REELLES-DECISION.md` reste « copie désactivée par défaut **ou** chiffrée avec un code de l'utilisateur ». Le projet reste en phase de test, données fictives uniquement.
- Pro et établissement : copie de 24 h, active par défaut. Pour exiger un accord préalable : `OFFLINE_DECLARATIONS_DEFAULT_ENABLED = false` (`lib/offline-policy.ts`).
- Version `1.5.0` posée sur la racine et `@ecarnet/web`. `@ecarnet/ui` reste `0.1.0` : `@ecarnet/web` le référence par version exacte.

## 5. Documentation

Rétablie depuis la v1.4.1 : tout `docs/`. Mis à jour : `PWA-HORS-CONNEXION.md` (réécrit), `SECURITY.md`, `CHANGELOG.md` (entrée « Version 1.5 »), `ETAT-REEL-PROJET-2026-11-06.md` (passage sur le hors connexion), `DONNEES-REELLES-DECISION.md`, ce fichier. Les autres documents datés gardent leur valeur historique. `README.md` : ligne de version.

## 6. Vérifications

- `tsc --noEmit` : sans erreur ; ESLint sur les fichiers touchés : 0 erreur.
- Tests web : **355 / 355 réussis** (dont 24 nouveaux : `hors-connexion-2026-11-05.test.mjs` et service worker). Les 4 échecs qui existaient dans la V1_4_4 sont résolus : `/faq` dupliquée supprimée, stockage du pied de page déclaré dans la politique et le test, `docs/` rétabli.
- API (Django) : non modifiée, tests non relancés (Django n'est pas installé dans l'environnement de test).
- **Non vérifié** : essais sur appareils réels (mode avion, Wi-Fi sans Internet, iOS PWA installée, Android), `next build` (polices Google inaccessibles dans l'environnement de test). Le service worker n'existe qu'en production : tester avec `next build && next start`.

## 7. Fichiers non inclus

`apps/api/.env` et `apps/web/.env.production.local` (secrets : à recopier depuis ta copie), `node_modules`, `.git`, `*.tsbuildinfo` (cache de compilation).
