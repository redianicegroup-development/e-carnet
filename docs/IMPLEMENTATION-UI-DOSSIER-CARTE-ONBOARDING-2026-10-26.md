# Implémentation UI — Dossier patient, carte professionnelle et onboarding

**Date :** 26 octobre 2026  
**Base :** dernière version `e-carnet-4` + fusion contrôlée de `e-carnet-maj-2026-10-25-dossier-carte-onboarding.zip`.

## Décisions appliquées

Le dossier patient et le dossier médecin utilisent le même composant `DossierCard` : photo, nom en titre, métier (pour un professionnel) et informations en lignes. Les champs du patient restent ceux d’origine : âge, genre déclaré, ville (déclaration patient), téléphone, adresse, couverture santé (organisme, numéro, expiration) puis « Mes autres déclarations » avec leur provenance. Le paquet du 25/10 avait ajouté Profession et E-mail et regroupé la couverture : ces changements ont été retirés. Prénom et nom sont dans le titre.

Le professionnel conserve un compte et un espace patient distinct de son espace professionnel. Les informations saisies en tant que patient restent dans le dossier patient de son compte professionnel. Les informations saisies en tant que professionnel — profession, spécialité, rattachement et informations d’ordonnance — restent dans l’espace professionnel. Aucun champ patient n’a été déplacé dans le modèle professionnel.

L’étape 3 d’un professionnel est un seul bloc (`ProfessionalStep3`, route `/onboarding/patient?suite=professionnel`) avec deux groupes : « Dans votre espace patient » (les mêmes champs que l’étape 3 d’un patient, `PatientIdentityFields`) et « Dans votre espace professionnel » (spécialité obligatoire ; numéro d’ordre, cachet et signature facultatifs). L’enregistrement suit l’ordre carnet patient, activation de l’espace professionnel, spécialité, ordonnance ; chaque appel est répétable sans doublon. Les anciens liens `?etape=3` redirigent vers ce bloc et le Retour de l’étape 4 y ramène. `PatientOnboarding` n’a plus de variante professionnelle ; `ProfessionalOnboarding` et `ProfessionalCredentialsOnboarding` ne servent plus qu’à « Compléter mon profil » et aux paramètres.

La carte virtuelle utilise le même visuel et le même générateur PNG que la carte d’urgence. Sur la carte affichée dans l’application et téléchargée par un professionnel, le métier et la spécialité apparaissent sous le nom. La page publique du QR ne reçoit ni n’affiche le métier. Un professionnel peut donc distinguer sa carte professionnelle tout en retrouvant les mêmes informations patient dans son espace patient.

Le métier déclaré est affiché dans l’accueil professionnel et dans l’accueil patient d’un compte qui possède aussi un contexte professionnel. Le patient simple ne déclenche pas d’appel inutile au profil professionnel.

Le QR professionnel demande toujours la lecture seule des documents : le patient voit ce périmètre et doit encore l’accepter. La portée C2 `care_history`, la sélection des structures sources et les protections de la dernière version ont été conservées ; les fichiers backend plus anciens de l’archive n’ont pas été écrasés.

L’équipe d’établissement affiche une photo par médecin. Un clic ouvre une fiche avec nom, prénoms, métier et âge calculé à partir du carnet patient, sans exposer la date de naissance. La révocation reste confirmée et auditée.

## Fichiers UI ajoutés ou intégrés

- `apps/web/src/components/DossierCard.tsx` et `dossier-card.css` (présentation commune des dossiers)
- `apps/web/src/components/PatientIdentityFields.tsx` (champs du carnet, communs aux deux étapes 3)
- `apps/web/src/components/ProfessionalStep3.tsx` (étape 3 d’un professionnel, un seul bloc)
- `apps/web/src/components/emergency-card/VirtualCardPanel.tsx`
- `apps/web/src/components/emergency-card/useEmergencyCard.ts`
- `apps/web/src/components/onboarding/OnboardingChrome.tsx`
- `apps/web/src/components/onboarding/onboarding.css`
- `apps/web/src/components/RoleChoice.tsx`
- `apps/web/src/lib/age.ts`
- `apps/web/tests/dossier-carte-onboarding-2026-10-25.test.mjs`

Les composants d’accueil patient, accueil professionnel, onboarding, carte, QR, réglages et équipe établissement ont été fusionnés dans la dernière base sans restaurer les régressions backend de l’ancienne archive.

## Vérifications effectuées

- 27/10/2026, sur l’archive `e-carnet-3` : `tsc --noEmit` réussi ; tests de l’interface 200 réussis sur 205 (les 5 échecs existaient déjà dans l’archive de départ) ; lint passé sur les fichiers modifiés, sans erreur.
- Suite Django complète : 418 tests réussis, 3 ignorés, sur SQLite local ; `makemigrations --check` : aucune migration manquante.
- `npm run build` et la recette sur PostgreSQL n’ont pas été rejoués après cette dernière fusion.

## Limites restantes

Le rendu visuel sur appareils réels, la recette mobile Android/iOS, l’accessibilité complète et la recette staging restent à effectuer. Le build local ne constitue pas une autorisation de traiter des données de santé réelles ; les portes V1 du document `RESTE-A-FAIRE-ACTUEL-V1-A-V6.md` restent applicables.
