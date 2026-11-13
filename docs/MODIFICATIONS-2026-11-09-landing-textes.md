# Modifications du 09/11/2026 — landing, passes 2 à 4 : textes, vitrine, carte, parcours, CTA, contact (hero et pied de page inchangés)

Archive complète : e-carnet_V1_9.zip (V1.8 + ces changements). Les fichiers devenus inutiles sont déjà supprimés.

## 4e passe (dernière demande)
1. **Carte d'urgence** : la fausse carte (« Exemple fictif », Pénicilline, faux QR) est remplacée par la **vraie carte de l'application** (`EmergencyCardVisual`), toutes les valeurs masquées par `xxxxxxxxxx`, avec l'avatar du titulaire. Elle est dans `landing2/MaskedEmergencyCard.tsx` (composant client : la carte embarque `qrcode.react`). Sur téléphone, elle grandit avec son contenu et ses textes sont plus lisibles (la carte de l'application garde un 16/9 trop serré ici).
2. **Rebond léger** sur « Proche de confiance » et « Profil enfant » (`@keyframes lp2-bounce`, 4,2 s, décalé de 0,9 s entre les deux, coupé si l'animation est réduite).
3. **Sections retirées** : « Chaque information dit d'où elle vient » (rangée) et « C'est vous qui décidez qui lit votre carnet » (texte + démonstration d'accès).
4. **Parcours en trois étapes** : le faux téléphone dessiné en CSS est remplacé par de vraies captures détourées : étape 1 pré-consultation (`hand-motif.webp`), étape 2 QR temporaire (`hand-qr.webp`), étape 3 accueil du carnet (`hand-accueil.webp`, l'ancienne capture « Partager en QR »). **« Solution »** : sa 3e capture est maintenant l'écran du QR temporaire (même `hand-qr.webp`).
5. **Appel final** : carte sombre, un seul bouton principal pleine largeur (« Créer mon carnet → », qui garde l'effet gel/gooey sur fond clair), la connexion passe en lien (« Déjà un compte ? Se connecter »), 3 lignes courtes, la phrase « informations exactes… » en petit.
6. **Contact** : titre « Une question ? Écrivez-nous. » et une ligne ; les deux lignes d'explication et le bandeau « Vos informations restent sous votre contrôle » sont retirés ; Prénom et Nom côte à côte, message plus court. `#contact` mène toujours au formulaire.

## 3e passe — vitrine
Tuiles de bénéfices 8 → 4 ; plus de durées dans les étapes (« Le QR est temporaire et ne sert qu'une fois ») ; section « doutes » retirée ; intro de « Solution » raccourcie.

## 2e passe — titres
Votre santé, enfin réunie au même endroit. · Un carnet par enfant, une fiche d'urgence pour vos proches. · Une consultation en trois étapes, sans repartir de zéro. · Appel final : « Ouvrez votre carnet avant votre prochain rendez-vous. » · Hero : seule l'accroche change (« Réunissez vos informations de santé, remettez votre carnet au médecin et choisissez qui peut le consulter. »).

## Fichiers supprimés
`landing2/{TrustCopy,AccessDemo,FakeQr,ObjectionCards,WhoCards,OfflineBand}.tsx`. Le CSS `.lp2-demo`, `.lp2-guards`, `.lp2-trust`, `.lp2-obj*` et `.lp2-phone` est devenu inutile et n'a pas été retiré.

## Images
Nouvelles : `public/landing/hand-motif.webp`, `hand-accueil.webp`, `carte-titulaire.webp`. Remplacée : `hand-qr.webp`. Les deux visuels (QR, pré-consultation) ont été détourés automatiquement depuis tes images : à vérifier à l'œil sur les contours.

## À faire relire
Le hero dit toujours « Aucun accès sans votre choix » : cela ne mentionne pas l'ouverture d'urgence par un administrateur d'établissement (ETA-09, avec motif et audit).

## Vérifications
Suite complète : 377 verts sur 381. Les 4 échecs existaient déjà dans la V1.8 (un seul centre d'aide, hors-connexion, navigation, cache du thème) et sont sans rapport. Le test « le message est le bon », qui échouait à cause de `WhoCards`, passe maintenant. Syntaxe des fichiers modifiés vérifiée avec esbuild ; rendu mobile et bureau de la carte, du CTA, du formulaire et du parcours vérifié sur une maquette statique avec les CSS du projet. `next build`, `tsc` et `eslint` non lancés (pas de `node_modules`) : à lancer avant déploiement.
