# ADR-001 — Thème personnel, stocké par compte

- **Date :** 2026-10-03
- **Statut :** accepté par instruction explicite du fondateur
- **Remplace :** hypothèse de `ARCHITECTURE.md` source selon laquelle le thème personnalisé serait porté par l'établissement émetteur du carnet

## Contexte

Les maquettes livrées stockent temporairement police et palette dans `localStorage`. Le CDC V8 donne « Sauge » comme direction visuelle et la personnalisation n'est pas dans la V1 décrite. La demande du fondateur est que chaque personne choisisse son thème dans les paramètres et que le réglage soit individuel, par compte.

## Décision

Chaque compte utilisateur possède ses préférences `palette` et `font`, persistées côté serveur dans une relation un-à-un au compte. Les préférences suivent la personne lorsqu'elle passe entre ses contextes Patient/Professionnel/Établissement, mais ne modifient pas le thème d'autres personnes ni celui d'un établissement.

Valeur par défaut pour les nouveaux comptes :
- Police : `Unbounded` (la mention « Unbounded8 » est interprétée comme la famille Unbounded et une graisse de titre 800 ; ce n'est pas une famille de police distincte).
- Palette : `Lagon · 5 couleurs` : `#E6FFF7`, `#B9F2E3`, `#7AD8C8`, `#4AA1A3`, `#2A4B5D`.

L'API authentifie le compte avec la session et ne prend aucun identifiant de compte dans les paramètres d'écriture. La palette est validée (exactement cinq codes `#RRGGBB`, fond clair et encre foncée) et la police appartient à la liste autorisée. Les statuts de provenance et les couleurs danger restent indépendants du thème. Le thème est enregistré en base par compte ; une copie locale non sensible, indexée par compte, est gardée dans `localStorage` pour éviter un flash du thème par défaut au chargement. La base reste la source de vérité et resynchronise la préférence entre appareils. Aucun jeton de connexion ni donnée de santé n'est stocké dans cette copie.

Les 12 polices des maquettes sont déclarées via `next/font/google`, intégrées aux fichiers produits au build puis servies localement. `preload: false` évite de précharger les 12 : le navigateur ne demande que la famille effectivement utilisée. L'application ne requiert donc pas de connexion à Google Fonts à l'exécution.

## Alternatives

- Thème par carnet/établissement : rejeté, car l'utilisateur demande une préférence personnelle par compte.
- Thème stocké uniquement dans le navigateur : rejeté, car il n'est pas synchronisé entre appareils. Le cache local est seulement une copie de confort et reste isolé par compte.
- Thème global « Sauge » uniquement : rejeté au regard de la nouvelle demande.

## Conséquences

- Ajoute une capacité de personnalisation à la V1 en dérogation au périmètre initial du CDC ; c'est un changement explicite du fondateur, non une interprétation silencieuse.
- La préférence survit aux appareils/sessions après authentification.
- Les prochaines étapes doivent couvrir l'authentification et les contrôles d'accès à la page des paramètres.
- Les autres familles sont embarquées en graisse 400 ; la graisse 800 est complète pour Unbounded (défaut). Les autres graisses peuvent être ajoutées au build si le design produit l'exige.

## Révision du 05/10/2026

Cette décision de thème reste inchangée. Les nouvelles décisions produit sur l’onboarding, les rôles privés, le QR et les versions ne modifient pas l’isolation de thème par compte.
