# Compte rendu « page de carnet » + ordonnance de l'établissement — patch

Ce zip contient uniquement les fichiers modifiés ou nouveaux, aux mêmes chemins que le projet. Décompressez-le à la racine du dépôt (`e-carnet/`) en acceptant d'écraser.

## Ce qui change

**Compte rendu (espaces patient, professionnel, établissement)**
- La carte se lit comme la page « Visites » du carnet papier : en-tête Dates | Visites, marge de dates, ligne de constantes (`pds 61 kg · TA 12/7 · T° 38,2`), lignes pointillées, bloc « Rp/ » pour l'ordonnance.
- Nouvelle ligne de signature en bas du compte rendu : cachet rond de l'établissement (généré : nom, ville, « VALIDÉ », date) + cachet et signature du médecin (images figées à la signature). Sans image : titre, spécialité et n° d'ordre déclarés en texte. Côté établissement : repère « apposé » (les images ne sont pas servies).

**Ordonnance**
- `GET /api/v1/patient/care/consultations/<id>/prescription-sheet/` : contenu de l'ordonnance en JSON (mêmes données que le PDF).
- « Voir l'ordonnance » (carte patient) ouvre la feuille A5 ou A4, avec impression sur une seule page ; le PDF reste disponible.
- Le PDF reprend la même mise en page (en-tête, patient avec âge, sexe et poids, Rp/ numéroté, cachet rond dessiné, signature en bas de page, pied de page, rappel du patient dès la page 2).
- Réglages de l'établissement : aperçu en direct de l'ordonnance pendant la saisie ; un champ vide reprend la valeur de la fiche de l'établissement (adresse, téléphone, e-mail), côté aperçu comme côté serveur.

**API** : `ConsultationSerializer` ajoute `signatory` (titre, spécialité, n° d'ordre) et `establishment` (nom, type, ville, téléphone).

## Points à connaître
1. **PDF — source du cachet et de la signature** : le PDF utilise désormais les images figées à la signature (comme l'écran). Une consultation signée avant que ces images soient figées garde l'ancien comportement (images actuelles du profil du médecin), pour ne rien casser.
2. **Cachet de l'établissement** : généré, pas téléversé. Un vrai cachet téléversable par l'établissement serait une étape suivante.
3. **Logo** : la feuille affichée n'accepte que les logos hébergés sur `https://res.cloudinary.com/` (sinon logo de la fiche de l'établissement, sinon monogramme). Le PDF ne télécharge jamais de logo : il dessine un monogramme.
4. **Prochain rendez-vous** : affiché sur l'ordonnance seulement s'il est dans le même établissement.
5. Aucune migration, aucune nouvelle dépendance.

## Vérifications faites
- `tsc --noEmit` et ESLint : propres sur les fichiers touchés (les deux avertissements restants, `Date.now` dans `PatientConsultations.tsx` et `<img>` dans `EstablishmentSettingsClient.tsx`, existaient déjà).
- Tests web : le test de structure de la carte est mis à jour ; un nouveau fichier `compte-rendu-ordonnance-2026-11-21.test.mjs` est ajouté.
- Tests Django : 654 tests, 7 échecs identiques sur le code d'origine (`test_documents_v2` ×3, `test_lab_results` ×2, `test_patient_records` ×1, `PatientRepresentationTests` ×1), sans lien avec ce patch ; `test_prescription_pdf` et le nouveau `test_prescription_sheet` passent.
- Rendu visuel contrôlé en 320, 390 et 1000 px (aucun débordement) ; impression : une page A5 ou A4.
