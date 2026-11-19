# Établissements proches — livraison du 19/11/2026 (version 2)

Base : `e-carnet_complet_2026-11-18.zip`. Objectif : un patient (ou un professionnel) trouve les établissements **partenaires** d'E-Carnet
proches de lui, sur une carte où chaque établissement a son **logo** en pointeur, sans que sa position soit jamais envoyée ni enregistrée.

## ⚠️ À faire avant de commiter / déployer : régénérer `package-lock.json`

Cette version ajoute **Leaflet** (`leaflet ^1.9.4`, `@types/leaflet ^1.9.12`) dans `apps/web/package.json`. Le dépôt utilise `npm ci` (CI et Dockerfile), qui échoue
si le fichier de verrouillage n'est pas à jour. Je n'ai pas pu le régénérer (pas de réseau). À la racine du projet :

```bash
npm install            # met à jour package-lock.json avec leaflet et @types/leaflet
npm run lint && npm run build
```

puis commiter `package-lock.json` avec le reste.

## Flux

1. **Onboarding** : un bouton **« Mettre ma position »**. Il active le GPS de l'appareil, relève la latitude et la longitude, les affiche (avec la précision), puis
   « Enregistrer cette position ». **Aucune carte** dans l'onboarding. Si la précision est faible (ordinateur, Wi‑Fi), un avertissement renvoie vers la carte des paramètres.
2. **Paramètres › Coordonnées** (administrateur) : mêmes boutons, plus une **carte** pour vérifier et déplacer l'épingle. La position est posée une fois puis reste en base.
3. L'administrateur coche **« Apparaître dans la recherche des patients »** (décoché par défaut). Tant qu'il n'a pas posé l'épingle ET coché la case, l'établissement
   n'apparaît nulle part, y compris les établissements existants.
4. **Paramètres › Établissements proches de moi** (patient, professionnel, établissement, laboratoire) : barre de recherche, **carte Leaflet avec le logo de chaque
   établissement en pointeur**, puis liste. Toucher un pointeur ouvre la fiche (appeler, itinéraire) ; « Voir sur la carte » dans la liste centre la carte.
5. **Recherche intelligente** (barre de recherche) : un nom précis (« Clinique des Jardins ») ou une recherche libre (« hôpital Cocody », « pharmacie », « chu »). Insensible
   aux accents et aux majuscules, pardonne une faute de frappe, comprend les équivalents (CHU = hôpital, labo = laboratoire…), classe le nom avant l'adresse.
   Elle filtre en même temps la carte et la liste.
6. **Autour de moi** : le serveur renvoie la liste des partenaires visibles ; **le téléphone calcule les distances et trie**. La base ne stocke que les positions des établissements.

## Règles de sécurité

| Sujet | Règle |
|---|---|
| Position de la personne | Demandée au clic seulement, gardée en mémoire de l'écran, jamais envoyée (aucun paramètre dans l'URL), jamais stockée. |
| Qui change la position | Uniquement l'administrateur actif de **cet** établissement. Historique : qui, quand, ancienne et nouvelle position (`EstablishmentLocationChange`). |
| Coordonnées valides | Dans le rectangle de la Côte d'Ivoire ; refus des positions inversées (latitude/longitude), de « 0, 0 » et des valeurs impossibles. Le serveur est juge. |
| Adresse ou ville modifiée | La position passe à **« à confirmer »** et l'établissement sort de la recherche jusqu'à reconfirmation. |
| Visibilité | Fiche complète + statut « Active » (donc non suspendu) + position confirmée + choix de l'établissement + **pas un laboratoire**. |
| Réponse de l'API | `name`, `establishment_type`, `city`, `address`, `phone`, `latitude`, `longitude`, `logo`. Aucun identifiant, e-mail, responsable ni code interne. |
| Logo | Seule l'URL publique `https` (Cloudinary) est donnée. En développement (logo stocké en base, servi par une route qui porte l'identifiant), le pointeur affiche les **initiales**. |
| Pointeurs de la carte | Construits avec le DOM (`textContent`, `img.src`), jamais en HTML assemblé : un nom d'établissement ne peut pas injecter de balise. |
| Accès à l'API | Comptes connectés uniquement ; limite `ECARNET_RATE_DIRECTORY` (défaut `60/hour` par compte) ; `Cache-Control: private, no-store`. |
| Journal d'audit | `establishment.location.{confirmed,removed,needs_reconfirmation,listed,unlisted}` **sans coordonnées**. |

## Fichiers

**API** (`apps/api`) : `establishments/geo.py` (validation, sans Django), `location.py` (règles), `models.py` (4 champs + `EstablishmentLocationChange`),
`migrations/0019_establishment_location.py`, `serializers.py`, `views.py` (`EstablishmentDirectoryView`, fiche), `urls.py` (`GET /api/v1/establishments/directory/`),
`config/settings.py` (limite de débit), `establishments/test_location_directory.py`.

**Web** (`apps/web`) : `package.json` (Leaflet), `src/lib/geo.ts` (distance, recherche tolérante, initiales, logos sûrs, fond de carte), `components/PartnersMap.tsx` (carte Leaflet),
`NearbyEstablishments.tsx` (onglet), `EstablishmentLocationField.tsx` (position : onboarding sans carte / paramètres avec carte), `LocationPicker.tsx` (carte de confirmation),
`EstablishmentProfileEditor.tsx`, `AccountSettingsClient.tsx`, `ProfessionalSettingsClient.tsx`, `EstablishmentSettingsClient.tsx` (sert aussi le laboratoire), quatre `.css`,
`tests/etablissements-proches-2026-11-19.test.mjs`.

## Décisions à connaître

- **Position non obligatoire pour finir l'onboarding** : elle n'entre pas dans `PROFILE_FIELDS`, sinon tous les établissements déjà actifs disparaîtraient du catalogue des médecins
  (et du code médecin) tant qu'ils n'ont pas posé l'épingle.
- **Leaflet d'abord, Mapbox ensuite.** Le fond de carte vient d'une seule constante (`OSM_TILE_TEMPLATE`, `lib/geo.ts`) et `PartnersMap` garde la même interface. Le serveur de tuiles
  public d'OpenStreetMap est réservé à un usage léger : prévoir MapTiler / Stadia / Mapbox quand le volume monte.
- **Deux cartes** : Leaflet pour l'onglet des partenaires ; la petite carte de confirmation de l'administrateur (paramètres) reste sans dépendance. On pourra la passer sur Leaflet plus tard.
- **Liste complète en une réponse** (plafond `DIRECTORY_LIMIT = 500`, indicateur `truncated`). Au-delà de quelques centaines de partenaires : recherche côté serveur ou PostGIS.
- **Aucun numéro d'urgence** n'est affiché (retiré à la demande).

## Vérifications faites / à faire

- Fait ici : `geo.py` (cas limites), 24 tests Node dont garde-fous de confidentialité, onboarding sans carte et pointeurs à logo ; syntaxe et types des composants (types React et Leaflet
  **factices** : le vrai `tsc` se lance chez vous) ; suite web avant/après : mêmes 15 échecs préexistants, aucun nouveau.
- **À lancer chez vous** : `npm install` (voir plus haut), `npm run lint`, `npm run build`, `python manage.py makemigrations --check --dry-run`, `python manage.py test apps.establishments`
  (Django n'a pas pu être installé ici), puis un essai sur téléphone : « Mettre ma position », carte et pointeurs à logo, « Autour de moi », refus du GPS.
- Pas de test automatique de la limite de débit ; à vérifier à la main : 61 appels en une heure doivent renvoyer 429.
