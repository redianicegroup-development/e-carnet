# Modifications du 09/11/2026 — refonte de la landing (hors hero et pied de page)

Hero et pied de page : **inchangés** (vérifié par comparaison avec la V1.7.4).

## Principe (message validé)
Un **infirmier prépare la pré-consultation depuis l'espace patient** (le patient ne la fait pas lui-même) ; **sinon, le médecin consulte directement** : il scanne le QR du patient depuis son espace professionnel, lit le carnet, puis établit ses **préconisations**, qui rejoignent le carnet une fois la consultation validée.

## Nouvel ordre (anatomie d'une landing, sans bandeau logos ni témoignages)
1. Hero (inchangé)
2. **Problème** (`ProblemSection`, bande sombre, trois constats) — ancre `#probleme`
3. **Solution** (`SolutionSection`, composant client) : trois **vraies captures détourées** (main + téléphone, fond retiré) reliées à trois lignes cliquables ; défilement automatique tant qu'on n'a pas choisi, jamais si l'animation est réduite — `#solution`
4. **Bénéfices** : `ToolTiles` (titres orientés bénéfice, nom de la fonction en dessous, tuile « Préconisations » à la place de « Pré-consultation ») puis `DetailRows` — `#fonctionnalites`
5. **Comment ça marche**, trois étapes : L'infirmier prépare (facultatif) / Le médecin scanne votre QR / Vous retrouvez ses préconisations (`FlowSection`, `flowParts`) — `#parcours`
6. **Rôles** (`RoleCards` lit désormais `PROFILES` : une seule source du texte) — `#profils`
7. **Objections** (`ObjectionCards`, 4 doutes) puis démonstration d'accès (`TrustCopy` + `AccessDemo`) puis FAQ (`FaqSection`, nouveau titre « Encore une question ? ») — `#objections`, `#questions`
8. **Appel final** (`ContactSection`) : nouveau titre et trois lignes de valeur (`FINAL.points`)

## Fichiers
- Nouveaux : `ProblemSection.tsx`, `ObjectionCards.tsx`, `public/landing/hand-carnet.webp`, `hand-preconsultation.webp`, `hand-qr.webp` (WebP transparent, 900×1272, ~110 Ko chacun)
- Réécrit : `SolutionSection.tsx` (devient un composant client avec `next/image`)
- Supprimés : `WhoCards.tsx`, `OfflineBand.tsx` (la lecture hors connexion devient une objection)
- Modifiés : `page.tsx` (ordre, description meta), `landing-content.ts` (FEATURES[0], STEPS, PROFILES, FINAL), `ToolTiles.tsx`, `DetailRows.tsx`, `flowParts.tsx`, `RoleCards.tsx`, `TrustCopy.tsx`, `FaqSection.tsx`, `ContactSection.tsx`, `landing-v2.css`, `landing-showcase.css`
- Tests : `landing-v2-2026-11-08.test.mjs` (ordre et ancres mis à jour, 3 tests ajoutés : message infirmier/QR, captures, ordre de la landing)

## Non modifié volontairement
- Les 6 réponses de la FAQ (texte relu par les juristes, identique mot pour mot au centre d'aide).
- Le texte du hero : sa phrase d'accroche dit encore « préparez vos consultations » (`HERO.lead`) et l'image décrit « Patient et infirmière préparent une consultation ». À reformuler si le message doit être cohérent de bout en bout.
- Les écrans réels de l'application. **À savoir :** dans `PatientConsultationFlow.tsx`, le QR de 5 minutes « n'apparaît qu'une fois la pré-consultation enregistrée ». La landing annonce aussi le cas « sans infirmier, le médecin consulte directement avec le QR » : l'application doit le permettre pour que le message soit exact.

## Vérifications
- Tests : `landing`, `landing-v2`, `donnees-reelles`, `boutons-gooey-aide` verts, sauf « un seul centre d'aide » (rouge déjà présent en V1.7.4). `hors-connexion-2026-11-02` n'a pas pu tourner (paquet `typescript` absent de l'environnement).
- Rendu : contrôlé sur un aperçu statique (bureau 1280 px, mobile 390 px, aucun débordement). `next build`, `tsc` et `eslint` n'ont pas pu être lancés ici (pas de `node_modules`) : à lancer avant déploiement.
