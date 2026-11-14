# 14/11/2026 — Première connexion, partage des codes, laboratoire interne → V1_15

**Statut : écrit et testé.** Django installé et suite lancée ; `node_modules` installé, `tsc --noEmit` propre, ESLint propre sur les fichiers touchés.
- **Backend** : suite complète, **765 tests, 3 échecs** ; tous les nouveaux tests passent. Échecs restants, **identiques sur la V1_14 d'origine** : `test_the_clinical_read_of_the_establishment_is_closed_to_a_laboratory_even_when_enabled`, `test_the_resume_view_hides_the_files_without_the_documents_scope`, `test_record_requires_same_user_current_admin_unexpired_opening_and_active_establishment`.
- **Web** : 496 tests, **les mêmes 11 échecs que sur la V1_14 d'origine** (aide, copie hors connexion, session PWA, accès clinique admin, 3e onglet), aucun nouveau.
- **Non vérifié** : rendu dans un navigateur (pas de `next build` ni de capture d'écran). À regarder sur téléphone : modal « Accès accordé », bouton Partager, fiche du laboratoire.
- Aucune migration.

## 1. Première connexion (laboratoire, établissement)
- On saisit l'e-mail exact et le mot de passe temporaire dans « Connexion ». Si c'est bon : **modal « Accès accordé »** (« Vous pouvez administrer le laboratoire de l'établissement « X » » / « …l'établissement « X » »), puis écran du nouveau mot de passe.
- **Écran du nouveau mot de passe** : seulement le nouveau mot de passe et sa confirmation, avec un œil par champ (`PasswordField`). Le mot de passe temporaire n'est plus redemandé : le serveur retient (15 min) que la session vient de s'ouvrir avec lui (`temporary_login_at`). Au-delà, ou pour une session ouverte autrement (ex. Google), le champ « mot de passe temporaire » réapparaît (`current_password_required`). Le mot de passe temporaire ne peut pas être gardé comme nouveau.
- **Erreurs : modal avec le motif** (titre + message) : « E-mail ou mot de passe incorrect » (avec rappel de recopier exactement le mot de passe temporaire), « Mot de passe temporaire expiré » (7 jours ; ce motif n'est donné que si le mot de passe saisi est le bon, donc rien n'est révélé à quelqu'un qui ne le connaît pas), « Trop de tentatives », service inaccessible. L'ancienne modale d'erreur de `AuthForms` est remplacée par `OutcomeDialog` (succès ou erreur).
- API : `first_access` dans `/identity/me/` et la réponse de connexion (`{ kind: laboratory|establishment, establishment_name, parent_name }`, seulement tant que le mot de passe temporaire n'est pas remplacé).

## 2. Saisie d'un code : modals
- **Médecin** (« Saisir mon code médecin ») : modal **« Demande envoyée »** à l'établissement X (la saisie crée une demande que l'établissement doit confirmer : ce n'est pas encore un accès accordé, donc le mot « accordé » n'est pas utilisé ici). Erreur : modal « Code refusé » avec le motif du serveur. La réponse de l'API contient maintenant `establishment_name`.
- **Proche de confiance** (« J'ai reçu un mot ») : modal **« Accès accordé »** (« Vous êtes maintenant proche de confiance de … »), ou modal « Mot de rattachement refusé » avec le motif. La réponse contient `patient_first_name` / `patient_last_name` (déjà visibles dans « Carnets de proches »).

## 3. Icône Partager à côté de tous les codes générés
`ShareCodeButton` (feuille de partage du téléphone, sinon copie du message). Le message contient le lien de l'application, l'e-mail et le code. Posé sur : accès du laboratoire, code médecin (liste des codes et ancienne page), mot de proche de confiance, identifiants créés par l'équipe (`AdminEstablishmentsClient`), mot de passe temporaire de récupération (`AdminRecoveryClient`). Fichiers : `lib/share.ts` (textes et logique, testés), `components/ShareCodeButton.tsx`.

## 4. Rattacher un laboratoire = laboratoire interne, plusieurs administrateurs
- **Plus de champ « Nom du laboratoire »** : on saisit prénom, nom et e-mail de l'administrateur. Le laboratoire interne est créé au premier rattachement, nommé « Laboratoire {établissement} » (`internal_laboratory_name`, à changer à un seul endroit).
- **Plusieurs administrateurs** par laboratoire (plafond **10**, `MAX_LAB_ADMINISTRATORS`). Chacun a son compte et son mot de passe temporaire ; ajouter quelqu'un ne retire l'accès à personne (`provision_administrator(..., replace_current=False)`). Le formulaire passe de « Rattacher un laboratoire » à « Ajouter un administrateur » dès qu'un laboratoire existe, et la liste montre chaque administrateur et l'état de son accès.
- ⚠ **Remplace la décision du 13/11** (« un seul compte administrateur par laboratoire »). L'ajout d'un administrateur reste réservé à l'établissement ; un compte existant n'est jamais rattaché par un administrateur d'établissement (409).
- Les anciens laboratoires créés avec un nom (V1_12 à V1_14) restent listés ; le nouvel administrateur est ajouté au plus ancien.
- Audit : `laboratory.created` (premier rattachement) et `laboratory.administrator.added` (chaque ajout).

## 5. Fiche d'onboarding du laboratoire
- **Code interne retiré** de la fiche d'onboarding pour toute structure (il reste dans « Informations administratives » des établissements, jamais pour un laboratoire ; l'API renvoie `internal_code: null` pour un laboratoire).
- **Responsable → « Établissement (verrouillé)** » : le nom de l'établissement qui a demandé le rattachement (`parent_name`).
- **Type de structure verrouillé** (« Laboratoire ») : champ désactivé côté web et refusé côté API (400).
- « Dernière mise à jour » conservée. L'e-mail verrouillé est celui du compte de chaque administrateur (plusieurs administrateurs, donc plus un seul e-mail de structure). Libellés adaptés (« Fiche de votre laboratoire », « Nom du laboratoire »).

## Tests ajoutés
`care/test_lab_results.py` (labo interne, plusieurs administrateurs, plafond, compte existant, validation, fiche du labo), `identity/test_password_change.py` (connexion temporaire sans mot de passe actuel, fenêtre de 15 min, `first_access`), `establishments/test_staff_onboarding_flow.py` (motif « expiré »), `apps/web/tests/acces-codes-partage-2026-11-14.test.mjs`. Deux tests existants adaptés au nouveau modal (`site`, `ux-flows`, `boutons-gooey-aide`).
