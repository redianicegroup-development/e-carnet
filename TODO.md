# Mon E‑Carnet — lot de mise en œuvre

## Documents médicaux — terminé

- Formats acceptés : PDF, PNG, JPEG et WebP ; extension et signature binaire doivent correspondre, le MIME est dérivé du contenu.
- Taille maximale : 10 MiB par fichier ; compression photo côté navigateur à environ 1 800 px / JPEG qualité 0,8 lorsqu’elle réduit le fichier ; limite d’envoi à 20 par heure, plafond de 100 documents et 200 MiB cumulés par patient.
- Suppression individuelle : détruit l’asset Cloudinary privé avant la référence locale et laisse le document intact si Cloudinary refuse ; action inscrite à l’audit sans contenu médical.
- Suppression de compte : efface documents, assets, vaccinations, mesures, rappels, rendez-vous, notifications et identifiants personnels ; les consultations signées et les traces d’audit protégées restent conservées conformément au flux existant. Les cachets/signatures Cloudinary d’un professionnel sont aussi détruits.
- Le partage aux professionnels exige un grant patient actif avec le périmètre `documents`, présenté en lecture seule et jamais ajouté implicitement aux scopes.
- Un résultat peut être associé à un examen demandé : l’examen passe à « résultat reçu » ; le document n’est pas déclaré vérifié. Sa suppression rétablit l’examen dans la liste des résultats attendus.
- Un justificatif peut être associé à une vaccination ; formats et taille suivent les mêmes règles.

## Ordonnance PDF — terminé

- Une ordonnance n’est produite que pour une consultation signée et comportant une prescription ; elle inclut l’identité patient, établissement, prescripteur, date, lignes de prescription et prochain rendez-vous s’il existe.
- Le numéro est libellé « déclaré » ; cachet et signature ne sont ajoutés que si le médecin les a déposés. Les images sont contrôlées, privées et limitées en taille ; leur suppression de compte est prise en charge.
- Le PDF n’effectue aucune requête vers l’URL de logo libre historique ; textes longs et accents sont gérés, le pied de page est borné et les ordonnances longues peuvent se poursuivre sur plusieurs pages.
- L’acceptation juridique/pharmaceutique du document n’est pas présentée comme acquise.

## Constantes — terminé

- Tension et glycémie sont saisies en texte libre, sans conversion ni unité ajoutée. Les valeurs historiques restent fidèles aux données stockées ; une unité n’est conservée que si elle était explicitement présente ou dans une clé historique qui l’indiquait.
- Les autres constantes restent numériques avec unités déclarées.
- L’historique unique combine les relevés patient et les consultations signées avec provenance/date ; les valeurs libres ambiguës ne sont pas interprétées en courbes.

## Vaccinations — terminé

- États séparés : « déclarée », « documentée » et « confirmée ». Le patient ne peut pas s’auto-confirmer ; seul un professionnel muni d’un grant actif autorisant les déclarations peut confirmer. Le médecin, la date et l’autorisation utilisée sont audités.
- Le formulaire propose BCG, DT‑Coq‑Polio (les doses/rappels sont saisissables), rougeole, fièvre jaune et « autre » ; il accepte un document/photo et affiche une prochaine échéance seulement si elle est renseignée.

## Navigation et commandes flottantes — terminé

- La sidebar patient affiche uniquement, dans l’ordre, « Accueil », « Mon carnet », « Visites », « Partage ».
- Une seule remontée en haut est présente par page publique ; les boutons Avis et Remonter restent à droite, compacts en icône seule sur mobile avec nom accessible, et inchangés sur ordinateur.

## Validation juridique — à faire avant ouverture générale

- La localisation, les sauvegardes, les accès de support et les transferts Cloudinary hors de Côte d’Ivoire restent à confirmer par l’équipe juridique et/ou l’ARTCI. La note interne [LEGAL-REVIEW-CLOUDINARY.md](docs/LEGAL-REVIEW-CLOUDINARY.md) liste les questions ; elle ne constitue pas une conclusion de conformité.

## Recette technique

- Web : 118 tests passés, TypeScript validé, ESLint réussi avec 5 avertissements non bloquants, build Next.js production réussi.
- API : 103 tests `care` et `professionals` passés (1 ignoré) ; `manage.py check` et `makemigrations --check --dry-run` sans anomalie. Après les dernières retouches PDF, les 16 tests documents/ordonnance/profil professionnel ont aussi passé.
