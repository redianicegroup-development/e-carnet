# Modifications du 07/11/2026 — consultation par sélection, établissement actif, photos, QR, hors ligne

Base : `e-carnet_V1_6-1.zip`. Migration à appliquer : `care.0028_examrequest_proof_document`.

## 1. Consultation du médecin = même expérience que la pré-consultation du patient
- `ProfessionalConsultations.tsx` réécrit avec les mêmes sections numérotées, puces à cocher et listes que l'espace patient.
- Briques communes : `components/consultation/ConsultationParts.tsx` (`FormSection`, `ChipPicker`, `VitalsPicker`, `PickOrOther`) et `OrderPickers.tsx` (`PrescriptionPicker`, `ExamPicker`).
- Le médecin **sélectionne** : symptômes (liste du patient), constantes (mêmes listes poids/taille/température), examen clinique, diagnostic, conduite à tenir, conclusion (puces), ordonnance (médicament, dosage, posologie, durée, instructions en listes) et examens (type, puis examen en liste).
- Chaque liste garde une sortie « Autre (préciser) ». Les choix sont rangés dans les champs texte existants : aucun nouveau champ serveur pour le texte clinique.
- Listes dans `lib/consultation-options.ts` (modifiables sans toucher aux écrans).

## 2. Établissement actif
- « Autorisation active » retirée de l'onglet Consultations. L'établissement actif se lit depuis le rattachement (bandeau avec logo et lien « Changer »).
- Le patient se choisit parmi ses accès actifs dans l'établissement actif (photo + nom) ; un seul patient autorisé = ouverture directe.
- Rattachements : bouton « Définir comme établissement actif » sur chaque rattachement non actif ; le serveur n'en garde qu'un seul actif.

## 3. Photos
- Établissement : `EstablishmentLogo` affiche le logo, sinon les initiales (jamais d'icône cassée) ; ajouté dans « Établissement actif » des paramètres.
- « Mes demandes » : photo du patient + logo de l'établissement + nom du patient (`patient_name`, `patient_avatar`, `establishment_logo` ajoutés à l'API des demandes du médecin).

## 4. Examens demandés : photo comme preuve
- Par examen : « Ajouter une photo de la demande » (réduite à 1 600 px avant l'envoi). L'examen peut rester sans libellé si la photo est jointe.
- API : `POST /api/v1/patient/care/professional/access-grants/<id>/exam-proofs/` (images seulement, quotas du patient). La photo devient un document validé du carnet du patient et se rattache à l'examen à la signature (`ExamRequest.proof_document`). Ce n'est jamais un résultat : l'examen reste « demandé ».
- **V6 (non fait, voulu)** : l'établissement génère le résultat et le transfère directement dans l'espace du patient.

## 5. Boutons rouges
Déconnexion (menu, paramètres, admin, session administrateur), révocation d'accès, fin de rattachement, déliaison d'un compte lié : bouton rouge plein + confirmation rouge (`tone: "danger"`).

## 6. « Partager en QR » (accueil patient)
`PatientShareQrButton` : chaque clic génère un nouveau QR temporaire de 5 minutes (celui de l'étape 2, état partagé) et l'affiche tout de suite.

## 7. Retour de la connexion et hors ligne
- Au retour de la connexion, l'espace relit ses données tout seul (plus de bouton obligatoire). Si une saisie non enregistrée est à l'écran, rien n'est effacé : le bandeau propose « Actualiser ».
- Si l'espace n'avait pas pu s'ouvrir, il réessaie seul au retour de la connexion. Sans copie locale, l'écran dit « Vous êtes hors connexion » (et non « Service momentanément indisponible »).
- Le profil du médecin (rattachements, établissement actif) reste 7 jours hors connexion, comme la session ; les données de tiers restent à 24 h.
- Les méthodes de connexion liées (Google) restent hors copie locale : décision de la v1.6 conservée.

## Vérifications
- Backend : `care.test_exam_proofs` (6 tests) + suites `care`, `professionals`, `establishments`.
- Web : `tsc`, ESLint sur les fichiers modifiés, 366 tests sur 367. L'échec restant (`boutons-gooey-aide.test.mjs`, centre d'aide) existait déjà en v1.6-1.
- Non vérifié ici : `next build` (polices Google inaccessibles depuis l'environnement de test) et le comportement sur téléphone.
