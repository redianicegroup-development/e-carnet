# Charte graphique — Mon E‑Carnet (maquettes mobile)

Version du 27/10/2026 · remplace les parties « couleurs » des briefs de direction artistique v3/v4 pour l'app connectée.
Fichiers : `packages/ui/src/styles/tokens.css` (variables) · `apps/web/src/app/mobile-skin.css` (composants) · `docs/prototypes/tokens.css` (copie de référence).

## 1. Principe

Une seule matière, deux familles de couleurs.

- **Matière** : néomorphisme minimaliste (surfaces de la couleur du fond, relief par deux ombres) et effet gooey (goutte qui grandit, calques décoratifs filtrés). Ils sont **conservés tels quels** (`soft-skin.css`, `goo.css`).
- **Couleurs** : l'app connectée n'utilise que le **miel** (`--brand-2` / `--brand-3`) et le **vert** (`--brand-4`), plus l'**encre** (`--text`) et le **fond** (`--bg`). Les nuances viennent des dérivés (§3) : on éclaircit, on n'ajoute jamais une autre teinte (plus de rose, bleu ou violet en pastilles ; ils n'existent que si le patient choisit ce thème).
- **Statuts** : les couleurs sémantiques (vérifié, déclaré, relevé, contesté, expiré, danger) restent fixes et ne dépendent jamais du thème.

## 2. Les cinq thèmes (choisis par le patient)

| Thème | `--brand-1` fond | `--brand-2` | `--brand-3` | `--brand-4` | `--brand-5` encre |
|---|---|---|---|---|---|
| Sauge | #F2F5EF | #D8E2D0 | #A9C4A5 | #5B7F68 | #2C3A33 |
| **Miel (défaut)** | #FFF7E6 | #FFE3B3 | #FFC857 | #4BAA8B | #1E3A34 |
| Violet | #F6F2FF | #E3D7FF | #BCA6F6 | #5D64B8 | #1F2440 |
| Rose | #FFF1F5 | #FFD2DF | #F28AA8 | #B94D6D | #3A1E2A |
| Argile | #FFF4EC | #F6D8C3 | #DDA57A | #4D8F86 | #1D2F33 |

Tout composant lit les variables, jamais un hexadécimal. Les dérivés sont calculés avec `color-mix(in srgb, …)` : ils suivent le thème actif.

## 3. Dérivés de palette (valeurs pour Miel)

| Variable | Calcul | Miel | Usage |
|---|---|---|---|
| `--tone-honey-1` | `--brand-2` | #FFE3B3 | début des orbes miel, bandeaux, cartes teintées |
| `--tone-honey-2` | `--brand-3` | #FFC857 | fin des orbes miel, accent |
| `--tone-honey-deep` | 80 % `--brand-3` + 20 % encre | #D2AC50 | orbe « profond » |
| `--tone-green-1` | 35 % `--brand-4` + blanc | #C0E1D6 | début des orbes vert |
| `--tone-green-2` | 80 % `--brand-4` + blanc | #6FBBA2 | fin des orbes vert |
| `--tone-mint` | 16 % `--brand-4` + blanc | #E2F1EC | bandeau vert clair, fond de puits |
| `--tone-cream` | 45 % `--brand-2` + blanc | #FFF2DD | pastilles douces, badge `.is-soft` |
| `--primary` | thème (≥ 4,5:1 avec `--on-primary`) | #3B826C | boutons, couverture, accent texte |

Orbes (dégradé 145°) : `--orb-honey`, `--orb-green`, `--orb-cream`, `--orb-mint`, `--orb-deep`. Relief : `--orb-shine` (reflet haut) + `--orb-drop` (ombre portée).

**Règles d'usage**
1. Un écran = au plus **deux familles** (miel + vert). Alterner les orbes miel / vert / crème ; ne jamais mettre cinq couleurs côte à côte.
2. Proportion cible : fond et surfaces ≈ 60 %, encre et vert ≈ 30 %, miel d'accent ≈ 10 %.
3. Bouton principal = `--primary` (vert) ou encre (`.button.dark`) ; jamais un orbe coloré.
4. Une icône sur orbe est toujours en `--text`. Un texte sur orbe ou bandeau en `--text` (jamais `--text-muted`, 3:1 sur le miel).
5. Le rouge n'apparaît que pour une erreur, une suppression ou un statut « contesté ».

**Contrastes mesurés** (encre sur chaque extrémité des orbes, cinq thèmes) : pire cas 3,8:1 (Sauge, fin du vert) — suffisant pour une icône (≥ 3:1). Les bandeaux portant du texte utilisent les extrémités claires (miel, vert clair) : ≥ 4,5:1. Miel : texte atténué `#5D6F66` sur fond 5,0:1 ; blanc sur `--primary` 4,6:1 ; lien miel sur bandeau d'encre 8,0:1.

## 4. Statuts (fixes)

| Statut | Texte | Fond | Règle |
|---|---|---|---|
| Déclaré | #8A6100 | #FFF3D6 | par le patient |
| Relevé | #1F4E8C | #E6EEF8 | en pré‑consultation |
| Vérifié | #17704A | #E4F5EC | confirmé par un professionnel |
| Contesté / danger | #A32D2D | #FBEAE8 | non confirmé, suppression |
| Expiré / révoqué | #4A5550 | #E8ECE9 | lien ou accès terminé |

Toujours **icône + libellé** : la couleur n'est qu'un renfort. Le bleu « Relevé » reste réservé à ce statut.

## 5. Typographie

- Titres : **Sora** (600–700). Corps : **Bricolage Grotesque**. Alternatives du thème : Mooli + Manrope, Fredoka + Quicksand.
- Codes, identifiants, durées : **JetBrains Mono**. Écriture manuscrite (Caveat) : uniquement les titres du pied de page public.
- Échelle : display `clamp(1.9rem, 6.5vw, 2.4rem)` (`--fs-display`) · h1 1,75 rem · h2 1,125 rem · corps 1 rem · petit 0,8125 rem · mini 0,75 rem (plancher). Taille du texte réglable : 100 / 115 / 130 %.
- Titre d'accueil : `.hero-title` avec `<em>` pour la seconde ligne, en vert (`--primary-text`).

## 6. Formes, espacements, cibles

Rayons : 10 · 16 · 22 · **26** (cartes) · 999 (pilules) ; orbes 16 (12 en petit). Espacements : 4 · 8 · 12 · 16 · 20 · 24 · 32 (`--sp-1…8`). Cible tactile ≥ 44 px (champs 52 px sur mobile). Barre basse : 68 px.

## 7. Matière

**Néomorphisme minimaliste** (`soft-skin.css`) : surface = `--bg` ; relief `--raise-lg / md / sm` (clair haut‑gauche, sombre bas‑droite) ; creux `--press / --press-sm`. Garde‑fous : champs et boutons secondaires gardent un liseré `--border-strong` ; le texte ne dépend jamais d'une ombre ; le focus reste un anneau plein de 3 px.

**Gooey** (`goo.css`) : ressort `--spring` (0,7 s), une goutte qui grandit vers la forme finale (boutons, modales, toasts, indicateur de la barre basse), contenu qui sort du flou en cascade. Le filtre n'est posé que sur des calques `aria-hidden` ; `prefers-reduced-motion` supprime les animations.

## 8. Composants (classes de `mobile-skin.css`)

| Maquette | Classes |
|---|---|
| Orbe d'icône | `.orb` + `--sm / --lg / --round` + `--green / --cream / --mint / --deep` |
| Grille de l'accueil patient / médecin (3 × 2, PC : auto‑fill) | `.tile-grid` > `a.tile` > `.orb` + libellé ; `.tile--add` (ajouter un enfant, pointillés) |
| Titre d'accueil | `.hero-title` (+ `<em>`) |
| Boutons | `.button`, `.button.primary`, `.button.dark`, `.button.outline`, `.block`, `.button-row` |
| Filtres, onglets | `.seg` (contrôle segmenté), `.chip` / `.chip.is-active`, `.badge.is-soft` |
| Consultations / examens | `.visit-card` (bandeau miel puis vert clair une carte sur deux), `.band`, `.band--green`, `.kv` (Type / Date / Médecin) |
| Réglages | `.settings-directory` + `.setting-list` (icônes plates creusées) ; `.setting-list--orbs` (« Profil clinique ») ; `.setting-item--danger` |
| KPI établissement | `.kpi-grid` (2 colonnes mobile, 4 PC) > `.kpi` > `.kpi__top`, `.kpi__label`, `.kpi__value`, `.kpi__delta(.is-down)` ; `.stat-card` aligné |
| Graphiques (Recharts) | séries `--chart-1…4`, comparaison `--chart-prev` en pointillés, grille pointillée, infobulle encre `.chart-tooltip` |
| Grille de tuiles (React) | `<TileGrid items label />` (`components/ui/TileGrid.tsx`) : orbes alternés miel / vert / crème, libellé court, texte d'aide dans l'étiquette accessible |
| KPI établissement (React) | `<EstablishmentKpis memberships />` (`components/EstablishmentKpis.tsx`) : 4 KPI, courbe en aire, donut, barres ; couleurs `--chart-*` |
| Console admin / superadmin | `admin-skin.css` : `.admin-metrics` (2 colonnes mobile), `.admin-table--stack` + `data-label` (cartes sous 860 px), `.admin-page-heading`, `.admin-login` |
| Onglets (patient, professionnel, établissement) | `pages-skin.css` : en-têtes (`.page-header`), `.count-badge` d'encre, `.notice` crème, `.membership-row`, QR actif (`.patient-active-qr` + compte à rebours d'encre), numéro d'étape de pré‑consultation en orbe, bandeau d'encre du proche de confiance (`.trusted-delegation-banner`) |
| Onboarding | `.titulaire-cover` (couverture verte du carnet), `.progress-bars` (4 segments), `.choice-card.is-selected` |
| Compte proche / enfant | `.banner-ink` (« Carnet de … · Revenir à mon dossier »), `.avatar` (orbe miel), `.badge` de statut |

