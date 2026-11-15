# 15/11/2026 — Héro (texte centré, 3 carrés dans le titre), CTA, mains uniformes, pages à jour → V1_17

Base : `e-carnet_V1_16-merge.zip` (qui contient la V1_15 « codes / laboratoire interne »). Aucune modification du backend, aucune migration.

**Vérifications**
- `tsc --noEmit` propre ; ESLint : 0 erreur sur les fichiers touchés (3 avertissements `<img>` d'avatars, déjà présents).
- Web : 505 tests, **13 échecs, exactement les mêmes que sur la V1_16 d'origine** (aide/`boutons-gooey`, copie hors connexion ×7, `legal.test` ×2 — fichier `apps/api/.env.production.example` absent du zip —, 3e onglet, crédits et logo Redianice). 7 tests ajoutés (`landing-hero-2026-11-15.test.mjs`), tous verts.
- **Rendu réel contrôlé** dans Chromium (serveur de développement) à 1440 × 900, 820 × 1180 et 390 × 844 : départ, 35 %, 90 %, 150 % et 230 % du défilement ; mouvement réduit ; rotation des diaporamas relevée toutes les 0,75 s sur 15 s. Limite : les polices Google n'étaient pas joignables dans ce poste (police de repli), les retours à la ligne du titre peuvent donc différer légèrement avec Sora / Bricolage. `next build` non lancé.

## 1. Héro
- **Texte centré** (pastille, titre, phrase, boutons, note), sur ordinateur et mobile ; le bloc est centré verticalement.
- **Trois petits carrés dans le titre** : « de [■] santé », « sous [■] votre » (deux diaporamas) et « votre [■] contrôle » (point de départ de l'image du héro).
- **Diaporamas** (`components/landing/HeroTitle.tsx`) : 5 photos (vos images d'hôpital recadrées en carrés 480 × 480, `public/landing/hero-slide-1…5.webp`), une nouvelle photo **toutes les 4 s** par carré, les deux carrés décalés de 2 s, ordre aléatoire, **jamais la même photo dans les deux carrés** ni deux fois de suite dans le même ; la nouvelle photo glisse par la droite. Immobiles si « réduire les animations » est activé ; en pause quand l'onglet est caché ; décoratifs (`aria-hidden`, `alt=""`), le titre lu reste « Votre carnet de santé, sous votre contrôle. ».
- **Image du héro** : elle démarre dans le petit carré « votre / contrôle » (taille et position **mesurées** sur le carré réel, clip-path carré arrondi) puis grossit au défilement jusqu'au plein cadre, puis redevient une grande carte à la fin, comme avant (`LandingMotion.tsx`, recalcul au redimensionnement et au chargement des polices).
- Le titre n'est plus découpé par SplitText (il réécrivait le DOM des diaporamas) : chaque mot monte de derrière un cadre découpé en CSS. Les titres de section gardent SplitText.
- **Repli sans animation** (mouvement réduit, JavaScript coupé) : le carré « votre / contrôle » n'existe pas, l'image reste en carte dans le coin bas-droit, le texte reste en haut sur mobile pour ne pas la recouvrir.
- Photos du héro PC et mobile remplacées par celles que vous avez envoyées (`hero-desktop.webp` 1672 × 941, `hero-mobile.webp` 941 × 1672) ; texte alternatif mis à jour.

## 2. Appel final (CTA)
- `public/landing/cta-carnet.webp` remplacé par l'image 1 (homme à la veste bleue qui tend son téléphone, 1254 × 1254). Mise en page inchangée.

## 3. Photos « mains qui tiennent un téléphone » (zip landingee)
- Les cinq images (`hand-accueil|carnet|motif|preconsultation|qr.webp`) ont **la même taille (900 × 1272)** et le téléphone y a **la même surface et le même centre** ; elles sont dans la landing.

## 4. Modals et pages (demandes du 14/11)
- Modals succès / erreur : même structure et mêmes illustrations SVG que les modals de confirmation (vérifié). **Modal de bienvenue** : l'arrière-plan est maintenant flouté pendant son affichage (`modal.css`, repli sans `backdrop-filter`, fondu d'entrée et de sortie).
- Retour d'avis : « Donner votre avis » → **« Noter l'application »** (bouton de la landing et section des 4 paramètres). Les deux tests qui attendaient l'ancien libellé sont mis à jour. Le formulaire n'a pas d'étoiles : « Noter » est ici un libellé, pas un système de notation.
- **Aide / questions des paramètres** à jour : mot de passe temporaire de 7 jours (plus d'invitation de 48 h), première connexion, rattachement du laboratoire de l'établissement, ce que voit un laboratoire, partage d'un code ou d'un mot de passe temporaire. `StaffProfessionalVerification` : texte aligné.
- **Mentions légales / confidentialité / CGU** : `terms` et `privacy` passent à la version `2026-11-14-v5` ; traitement du laboratoire, QR d'examen (14 jours par défaut), mot de passe temporaire (7 jours, conservé sous forme d'empreinte), bouton Partager, e-mails, tableau des durées. La page « Mentions légales » n'a pas changé.

## À savoir
- Les **informations de l'éditeur** des mentions légales (`FIELD_VALUES` dans `lib/legal/config.ts`) sont toujours vides : à renseigner. Les textes juridiques restent **provisoires** tant qu'une relecture juridique n'est pas faite.
- Chaque carré photo du titre charge les 5 images via `next/image` (petites variantes, quelques Ko chacune).
- À regarder sur un vrai téléphone : le titre sur 4 lignes en 390 px, et le départ de l'image dans le carré.
