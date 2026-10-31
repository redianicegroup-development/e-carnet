# 28/10/2026 — Interface (accueil, navigation, historique, Moi) et reprise des corrections

Base : `e-carnet_v1_1.zip` (web push et montée en charge inclus, non modifiés ici).

## 0. Corrections de la surveillance technique remises dans cette version
`e-carnet_v1_1` contenait la première série (dossier commun, carte avec métier, étape 3 en un bloc) mais pas la seconde. Réappliquée par fusion à trois voies, sans conflit de code :
liste d'e-mails d'exploitation obligatoire hors développement, webhook à horodatage signé (débit limité, audit), incident résolu non rouvrable, clés d'audit de l'incident, étiquette d'environnement, médias de test isolés, `private-media/` refusé par `make-archive.sh`, script `ops/send-monitoring-event.py`. Détail : `MODIFICATIONS-2026-10-26-dossier-carte-onboarding.md`, section « 27/10 (suite) ».

## 1. Navigation
- Bouton principal surélevé au centre de la barre : « Préparer ma consultation » (patient) et « Scanner le QR d'un patient » (médecin rattaché). En tête de la barre latérale sur grand écran. Le scanner démarre via `#scanner`.
- Patient : Accueil, Mon carnet, Consultations, **Historique** (remplace Partage). `/patient/acces` redirige vers `/patient/historique#acces` ; la visite guidée et la cloche suivent.

## 2. Consultations et historique
- Consultations en deux étapes : pré-consultation, puis accès temporaire (QR de 5 minutes) affiché seulement quand un brouillon de pré-consultation existe. `PatientAccessGrants` prend `part = all | qr | log`.
- Historique : accès à mes données (demandes à décider + journal), consultations, vaccins, mesures, en tuiles pliables carrées. La pré-consultation n'est plus dans Mon carnet.

## 3. Accueil en vitrine, dossiers en tuiles
- `DossierCard` : bloc d'en-tête (photo, nom, métier) puis tuiles carrées pliables (comme Mon carnet). Patient : Identité et contact, Couverture santé, Mes autres déclarations (champs d'origine). Médecin : Profil professionnel, Établissement actif, Cachet et signature.
- La carte virtuelle et son QR sont une tuile à part, sur les deux accueils.
- Plus de raccourcis ni de carte « Préparez… » : c'est une ligne du bloc « À faire ». « Mise en route » sans barre de progression. « Mes rattachements » est une tuile carrée.

## 4. Onboarding
Étape 3 : nom et prénoms ne sont plus redemandés (étape 1) ; la profession du carnet patient n'est plus demandée dans le bloc patient d'un professionnel.

## 5. « Moi », proches et enfants, crédits
- `ProfileSummary` : photo, nom, trois repères, barre d'état, pour patient, professionnel et établissement.
- Page `/proches-et-enfants` (proche de confiance, profil enfant) ; l'Aide y renvoie ; sitemap et lien dans les paramètres.
- Crédits, « Identité visuelle » : le logo actuel remplace l'ancien dessin (carnet relié à interrupteur).

## Vérifications (28/10)
- `tsc --noEmit` : 0 erreur. ESLint sur les fichiers modifiés : 0 erreur.
- Tests web : 215, 210 passent ; les 5 échecs existent déjà dans `e-carnet_v1_1`.
- Tests Django : suite complète, **460 réussis**, 3 ignorés, SQLite local ; aucune migration manquante.
- Non rejoués : `next build`, PostgreSQL, rendu sur navigateurs et téléphones (la mise en page de la barre surélevée et des tuiles n'a pas été vue à l'écran).

## À trancher / non traité
- Maquettes complètes (accueil médecin « Aujourd'hui », agenda, cartes de consultation avec sceau) : seule la structure (navigation, vitrine, en-tête de Moi) est reprise.
- Désabonnement du push à la déconnexion ; fichier `push-web.patch` et dossier `phase2-celery` à retirer de la racine ; `README-CORRECTIONS.md` cité par le script k6 est absent.
