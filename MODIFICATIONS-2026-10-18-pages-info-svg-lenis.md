# Mon E‑Carnet — pages d'information : UX/UI, SVG animés et Lenis (base : `e-carnet_v2.zip`)

Pages concernées : **mentions légales, confidentialité, CGU, conditions de rattachement, crédits, à propos**. Aucune migration, aucun changement d'API, aucune nouvelle dépendance.

## À faire

1. Décompresser à la racine du dépôt en préservant les chemins (6 fichiers de v2 sont remplacés par leur version fusionnée, voir plus bas).
2. `cd apps/web && npm test` : 103 tests, dont les 9 nouveaux de `tests/info-pages.test.mjs`.
3. `npm run lint` et `npm run build`.

## Ce qui change

| Zone | Changement |
|---|---|
| Pages légales | Sommaire **collant** à gauche (≥ 1040 px) qui met en valeur la rubrique à l'écran ; sur mobile, sommaire **repliable** (« 19 rubriques »). Sections numérotées, la section active s'accentue. En-tête avec puces (version, date, durée de lecture calculée), feuille illustrée animée, bandeau « version provisoire » avec icône, résumé à coches, « À lire aussi » en puces. Barre de progression sous l'en-tête et bouton « Haut de page ». |
| Lenis | Les liens d'ancre (sommaire, « Retour en haut ») glissent jusqu'à la cible sous l'en-tête, avec le hook `useSmoothScroll` existant. Le sommaire collant défile seul s'il est plus haut que l'écran (`data-lenis-prevent`). |
| Schémas SVG animés | **Mentions** : chaîne navigateur → Vercel → Render → Neon (noms et rôles lus dans `HOSTS`). **Confidentialité** : qui peut recevoir quoi ; cookies nécessaires / mesure facultative avec interrupteur (noms lus dans `COOKIES`). **CGU** : rôles (patient, professionnel, établissement, éditeur) ; parcours d'accès en 4 étapes (durées lues dans `TECH_VALIDITY`). **Rattachement** : 4 étapes après la saisie du code médecin. **À propos** : carnets papier (dont un perdu) face à un historique continu, fil de santé animé, schéma des rôles. **Crédits** : organigramme (Redianice, 4 rôles, AKATech Studio), signe de la marque dont l'interrupteur glisse, pile technique. |
| Conditions de rattachement | La page est maintenant dans le site (en-tête, pied de page, retour) au lieu d'une page isolée. |
| Mouvement | Réservé à `prefers-reduced-motion: no-preference`. Sans JavaScript ou en mouvement réduit : tout est affiché, rail plein, aucun état caché posé par le CSS. Le sommaire actif, la durée de lecture et la barre de progression restent actifs en mouvement réduit (aide à la lecture). |
| Accessibilité | Chaque schéma a un résumé lu à voix haute (`role="img"`) et une légende normale. Les blocs d'étapes répètent un texte déjà écrit : masqués aux lecteurs d'écran. |

## Fichiers

- **Nouveaux** : `app/info-pages.css`, `components/motion/InfoPageMotion.tsx`, `components/public/figures/*` (parts, ActorsFigure, AboutChainFigure, HostingFigure, RecipientsFigure, CookiesFigure, CreditsFigures, DocHero, Steps), `tests/info-pages.test.mjs`.
- **Modifiés, repris de ma version** : `LegalDocument.tsx`, `credits/page.tsx`, `conditions-rattachement/page.tsx`, `site-pages.css` (anciennes règles du sommaire et de `about-chain` retirées).
- **Fusionnés avec v2** (v14 → ma version → v2) : `a-propos/page.tsx`, `cgu/page.tsx`, `confidentialite/page.tsx`, `mentions-legales/page.tsx`, `layout.tsx` (import de `info-pages.css` avant `soft-skin.css`), `package.json` (mon test ajouté à la fin du script `test` de v2).

## Points d'attention (dans le texte de v2, non modifiés ici)

- `cgu/page.tsx` ligne 16 : « seules des utilisez des informations exactes… » (phrase cassée).
- `cgu/page.tsx` ligne 31 : « La version actuellement disponible est une version actuellement disponible » (remplacement automatique), et la même phrase dit encore que le service « n'est pas destinée à recevoir des dossiers de santé réels ».
- `confidentialite/page.tsx` ligne 19 et `mentions-legales/page.tsx` ligne 56 : « Le service protège les informations… » est une promesse ; le reste des pages légales évite ce type de formulation.
- `tests/emergency-card.test.mjs` échoue **déjà sur v2 seul** (le CSS de la carte d'urgence ne contient plus `.ecard__body { … grid-template-columns: minmax(0, 1fr) auto }`). Sans lien avec ce lot.

## Vérifié

`tsc --noEmit` propre ; 103 tests, 102 passent (l'échec ci-dessus est antérieur) ; rendu contrôlé dans Chromium (mobile 390 px et bureau 1280 px) sur les six pages avec la peau `soft-skin` : Lenis actif, schémas dessinés au défilement, aucun débordement horizontal. Le build complet n'a pas pu être lancé ici (polices Google non joignables) ; il tourne en mode développement.
