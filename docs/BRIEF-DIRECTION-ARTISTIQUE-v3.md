# Mon Carnet Numérique — brief de direction artistique V3

**Document de travail pour la direction artistique — 10 octobre 2026**  
**Objectif : rendre l’identité cohérente, chaleureuse et surtout facile à lire.**  
**Les valeurs ci-dessous sont une proposition à faire valider avant de les appliquer au code.**

## 1. Direction proposée

Créer une interface de carnet personnel de santé qui donne une impression de **calme, clarté et contrôle**. Elle ne doit ni ressembler à un tableau de bord technique, ni laisser penser que l’application certifie un médecin ou garantit une prise en charge médicale.

Le patient doit comprendre en quelques secondes :

1. quelle information vient de lui et laquelle vient d’un professionnel ;
2. qui demande l’accès à son carnet ;
3. ce qu’il autorise et pour combien de temps ;
4. comment refuser ou arrêter l’accès.

**Règle de simplicité :** une idée principale par écran, des phrases courtes, des boutons explicites, des icônes accompagnées de mots et des graphiques qui se comprennent sans connaissance technique.

## 2. Proposition de charte par défaut

### Palette recommandée : « Sauge & encre »

Je recommande **Sauge** comme palette par défaut de la marque : elle est douce, naturelle et se distingue du bleu médical classique. Pour l’action principale, la version légèrement ajustée **`#597C66`** est proposée afin de garder un bon contraste avec du texte blanc.

- **Fond de page — `#F2F5EF`** : très clair, à utiliser sur les grandes surfaces.
- **Surface douce — `#D8E2D0`** : sélection légère, panneau secondaire ou fond de repère.
- **Accent doux — `#A9C4A5`** : illustration, pictogramme ou accent décoratif ; pas de petit texte blanc dessus.
- **Action principale — `#597C66`** : boutons importants avec texte blanc ; contraste calculé avec le blanc : environ **4,67:1**.
- **Encre — `#2C3A33`** : texte principal, titres, icônes et contours foncés.

Le dépôt contient déjà un preset Sauge, mais sa valeur d’action déclarée est `#5B7F68`. Cette direction propose donc un petit ajustement à `#597C66` et demande à l’équipe technique de mettre d’accord les tokens et l’affichage final.

### Couleurs fixes des statuts

Les statuts ne changent pas avec la palette choisie par une personne. Garder les couleurs dédiées déjà présentes dans le projet et toujours afficher **un mot** à côté de la couleur : « Déclaré », « Mesuré », « Vérifié », « Contesté », « Expiré ».

Ne jamais utiliser la couleur seule pour faire comprendre une situation. Ajouter un libellé et, si nécessaire, une icône simple. Ne pas détourner le rouge réservé aux erreurs pour une décoration de marque.

### Ce qui est actuellement dans le code

Le thème par défaut du dépôt est **Lagon** (`#E6FFF7`, `#B9F2E3`, `#7AD8C8`, `#4AA1A3`, `#2A4B5D`) et la police par défaut est **Unbounded**. Ne pas présenter Sauge ou la nouvelle typographie comme déjà intégrées : elles sont la recommandation de cette V3. L’application permet aussi de sélectionner des palettes et des polices dans les préférences. Le DA doit donc montrer clairement la nouvelle apparence par défaut et vérifier que les choix personnels restent lisibles.

## 3. Typographie recommandée

- **Texte courant et formulaires : Plus Jakarta Sans.** C’est la proposition de police par défaut pour lire les notices, les données du carnet et les formulaires sur un téléphone.
- **Titres : Plus Jakarta Sans en graisse marquée.** Garder les titres courts, sans décorations excessives.
- **Unbounded :** la réserver au logo ou à quelques grands titres de présentation, si les essais mobile confirment qu’elle reste lisible. Ne pas l’utiliser pour les paragraphes, les messages d’erreur ou les textes médicaux.
- **JetBrains Mono :** seulement pour un code temporaire, un identifiant ou une référence courte. Éviter les blocs longs en police monospace.

Le code actuel applique Unbounded comme police par défaut du thème et propose 12 familles dans les préférences. La direction artistique doit recommander un réglage clair : **Plus Jakarta Sans au premier lancement**, avec les autres choix personnels facultatifs après test de lisibilité. Les styles des textes en gras doivent être livrés avec les graisses réellement utilisées pour éviter un rendu irrégulier.

## 4. Logo et ton visuel

Garder le nom public **Mon Carnet Numérique**, avec **E-carnet** comme nom court si l’équipe confirme cette convention partout.

Piste de logo : **une page de carnet ouverte ou une page que son propriétaire choisit d’ouvrir**, avec un petit repère visuel de contrôle. Le signe doit être reconnaissable en petit format et rester lisible en une seule couleur.

Éviter la croix médicale générique et le stéthoscope comme symbole de marque. Éviter aussi un cadenas trop dominant, qui pourrait être interprété comme une promesse absolue de sécurité.

Prévoir le logo en couleur, en noir/encre, en blanc et en version compacte pour l’icône d’application. Le symbole + déjà utilisé par endroits est à remplacer progressivement par le signe retenu afin d’éviter plusieurs identités concurrentes.

Ton rédactionnel : français simple, direct et humain. Préférer « Vous décidez qui peut consulter et pour combien de temps » à « gestion des scopes et des AccessGrants ». Expliquer les termes techniques lorsqu’ils sont nécessaires et ne pas promettre une fonction tant qu’elle n’a pas été testée.

## 5. Écrans et infographies à concevoir d’abord

### Priorité 1 — Patient sur téléphone

