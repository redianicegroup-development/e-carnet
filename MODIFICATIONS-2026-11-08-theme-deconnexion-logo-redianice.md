# 2026-11-08 — Thème à la déconnexion, logo Redianice, bouton « remonter »

Base : e-carnet_V_1_7 + overlay `acces-qr` (déjà fusionné).

## Thème (palette et police)
- Règle : déconnecté = palette Miel et police par défaut, y compris sur les pages publiques ; connecté = préférences du compte, sur toutes les pages.
- Cause : la copie locale du thème du dernier compte n'était jamais oubliée à la déconnexion, et le chargement du thème n'était fait qu'une fois par rechargement complet.
- `lib/themeStorage.ts` : `resetThemeToDefault()` (oublie le compte actif, applique le défaut, prévient l'application) et `announceAuthChange()`.
- `lib/logout.ts` : `cleanUpBeforeLogout()` remet le thème par défaut en premier (les 5 déconnexions passent par là).
- `components/ThemeBootstrap.tsx` : 401/403 = visiteur → thème par défaut ; recharge à la connexion, à la déconnexion et au retour depuis le cache du navigateur ; hors connexion, la copie locale est conservée.
- `components/AuthForms.tsx` : à l'ouverture de l'espace, recharge les préférences du compte.

## Logo Redianice (guide de marque)
- `public/brand/redianice-logo.png` (masque, prend la couleur du texte) et `redianice-logo-stack.webp` (carte au survol).
- Crédits : nœud « Redianice » du schéma d'équipe et carte « Les structures ». À propos : section « L'équipe ».
- Pied de page : « Créé par Redianice » reçoit le même logo au survol, au toucher et au clavier qu'AKATech Studio (`CreditReveal`).

## Bouton « remonter »
- Cause : `body .button { position: relative }` (soft-skin) l'emportait sur `body .public-scroll-top { position: fixed }` : le bouton restait dans le flux, collé à gauche.
- `soft-skin.css` : règle plus spécifique, fixé à droite, au-dessus du bouton d'avis.

## Tests
- Mis à jour : `site.test.mjs`, `hors-connexion-2026-11-02.test.mjs`. Ajouté : `theme-deconnexion-2026-11-08.test.mjs`.
- Suite : 386 réussis, 1 échec déjà présent avant (`un seul centre d'aide…`), typecheck propre.
