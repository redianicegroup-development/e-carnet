# Mon E‑Carnet — modifications du 18 octobre 2026 (base : `e-carnet_v15.zip`)

Lot 1 sur 5 du plan validé : **identité du titulaire** et **flow pré-consultation → consultation**. Les lots suivants (documents joints, vaccins, ordonnance imprimable) ne sont pas dans cette archive.

## À faire, dans cet ordre

1. Décompresser à la racine du dépôt en préservant les chemins.
2. `cd apps/api && python manage.py migrate` : applique `patients.0009` (profession) et `care.0009` (constantes, contenu de consultation, lignes d'ordonnance, examens demandés). Les consultations déjà signées gardent leurs textes ; leurs nouveaux champs sont vides.
3. Rejouer : `python manage.py test apps.care apps.identity apps.patients`, `python manage.py makemigrations --check --dry-run`, puis côté web `npm test`, `npm run lint`, `npm run build`.

## Ce qui change

| Zone | Changement |
|---|---|
| Étape 1 patient | Écran « Identité du titulaire » : nom, prénoms, ville (obligatoires) ; adresse/BP, profession, téléphone, naissance, couverture (facultatifs) ; « Délivré le » automatique. Enchaîne trois appels répétables : identité du compte, déclaration `city`, onboarding patient. |
| Pré-consultation | 4e étape « Constantes » (8 champs, tous facultatifs). Un brouillon sans constantes reste valide. |
| Consultation du médecin | Constantes préremplies et corrigeables ; blocs « Motif et symptômes », « Examen et diagnostic », « Conduite à tenir » ; éditeurs de lignes d'ordonnance et d'examens demandés. Signature exigeant le diagnostic **ou** la conclusion. |
| Fiche patient | Chaque consultation s'affiche comme une page « Visites » : constantes groupées par provenance, ordonnance, examens demandés. |
| API | `vitals` sur la pré-consultation ; `symptoms`, `clinical_exam`, `diagnosis`, `vitals`, `prescription_lines`, `requested_exams` à la signature ; les mêmes champs en lecture sur `/patient/care/consultations/`. Un client sans la clé `symptoms` retrouve l'ancien comportement (saisie du patient reprise dans `observations`). |

## Décisions à confirmer

- **Ethnie : non incluse** (donnée sensible, aucune utilité clinique dans l'application). Facile à ajouter en facultatif si vous la voulez ; à valider avec la relecture juridique.
- **Unité de la tension : mmHg.** Les carnets papier utilisent souvent des cmHg (« 12/8 » = 120/80 mmHg) ; l'écran le rappelle. Si vous préférez saisir en cmHg, il faudra une conversion explicite plutôt qu'une devinette.
- **Glycémie en g/L.** À confirmer avec les établissements (certains notent en mmol/L).
- **Signature électronique** : inchangée (attestation SVG, non qualifiée). L'ordonnance structurée est signée avec la consultation, mais n'a pas encore de valeur d'ordonnance imprimée acceptée en pharmacie : c'est le lot « ordonnance imprimable ».
- **Provenance des constantes** : une valeur identique à celle de la pré-consultation garde « relevée en pré-consultation » ; elle devient « mesurée par le médecin » seulement si le médecin la modifie ou l'ajoute.

## Ce qui a été vérifié ici, et ce qui ne l'a pas été

Environnement de travail sans réseau : Django, DRF et Next.js n'étaient pas installables.

| Vérifié | Comment |
|---|---|
| Logique web | `tests/consultation-visite.test.mjs` : 11 tests réussis (bornes, virgule décimale, tension, provenance, branchement des écrans). |
| Types web | `tsc --strict` sans erreur sur `lib/vitals.ts` et `lib/care-records.ts` ; composants modifiés typés avec des déclarations React/Next minimales : aucune erreur dans les fichiers modifiés (contrôle négatif fait : une faute volontaire est bien détectée). |
| Python | Compilation de tous les fichiers modifiés ; contrôle des noms indéfinis ; migrations `0009` relues champ par champ contre les modèles. |
| **Non exécuté** | **Tests Django** (les nouveaux sont écrits : `care/test_consultation_content.py`, `identity/test_identity_titulaire.py`), `makemigrations --check`, `next build`, `eslint`, `npm test` complet. À rejouer avant de déployer. |

La plateforme reste en test : **ne saisissez que des données fictives**.