- accueil et demande d’accès en attente ;
- comparaison claire entre ce qui est déclaré par le patient et ce qui est écrit par un professionnel ;
- écran d’autorisation qui indique le professionnel, l’établissement, le contenu demandé et la durée ;
- boutons « Autoriser », « Refuser » et « Révoquer » faciles à distinguer ;
- historique des accès avec une date et un libellé simple.

### Priorité 2 — Professionnel

- demande d’accès et périmètre demandé ;
- étapes du QR sans laisser croire qu’un scan ouvre automatiquement le dossier ;
- saisie de consultation et indication visible de l’origine des informations ;
- message compréhensible lorsque le rattachement ou l’établissement n’est pas actif.

### Priorité 3 — Établissement et équipe interne

- liste simple des demandes de rattachement ;
- actions « Accepter » et « Refuser » avec explication de l’effet ;
- rappeler que l’administrateur de l’établissement ne consulte pas les dossiers patients.

### Graphiques et schémas

Les schémas doivent montrer le **parcours de la personne**, pas l’architecture serveur. Exemple :

> Vous préparez votre consultation → le professionnel demande un accès → vous choisissez → l’accès temporaire prend fin ou vous le révoquez.

Pour les chiffres, préférer une carte avec un grand nombre, un titre et une explication courte. Pour comparer deux périodes, utiliser des barres avec les valeurs écrites directement. Éviter les diagrammes techniques, les graphiques chargés, les légendes éloignées des couleurs et les effets 3D.

Chaque graphique doit pouvoir être compris sans couleur : ajouter des libellés, des formes ou des motifs au besoin. Ne pas afficher des données fictives de démonstration comme si elles décrivaient de vrais patients.

## 6. Principes de mise en page

- Concevoir d’abord pour un téléphone courant, puis adapter à l’ordinateur.
- Garder la navigation mobile à cinq entrées lorsque le rôle le prévoit, avec une icône et un mot visible.
- Remplacer les derniers symboles Unicode utilisés comme icônes par un seul jeu d’icônes cohérent.
- Garder des cartes simples, des séparations visibles et des espaces suffisants entre les actions.
- Les boutons et commandes tactiles doivent viser au moins **44 px** de hauteur.
- Le texte courant doit rester confortable à lire ; éviter le texte minuscule en capitales.
- Utiliser les mêmes repères pour les formulaires, cartes, badges, erreurs et confirmations dans tous les espaces.
- Prévoir un état vide, un chargement, une erreur, une demande refusée et une session expirée pour chaque parcours important.

## 7. Accessibilité et contrôle qualité

Faire tester la maquette et l’application à taille mobile, en zoom, au clavier et avec lecteur d’écran. Le texte courant doit atteindre le contraste requis, les actions doivent garder un contour de focus visible et les erreurs doivent être reliées aux champs concernés.

Le jeu Sauge proposé donne environ **4,67:1** entre le vert d’action `#597C66` et le texte blanc ; c’est une première vérification de couple de couleurs, pas une certification du produit. Mesurer les couleurs vraiment affichées, y compris les états survolé, désactivé, sélectionné, erreur et focus, et refaire le contrôle pour chaque palette personnalisable.

Les couleurs d’état, les noms des boutons et les informations importantes doivent rester identifiables sans distinction de couleur. Garder les animations rares, courtes et désactivables lorsque le système de l’utilisateur demande moins de mouvement.

## 8. Livrables demandés à la direction artistique

1. Une planche de marque montrant le logo, ses variantes, la palette Sauge, les couleurs de statut et le ton rédactionnel.
2. Une page de typographie indiquant les polices, graisses, tailles et règles d’usage, avec un exemple d’écran mobile.
3. Des composants de base : bouton, champ, carte, badge d’état, navigation mobile et navigation ordinateur.
4. Trois maquettes détaillées : autorisation patient, demande professionnel et historique des accès.
5. Deux schémas simplifiés : parcours d’autorisation et provenance d’une information (« déclarée » ou « saisie par un professionnel »).
6. Un prototype mobile testable et une variante desktop.
7. Les valeurs de couleur et de typographie exportées dans un format facile à reprendre par l’équipe technique, avec vérification des contrastes.
8. Une courte note des décisions encore à confirmer, notamment choix définitif du nom, palette Sauge par défaut, maintien des thèmes personnalisables et limites de la personnalisation typographique.

## 9. Décisions à demander au porteur

- Valider ou modifier **Sauge & encre** comme apparence par défaut ; le code restera Lagon tant qu’il n’est pas modifié.
- Valider **Plus Jakarta Sans** pour le texte et Unbounded limitée aux éléments de marque ; le code restera Unbounded par défaut tant que l’implémentation n’est pas changée.
- Confirmer l’usage des noms « Mon Carnet Numérique » et « E-carnet ».
- Confirmer si les personnes gardent le choix entre les neuf palettes et les douze polices, ou si seules les couleurs restent personnalisables.
- Faire tester les maquettes par des utilisateurs qui lisent peu ou utilisent principalement un téléphone.

## 10. Références du dépôt

- `packages/ui/src/themes.ts` : neuf palettes, douze polices, thème par défaut et ajustement des couleurs pour le contraste.
- `packages/ui/src/styles/tokens.css` : couleurs et styles initiaux.
- `apps/web/src/app/layout.tsx` : familles de polices chargées.
- `apps/web/src/app/globals.css` : composants, tailles tactiles et styles partagés.
- `apps/web/src/app/page.tsx` et `apps/web/src/components/public/PublicShell.tsx` : identité et expérience publique.
- `docs/prototypes/` : référence de densité, navigation et proportions ; certains parcours sont anciens et ne doivent pas être recopiés tels quels.
- `E-Carnet_Brief-direction-artistique_v2.docx` : version antérieure, remplacée par cette recommandation V3.
