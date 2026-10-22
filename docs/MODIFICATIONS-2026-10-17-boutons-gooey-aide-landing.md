# Trois types de boutons, gooey partout, centre d'aide unique, landing en six sections — 17 octobre 2026

Base : `e-carnet_v15.zip` (peau minimaliste et neumorphique `soft-skin.css`, récupération de compte). Rien de ta v15 n'est écrasé : ta peau reste la matière du carnet, les ajouts viennent par-dessus. Livré en deux ZIP : le projet complet (`e-carnet_v16.zip`) et le ZIP différentiel avec son manifeste.

## 1. Carte « Préparez votre prochaine consultation » illisible (capture fournie)
- Cause : `.cta-card` (globals.css) pose un texte blanc (`--on-primary`) prévu pour un fond d'accent ; la peau douce a donné aux cartes le fond du thème (`body .card`), qui l'emporte : texte blanc sur crème.
- Correction dans `soft-skin.css` : `body .cta-card` prend `color: var(--text)`, `.muted` en `--text-muted`, pastille « Avant votre rendez-vous » à la matière du fond. Valable pour les cinq palettes.
- Le bouton « Préparer ma consultation » devient le bouton principal de la carte (`button primary`). Vérifié au rendu (navigateur sans interface) avec le CSS final.
- Contrôle fait sur le reste de l'app : aucune autre carte ne garde un texte clair sur le fond du thème.

## 2. Trois types de boutons, partout
| Type | Classe | Rôle |
|---|---|---|
| Principal | `.button.primary` | la seule action mise en avant d'un écran |
| Secondaire | `.button` | toutes les autres actions |
| Discret | `.button.ghost` (+ retour, œil, croix) | actions de second plan |
`danger` est une couleur (`.button.danger` = secondaire à texte rouge ; `.button.primary.danger` = confirmation destructive), `small` et `block` sont des tailles.
- Passent par `.button` : connexion (`.ax-submit`, `.ax-social`), récupération de compte, installation (`.pwa-install-button`), avis flottant (`.feedback-fab`), bannière cookies (accepter / refuser), confirmations. Leurs CSS ne gardent que mise en page et position (fond, ombre, rayon supprimés).
- La confirmation destructive est le bouton principal en rouge : plus de rouge plein propre à `.modal-confirm`.
- Un seul rayon, une seule matière, un seul état enfoncé ; `aria-pressed` donne l'état creusé (filtres, choix cookies).

