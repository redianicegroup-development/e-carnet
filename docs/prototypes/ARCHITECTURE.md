# Prototypes — lecture visuelle, pas architecture applicative

> Référence visuelle/prototypage uniquement. Le constat « live » daté ci-dessous est historique ; l’état du code est dans [ETAT-REEL-V1.md](../ETAT-REEL-V1.md) et les parcours produits dans [ROADMAP-V1-V5.md](../ROADMAP-V1-V5.md).

**Mis à jour le 05/10/2026.** Ce dossier décrit les maquettes HTML fournies. Les recommandations techniques historiques ci-dessous ne décrivent pas l’architecture exécutable actuelle; voir [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md).

## Rôle des maquettes

Les écrans Patient, Médecin et Établissement sont des références visuelles mobiles. Les éléments à reprendre dans le produit courant sont :

- navigation compacte et facilement atteignable au pouce;
- hiérarchie et densité des cartes, tailles, espaces et proportions;
- palette, typographie, états/badges et illustrations pertinentes;
- icônes cohérentes, homogènes et compréhensibles;
- expérience générale centrée mobile, adaptée ensuite au desktop.

Ne pas viser une copie pixel-par-pixel au détriment de la lisibilité/accessibilité. Le constat live au 05/10 : le shell et les espaces existent; l’authentification présente des textes français et la marque E-carnet; plusieurs icônes de navigation sont encore des caractères Unicode; la composition et la densité mobile restent à rapprocher des prototypes.

## Flows

Les prototypes contiennent des parcours/écrans qui peuvent être obsolètes. Ils ne définissent plus les étapes d’inscription, le compte administrateur établissement, les justificatifs, le QR, les scopes ou le MFA. Les règles actuelles sont celles de la [roadmap produit](../ROADMAP-V1-V5.md), du [journal de décisions](../QUESTIONNAIRE-DECISIONS-A1-A16.md) et du [flow établissement](../FLOW-ETABLISSEMENT.md) : identité/avatar modifiable → choix Patient/Professionnel → formulaire métier; espace établissement privé à administrateur nominatif; invitation et code à usage unique de 48 h; OTP SMS et TOTP/MFA en V3.

## Règles d’intégration

1. Garder les fichiers de prototypes comme référence/archives, sans les exécuter dans le parcours live.
2. Reconstituer les composants dans `apps/web` et `packages/ui`, avec responsive/accessibilité et contenu approuvé.
3. Remplacer les glyphes de navigation par des icônes cohérentes; ne pas confondre les logos fournisseurs, qui peuvent rester des SVG de marque, avec l’iconographie métier.
4. Conserver les états de chargement/erreur/attente; ne jamais promettre une fonction non connectée.
5. Vérifier mobile au clavier, lecteur d’écran, focus visible et zone tactile; tester Android/4G avant recette.

## Résultat visuel observé

Le code reprend des cartes, les espaces Patient/Professionnel/Établissement et une navigation à cinq entrées, mais la navigation est implémentée par glyphes textuels et la disposition live reste différente des maquettes. Le travail attendu est une meilleure fidélité d’expérience mobile, sans reprise des flows anciens. L’authentification actuelle n’a plus le bouton générique « Autre » relevé dans l’ancien audit.
