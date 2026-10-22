# Fusion de la landing dans la v11 — 15 octobre 2026

**Base prioritaire : `e-carnet_v11.zip`.** Lot fusionné : `e-carnet-landing-updated-files.zip` (landing complète, FAQ, formulaire de contact), construit à l'origine sur la 1.9. La description de la landing est dans `MODIFICATIONS-2026-10-15.md` (inchangée). Ce document ne décrit que la fusion.

## Principe

Le lot landing avait été produit sur une base plus ancienne que la v11. Un simple écrasement aurait supprimé des ajouts de la v11. Chaque fichier a donc été comparé à la v11 : remplacé seulement quand la version landing ne retirait rien de la v11, fusionné à la main sinon.

## Fichiers nouveaux (12, copiés tels quels)

`contact_views.py`, migration `0016_contactmessage.py` (s'enchaîne sur `0015_accountprofile_recovery_method`, seule feuille), `test_contact.py`, `landing-showcase.css`, `ContactSection.tsx`, `FaqSection.tsx`, `HeroScene.tsx`, `PhoneMock.tsx`, `lib/contact.ts`, `lib/landing-content.ts`, `tests/contact.test.mjs`, `tests/landing.test.mjs`.

## Fichiers remplacés par la version landing (11)

La version landing ne retire rien de la v11 (ajouts seulement) ou réécrit un bloc que la v11 n'avait pas modifié depuis la base : `admin.py`, `models.py`, `urls.py` (identity), `client.ts` (`ApiError.details`), `aide/page.tsx` (2 phrases renvoyant au formulaire), `PublicHeader.tsx`, `page.tsx`, `landing.css`, `landing-immersive.css`, `LandingMotion.tsx`, `useSmoothScroll.ts`.

## Fichiers fusionnés à la main (6) — là où l'écrasement aurait cassé la v11

| Fichier | Conservé de la v11 | Ajouté depuis la landing |
|---|---|---|
| `config/settings.py` | limites `qr_create` (30/h) et `emergency_card_public` (120/h) | limite `contact` (5/h), `ECARNET_CONTACT_NOTIFY_TO` |
| `.env.example` | `ECARNET_RATE_QR_CREATE`, `ECARNET_RATE_EMERGENCY_CARD` | `ECARNET_RATE_CONTACT`, `ECARNET_CONTACT_NOTIFY_TO` |
| `apps/web/package.json` | tests `ux-flows`, `session`, `emergency-card`, `fusion-correctifs` (fins de ligne CRLF conservées) | tests `contact`, `landing` |
| `PublicShell.tsx` | lien « Gérer les cookies » (import `CookiePreferencesLink`) | prop `bleed`, lien « Nous contacter » |
| `tests/site.test.mjs` | assertions récentes (`isSessionMissing`, `WelcomeCharacter`) et CRLF | une seule assertion modifiée : la FAQ vit maintenant dans `FaqSection` |
| `docs/CHANGELOG.md` | tout l'historique | entrée « 2026-10-15 — landing » ajoutée en tête |

## Ajout après fusion : case de consentement du formulaire de contact

Demandé après la fusion. Le formulaire affiche une case **obligatoire**, décochée au départ : « J'ai lu la politique de confidentialité et j'accepte que mon nom, ma coordonnée et mon message soient enregistrés pour que l'équipe puisse me répondre. » (remplace l'ancienne notice sous le bouton).

- **Navigateur** : l'envoi est bloqué tant qu'elle n'est pas cochée ; message d'erreur sous la case, focus dessus ; l'erreur disparaît dès qu'on coche ; la case repart décochée après chaque envoi. Le lien vers la politique s'ouvre dans un nouvel onglet pour que le visiteur ne perde pas ce qu'il a saisi. Pas d'erreur au simple passage au clavier : seulement à l'envoi.
- **API** : `consent` doit être le booléen JSON `true` (ni `"true"`, ni `1`, ni `"on"`). Sinon : 400, erreur `consent`, rien d'enregistré, pas d'e-mail de notification. Un appel direct à l'API ne peut donc pas contourner la case.
- **Preuve** : le consentement n'est pas stocké comme champ à part. Un message n'existe en base que si la case était cochée, à la date `submitted_at`. La version de la politique acceptée n'est pas conservée.
- Fichiers : `lib/contact.ts`, `ContactSection.tsx`, `landing-showcase.css`, `contact_views.py`, `contact.test.mjs`, `test_contact.py`, `CHANGELOG.md`.

## Vérifications

- Tests web (script `test` fusionné) : **79 réussis, 0 échec** — les 59 de la v11 + 20 nouveaux (contact, landing, cohérence FAQ / centre d'aide, consentement). Pour que le test de thème trouve `@ecarnet/ui`, le workspace a été lié comme le fait `npm install`.
- Imports relatifs des fichiers modifiés : tous résolus. Icônes utilisées par la landing : toutes présentes dans `Icon.tsx` de la v11.
- API : compilation Python correcte ; champs du modèle `ContactMessage` identiques à ceux de la migration `0016` ; une seule feuille de migration.

## Non vérifié ici (à rejouer sur la machine de développement)

- **Tests Django** (Django non installé dans l'environnement) — dont les 18 tests de `test_contact.py` (16 d'origine + 2 pour le consentement) — et `makemigrations --check`.
- **`tsc`, ESLint, `next build`** (dépendances non installées, pas de réseau).
- Rendu réel dans un navigateur (hero qui grossit, FAQ, formulaire), avec les vraies polices.

Commandes : `python manage.py migrate` puis `python manage.py test apps.identity` ; dans `apps/web` : `npm ci && npm test && npx tsc --noEmit && npm run lint && npm run build`.

## Points à savoir

1. **En-tête public** : le lien « Aide » est remplacé par « Questions » et « Contact » (choix de la landing). Le centre d'aide reste accessible depuis le pied de page (« Centre d'aide », « Guides et aide ») et le bouton final de l'accueil.
2. **Formulaire de contact et données personnelles** : la case de consentement est en place (voir plus haut). Restent à faire valider par les juristes avant mise en production : le libellé de la case, la mention de ce formulaire dans la politique de confidentialité (elle n'en parle pas encore) et une **durée de conservation** des messages (aucune n'est définie). Le libellé ne promet volontairement aucun droit de retrait, tant que la politique ne le décrit pas.
3. `useSmoothScroll` ne gère plus les ancres via Lenis (`anchors: false`) : la landing les gère elle-même. La page de connexion, qui partage ce hook, n'a aucune ancre de défilement : sans effet pour elle.
4. Déploiement : appliquer la migration `0016` avant d'utiliser le nouveau front (sur Render, la commande de démarrage applique déjà les migrations). Aucun déploiement n'a été lancé depuis cet environnement.
