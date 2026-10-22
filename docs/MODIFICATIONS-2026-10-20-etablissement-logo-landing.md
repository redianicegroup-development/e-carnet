# 2026-10-20 (2) — Établissement : logo, nom modifiable, fiche ; console équipe responsive ; hero et pied de page

**Backend (avec migration additive `establishments/0009`, à lancer : `python manage.py migrate`)** — aucune donnée existante n'est modifiée.

| Sujet | Changement |
|---|---|
| Logo | `Establishment.logo_url` (Cloudinary en production) / `logo_data` (développement et tests). Envoi en WebP ≤ 250 Ko, même contrôle que la photo de profil. `GET /api/v1/establishments/<id>/logo/` sert l'image stockée en base (dev). |
| Nom modifiable | Le nom arrive pré-rempli et l'établissement peut le changer. Tracé : `original_name` (nom vérifié par l'équipe), `name_updated_at`, événement d'audit `establishment.name.changed`. Refusé si une autre structure porte déjà ce nom (insensible à la casse) ; un nom inchangé ne compte pas comme renommage. |
| Visible de l'équipe | La liste staff renvoie `updated_at`, `name_updated_at`, `original_name`, `logo` : la console affiche « Renommé par l'établissement le … · nom vérifié : … » et la dernière mise à jour. |
| Fiche | `PROFILE_FIELDS` = type, ville, téléphone. **Adresse / BP facultative.** L'e-mail de contact n'est plus saisi : c'est l'e-mail du compte (mémorisé à la création de l'accès par le staff et à chaque sauvegarde), verrouillé ; toute valeur `email` envoyée est ignorée. Le responsable reste verrouillé. |
| Correctif | `views.py` utilisait `ValidationError` (upload du logo d'ordonnance) sans l'importer : erreur 500 sur un mauvais fichier. Import ajouté. |

Les établissements déjà complets restent complets (le nouvel ensemble obligatoire est un sous-ensemble de l'ancien).

**Frontend**
- Réglages **professionnel** et **établissement** : même en-tête que le patient (`settings-account-summary`). Cause du chevauchement : `.account-summary` est une ligne flex ; le nom était écrasé par la notice.
- Établissement : « Informations administratives » (logo, nom, type) et « Coordonnées » (ville, adresse/BP, téléphone, e-mail et responsable verrouillés) sont modifiables ; l'en-tête se met à jour aussitôt. Un seul formulaire partagé : `EstablishmentProfileEditor` (aussi utilisé par la fiche d'onboarding).
- Console équipe : plus de débordement horizontal (la carte-tableau était un élément de grille sans `min-width: 0`) ; chaque ligne devient une carte sous 860 px, avec logo, renommage et date de mise à jour.
- Hero : texte révélé en vert de la marque (il était crème sur photo claire).
- Pied de page : bandeau « Prêt à commencer ? » retiré ; slogan « Gardez le fil avec Mon E-Carnet. » sous la marque, donc sur toutes les pages publiques et légales.
- Boutons flottants : « remonter » n'était pas fixe (`body .button { position: relative }` l'écrasait : il tombait à gauche sous le pied de page) ; « avis » est rond sur PC comme sur mobile.

Tests : Python `test_staff_onboarding_flow.py` (renommage, doublon, logo valide/invalide, e-mail verrouillé, adresse facultative) ; Node `tests/etablissement-landing-2026-10-20.test.mjs` ; `site.test.mjs` adapté (bandeau retiré).
Résultat Node : 153/156, les 3 échecs sont ceux d'avant (aide/FAQ, test du QR compte, thème). Non vérifié ici : exécution des tests Python, `next build`, ESLint, rendu navigateur.