## 3. Gooey = identité du carnet : bouton, modal, confirmation
- `app/goo.css` (nouveau, chargé après `soft-skin.css`). La peau reste sans pseudo-élément (ton test) : le mouvement a son fichier.
- **Bouton** : la face se forme en gélatine (transform/opacité) pendant que trois gouttes affleurent le bord haut puis se fondent (`::after`, filtre `#ecarnet-gooey-soft`).
- **Modal et confirmation** : `ui/GooLayer.tsx` pose sous le panneau un calque `aria-hidden` (une goutte naît sous le panneau, le déborde un instant, s'y fond). Calé sur la taille réelle du panneau (`offset*`, insensible à l'animation d'entrée) et suit ses changements de hauteur (`ResizeObserver`). Posé dans : confirmations, fenêtre de connexion, paramètres, avis, deux enquêtes.
- Bannière cookies et annonce d'accueil : même gélatine de panneau, sans calque (elles ne bloquent pas la page).
- Le filtre ne touche jamais de texte. `prefers-reduced-motion: reduce` : aucun calque, aucune animation, mêmes états finaux. L'écran de connexion orchestre déjà son entrée (GSAP) : ses boutons gardent les gouttes, pas la gélatine.

## 4. Centre d'aide unique : `/aide`
- Avant : deux pages (`/faq` = guides relus par les juristes ; `/aide` = 23 Q/R écrites en dur, dont « révoquer à tout moment », formulation que le test n'attrapait pas car il ne lisait que `helpContent.ts`).
- Maintenant : `/aide` = `HelpCenter` sur `helpContent.ts` seul. `/faq` → 308 vers `/aide` (`next.config.ts`) ; page, sitemap, `llms.txt`, `manus-routes.json`, en-tête, pied de page, paramètres, établissement : tout pointe vers `/aide`. Ancres : `#patient`, `#professional`, `#establishment`, `#donnees`, `#questions`…
- Nouveautés : recherche instantanée (sans accents), choix du profil qui filtre guides, questions et dépannage, rubriques cliquables, résultat annoncé (`aria-live`), état vide avec issue de secours, bloc contact. Contenu complet sans JavaScript (la recherche ne fait que réduire).
- Contenu : 17 → 28 questions, 6 rubriques (Premiers pas, Accès, Comptes et rôles, Compte et préférences, Données et sécurité, Questions et retours).

### À faire relire (juristes)
Le dossier de revue citait `/faq` : le texte relu y est inchangé, mais 11 réponses sont nouvelles (venues de l'ancienne `/aide` ou de la landing) et « Qui ouvre un établissement ? » est remplacée par « Comment ouvrir l'espace de mon établissement ? ». Nouvelles : À quoi sert Mon E-Carnet ? · Comment créer un compte… · Puis-je l'utiliser sur mon téléphone ? · Comment ouvrir l'espace de mon établissement ? · Comment un médecin rejoint-il un établissement ? · Comment modifier mon nom ou ma photo ? · Comment changer l'apparence… · Où gérer mes méthodes de connexion… · Quelles données de fréquentation sont collectées ? · Où poser une question… · Quand une enquête peut-elle apparaître ? · Que deviennent mes retours ?
Les tests interdisent toujours « à tout moment », « 100 % », « garanti », « médecin vérifié ».

## 5. Landing : six sections
Hero → Le carnet en pratique → Comment ça marche → Pour qui → Confiance + FAQ → Contact + appel à l'action.
- Bande de repères supprimée : « 5 min » et « 2 h » vivent dans les cartes QR et Autorisations ; les deux prolongations d'une heure sont dans le texte.
- Six fonctionnalités → quatre cartes (carnet, QR, autorisations, historique) ; pré-consultation et consultations validées sont dans les moments. Cinq étapes → trois : Préparez, Autorisez, Retrouvez.
- Numéros 01-06 et rubriques en capitales retirés des titres ; un seul bouton principal par bloc.
- **FAQ : six questions** (vraies données, accès automatique, refuser, professionnel vérifié, protection, téléphone), recopiées mot pour mot depuis l'Aide (test). Plus de filtres ni de rubriques ; lien « Toutes les réponses » vers `/aide`. Les 9 autres questions sont dans l'Aide.
- Appel à l'action final fusionné avec le contact (une section) ; section « Évaluations » retirée de la page (elle était masquée sous 30 réponses mais interrogeait l'API à chaque visite) ; pouls final et animation associée retirés.
- `FAQPage` (données structurées) = exactement les six questions affichées.

## Tests
`tests/boutons-gooey-aide.test.mjs` (nouveau, ajouté à `npm test`) : trois types, anciennes classes sans style propre, calque gooey sur chaque modal, carte lisible, `/faq` redirigé, ancres existantes, aide cherchable, landing à six sections. Adaptés : `landing.test.mjs` (6 questions mot pour mot, repères dans les cartes), `site.test.mjs` (`/aide` au lieu de `/faq`). 105 tests passent ; `tsc --noEmit` propre.

## Ce qui n'a pas pu être vérifié ici
- `next build` compile (webpack) mais avec des polices Google simulées : le bac à sable n'a pas accès à fonts.googleapis.com. Refais un `npm run build` chez toi.
- Rendu contrôlé dans un navigateur sans interface (téléphone 390 px) : landing, aide, carte corrigée, avec animations coupées ; les animations gooey ont été regardées image par image sur la fenêtre d'avis. Pas de mesure de performance sur téléphone d'entrée de gamme : le filtre SVG des modals (≈ 0,9 s, une fois à l'ouverture) est le point à surveiller.
- Non touché : backend, récupération de compte (v15), migrations.

## Fichiers
Nouveaux : `app/goo.css`, `components/ui/GooLayer.tsx`, `components/help/HelpParts.tsx`, `components/help/HelpBrowser.tsx`, `tests/boutons-gooey-aide.test.mjs`. Supprimés : `app/faq/page.tsx`, `app/carnet-skin.css` (plus importé depuis la v15).
