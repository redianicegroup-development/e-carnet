# Mise à jour E‑Carnet — 15 octobre 2026 : landing complète

Base : `e-carnetv_1_9.zip`. La landing de Vazi Express (`delivery-platform-v1.zip`) a servi de référence pour la mécanique (Lenis + ScrollTrigger, hero épinglé, FAQ) ; la maquette jointe (modèle médical) a servi pour le ton des sections (bandeau de repères, cartes arrondies, grille numérotée). Rien n’est copié : tout est réécrit avec les variables du thème, donc la page suit la palette choisie.

## Ce qui change

**1. Image qui grossit au défilement (hero).** L’image démarre petite dans le coin bas-droit de l’écran, grossit jusqu’au plein écran (un texte apparaît par-dessus), puis rétrécit en grande carte arrondie centrée avant de laisser passer la suite. Elle est liée au défilement : elle rétrécit quand on remonte. Le hero est épinglé 2,4 hauteurs d’écran (1,9 sur mobile). Sur mobile le tactile reste natif ; avec « réduire les animations », le hero reste fixe et l’image reste dans son coin.
- Réglages : `--s0` (taille de départ), `--mx` / `--my` (marges au bord ; `--my` laisse la place au bouton « Donner votre avis ») et `--r` (rayon) dans `landing-showcase.css`, bloc `.lp-hero__media`. L’animation lit ces variables : le CSS et le mouvement ne peuvent pas diverger. Durées de la séquence : `LandingMotion.tsx`, bloc « Image qui grossit ».
- **Photo à la place de l’illustration** : aucune photographie n’existe dans le dépôt, l’image est donc une scène de l’application dessinée en HTML/CSS (téléphone, demande d’accès, QR temporaire, fictifs). Pour une vraie photo : déposer un WebP (1920×1080 min) dans `public/landing/` et renseigner `HERO_IMAGE = { src, alt }` dans `lib/landing-content.ts`. Rien d’autre à toucher.

**2. Sections ajoutées ou refaites** : repères chiffrés (5 min, 2 h, 2 × 1 h, 3 espaces — chiffres repris du centre d’aide), six fonctionnalités, parcours, rôles, confiance (inchangés), FAQ, contact, appel final.

**3. FAQ améliorée** : 15 questions en 4 rubriques avec filtre, une seule réponse ouverte à la fois, ouverture animée, navigation au clavier (↑ ↓ Début Fin), réponses fermées exclues de la tabulation, carte « Vous ne trouvez pas votre réponse ? » vers le formulaire. Huit réponses sont recopiées mot pour mot du centre d’aide (déjà relues par les juristes), quatre sont les textes d’origine de la landing, trois sont composées à partir des parcours d’aide ; un test échoue si l’une des deux versions change sans l’autre. Les données structurées (FAQPage) reprennent exactement les questions affichées.

**4. Formulaire de contact** : prénom, nom, e-mail **ou** numéro de téléphone (un seul champ, reconnu à la présence de « @ »), objet (liste de 8), message (10 à 2 000 caractères, compteur). Erreurs champ par champ, focus sur le premier champ fautif, état d’envoi, confirmation avec focus, champ leurre anti-robot. Le lien « Contacter l’équipe » (rôle Établissements) et « Nous écrire » (FAQ) présélectionnent l’objet ; `/?objet=establishment#contact` fonctionne depuis une autre page.
- API : `POST /api/v1/identity/contact/`, modèle `ContactMessage` (migration `0016_contactmessage`). Validation côté serveur, **limitation par IP** (5/heure, `ECARNET_RATE_CONTACT`) — pas par cookie, qui se fabrique. Rien d’autre n’est enregistré que nom, prénom, coordonnée, objet et message : ni IP, ni navigateur, ni page d’origine.
- Lecture des messages : **administration Django**, rubrique « Messages de contact » (statut modifiable, le reste en lecture seule, suppression possible pour une demande d’effacement). `ECARNET_CONTACT_NOTIFY_TO` (facultatif) envoie un e-mail de prévenance **sans aucune donnée personnelle**.

**5. Détails** : le menu public pointe vers Questions et Contact ; le centre d’aide (`/aide`) renvoie maintenant au formulaire pour « Ouvrir un espace » et pour les questions (le bouton « Votre avis » est anonyme : on ne pouvait pas y répondre) ; les ancres internes sont gérées par un seul déplacement (le saut natif du navigateur et Lenis se contredisaient) ; le hero est épinglé juste sous l’en-tête mesuré, jamais deviné.

## Vérifications

- API Django : **174 tests, 173 réussis, 1 échec préexistant** (`test_existing_oauth_account_redirects_to_active_space`, déjà en échec sur l’archive d’origine, sans lien avec cette mise à jour), 3 ignorés. 16 tests nouveaux pour le contact. `makemigrations --check` : aucun changement en attente.
- Web : tests **58 réussis** (dont 18 nouveaux : validation du formulaire, cohérence FAQ/centre d’aide, ancres, formulations écartées par la revue juridique) ; `tsc` propre ; ESLint 0 erreur (4 avertissements d’avatar préexistants) ; build de production réussi.
- Navigateur (Chromium, site + API réels en local) : 17 contrôles réussis — envoi réel et enregistrement en base, erreurs par champ, présélection de l’objet, ancres du menu, FAQ (filtre, clavier, `inert`, données structurées), aucune erreur JavaScript. Mouvement réduit : hero fixe, pas d’épinglage, ancres natives. HTML serveur : titre, FAQ et formulaire présents sans JavaScript. Captures à 1440×900 et 390×844.
- Non vérifié ici : rendu avec les vraies polices (le bac à sable n’atteint pas Google Fonts, des polices factices ont servi), et fluidité sur un vrai téléphone d’entrée de gamme.

## À décider ou à faire valider

1. **Juristes** : le formulaire collecte des données personnelles (nom, coordonnée, message) que la politique de confidentialité ne mentionne pas encore, et aucune **durée de conservation** n’est définie pour ces messages (`retention.*` dans `lib/legal/config.ts` n’a pas d’entrée « contact »). Le formulaire affiche une notice de ce qui est enregistré, sans promesse sur l’usage ni la durée.
2. Les trois textes que j’ai composés (« téléphone », « un médecin rejoint un établissement », « ouvrir l’espace d’un établissement ») sont marqués `origin: "composed"` dans `lib/landing-content.ts` : à relire avec le reste.
3. `/aide` (ligne « Partager mon carnet ») contient encore « Vous pouvez le révoquer à tout moment », formulation que le centre d’aide a écartée après la revue juridique. Non modifié ici.
4. Les messages ne sont lisibles que dans l’administration Django ; aucun onglet dans la console web `/admin`. À ajouter si l’équipe veut les traiter depuis là.
5. Le bandeau cookies et le bouton « Donner votre avis » sont fixés en bas de l’écran : le coin de l’image est surélevé (`--my`) pour éviter le bouton ; le bandeau cookies recouvre brièvement le bas-gauche tant qu’il n’est pas fermé.
