# Fusion de « 1.9 pilule + réveil » dans la 1.10 — 14 octobre 2026

## Base et méthode

Base : `e-carnetv_1_10.zip`, prise telle quelle. Le diff `e-carnet-v1-9-pilule-reveil-diff.zip` (10 fichiers) a été comparé fichier par fichier à la 1.10. En cas de recouvrement, **la 1.10 l'emporte** ; seul ce qu'elle ne faisait pas déjà a été repris.

## Repris

- **Visiteur anonyme = 403, pas seulement 401.** L'API (`SessionAuthentication` + `IsAuthenticated`) répond 403 à un visiteur non connecté. `SpaceShell` ne traitait que le 401 : un anonyme voyait « Service momentanément indisponible » au lieu d'être renvoyé vers `/connexion?next=…`. Il est maintenant redirigé dans les deux cas.
- `lib/session.ts` (nouveau, sans dépendance) : `isSessionMissing`, testable en Node.
- `tests/session.test.mjs` (nouveau, 3 tests), ajouté au script `test` **en plus** de `ux-flows.test.mjs`.
- `tests/site.test.mjs` : le test « session expirée » cherchait `error.status === 401` ; il cherche `isSessionMissing(error)`.

## Non repris, et pourquoi

- **Navigation en pilule (`sidebar.css`)** : la 1.10 a déjà sa pilule flottante (`.sb__scroll`, entrée active en cercle sombre, libellés masqués, `aria-label` conservés) et son en-tête mobile. Le bloc du diff stylait `.sb__list` comme une pilule : superposé, il aurait donné une pilule dans la pilule.
- **Réveil du serveur (`SpaceShell`, `ServiceWakeNotice`, `service-wake.css`, `loginRedirect`)** : la 1.10 attend déjà le réveil sur place (sonde `/api/v1/health/ready/`, nouvelle tentative toutes les 2 s, 2 min au plus, bouton « Réessayer »). Le diff faisait l'inverse, en redirigeant vers `/connexion?reason=waking`. Les deux ensemble se contrediraient, et `ServiceWakeNotice` n'aurait plus aucun point d'entrée.
- `connexion/page.tsx` : inchangé, la 1.10 a refait la page (deux volets, `AuthWelcome`).
- `MODIFICATIONS-2026-10-14.md` : celui de la 1.10 est conservé.

## Vérifications

- Web : 49 tests passent (46 de la 1.10 + 3 ajoutés), contre 46/46 sur la 1.10 seule. `session.ts` passe `tsc --strict` isolé.
- Seules modifications dans `SpaceShell.tsx` : un import et une condition. Fins de ligne CRLF conservées.
- **Non vérifié** : `next build`, `tsc --noEmit` et ESLint sur tout le projet (dépendances non installées ici), tests Python (backend non modifié), rendu navigateur, et le 403 contre une vraie API (déduit de la configuration DRF, non exécuté).

## À savoir avant de déployer

Front seulement : aucune migration, aucun changement d'API.