Exemple :
```html
<ul class="tile-grid">
  <li><a class="tile" href="/patient/vaccinations"><span class="orb orb--green"><svg class="icon">…</svg></span>Vaccinations</a></li>
</ul>
```

## 9. Écrans (maquettes → composants)

- **Patient · Accueil** : `.hero-title`, `.button-row` (Mon carnet / Partager en QR), carte « Prochaine consultation » (`.card` + orbe), `.tile-grid`, rangée « À faire ».
- **Médecin · Accueil** : même structure ; tuiles Patients, Consultations, Ordonnances, Vaccinations, Adressages, Accès ; agenda du jour en `.list-row`.
- **Consultations** : `.seg`/`.chip` de filtre, `.visit-card` + `.kv` + badge de statut.
- **Paramètres** : en‑tête profil (orbe miel + étoile d'édition), carte virtuelle (`.titulaire-cover`), `.setting-list--orbs` puis `.settings-directory`.
- **Établissement** (PC et mobile) : `.kpi-grid`, cartes de graphiques, tableau des médecins. Création **interne** : aucun écran d'inscription établissement.
- **Connexion / onboarding** : étape 1 compte → 2 espace (Patient / Professionnel) → 3 identité → 4 récupération ; `.progress-bars`, `.choice-card`, `.titulaire-cover`.
- **Proches / enfants** : listes de `.card` avec avatar, statut (`.badge`), `.banner-ink` en lecture d'un carnet représenté.

## 10. Éléments protégés — ne pas modifier

- Landing : `page.tsx`, `landing*.css`.
- Logo : `BrandLogo.tsx`, `BrandMark.tsx`, `public/brand/*.svg`.
- SVG d'inscription et écran de connexion : `connexion/auth-immersive.css`, `components/auth/welcome-character.css`.
- Matière : `soft-skin.css`, `goo.css`, la barre de navigation gooey (`sidebar.css`).

`mobile-skin.css` est chargé après `goo.css` dans `layout.tsx` et n'écrase aucun de ces fichiers.

## 11. Accessibilité

Contrastes §3–4 · cible ≥ 44 px · focus visible partout · couleur jamais seule · `prefers-reduced-motion` respecté · texte jamais filtré par le gooey.

## 12. Mise en œuvre dans le code

- **Accueils patient et médecin** : `PatientHome.tsx` (6 tuiles : Mon carnet, Mes visites, Partage QR, Proches de confiance, Adressages, Réglages) et `ProfessionalHome.tsx` (tuiles déjà autorisées par le rattachement) utilisent `TileGrid`. Les liens et textes sont ceux du code ; seul le rendu change.
- **KPI établissement** : `EstablishmentConsole.tsx` affiche `EstablishmentKpis`. Tout est calculé à partir des rattachements réels (statut, spécialité déclarée, dates de demande et de réponse) : médecins actifs, demandes à traiter, part de rattachements confirmés, délai moyen de réponse ; courbe des demandes et confirmations sur six mois ; médecins par spécialité ; état des rattachements. Sans donnée, la carte l'indique. Aucun chiffre n'est inventé et aucune donnée patient n'est utilisée.
- **Graphiques** : `RoleDashboards.tsx` et `AdminActivityCharts.tsx` lisent `--chart-1…4`, `--chart-grid`, `--chart-text` (plus de vert / bleu / orange / violet en dur) ; infobulle d'encre. Les courbes 3 et 4 ont un tracé pointillé pour ne pas dépendre de la couleur seule.
- **Onglets de chaque espace** : `pages-skin.css` agit sur le vocabulaire déjà partagé (listes, notices, rattachements, QR, pré‑consultation, bandeau du proche de confiance) ; aucun de ces écrans n'a été réécrit, ils prennent la matière des accueils. Visites reçoit en plus les bandeaux de `mobile-skin.css`, Moi les icônes creusées et les avatars en orbe.
- **Onboarding** : `OnboardingFrame` affiche la barre de progression en 4 segments (`OnboardingProgress`, étape lue dans l'adresse : 1 identité, 2 espace, 3 carnet ou profil professionnel, 4 sécurité ou cachet et signature) ; choix de l'espace en cartes à orbes ; groupes du profil professionnel creusés ; Retour / Suivant de 52 px.
- **Admin et superadmin** : `admin-skin.css` ; tableau des visiteurs en mode cartes sous 860 px (`admin-table--stack` + `data-label`) ; états de récupération (`admin-recovery.css`) sur les variables de statut.

**Restant à faire**
- Connexion, inscription et écran de bienvenue : **non modifiés** (SVG d'inscription et animations protégés). Les maquettes « Bienvenue », « Connexion » et « Création de compte » restent des références visuelles.
- Les longs formulaires (sections du carnet, champs de pré‑consultation, lignes d'ordonnance) héritent seulement de la matière et des champs de 52 px : à contrôler à l'œil dans l'app réelle, espace par espace.
- Bouton central surélevé de la barre basse (« Accès »), présent sur les maquettes : non réalisé, car la barre gooey actuelle est conservée.
- Variations « par rapport à la période précédente » et affluence par heure des maquettes : impossibles sans historique ni horodatage côté API ; les KPI affichent à la place « +n en 30 j » (réel).
- Tout nouveau tableau d'administration doit recevoir `admin-table--stack` et un `data-label` par cellule pour se replier en cartes sur mobile.
