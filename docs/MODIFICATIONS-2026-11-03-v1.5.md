> **Référence d’état auditée le 05/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`docs/ETAT-REEL-PROJET-2026-11-05.md`](docs/ETAT-REEL-PROJET-2026-11-05.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# v1.5 (03/11/2026) — corrections issues des captures d'écran

Base : `e-carnet_v1_4-final.zip`. 24 fichiers de code modifiés ou ajoutés (liste dans `MANIFESTE-2026-11-03.txt`), plus cette note et le manifeste.

## 1. Bandeau « Carte virtuelle · QR désactivé / Voir » retiré (captures 1 et 2)
- `ProfileSummary.tsx` : le composant `CardBar` et la propriété `bar` sont supprimés.
- `AccountSettingsClient.tsx` (patient) et `ProfessionalSettingsClient.tsx` (professionnel) : le bandeau n'est plus affiché.
- `profile-summary.css` : règles `.profile-card__bar*` supprimées.
- La carte virtuelle reste accessible dans sa tuile pliable « Ma carte virtuelle » des paramètres patient.

## 2. « Partager en QR » renvoie vers l'onglet Consultations (capture 3)
- `PatientHome.tsx` : le bouton pointe vers `/patient/consultations` (avant : une ancre de l'écran d'accès).

## 3. Texte de la visite guidée, étape « Consultations » 4/7 (capture 4)
- `lib/tour.ts` : le patient ne note plus rien seul. Étape 1 : l'infirmier ou le médecin fait la pré-consultation avec lui. Étape 2 : QR valable 5 minutes.
- `PatientPreconsultations.tsx` et `patient/consultations/page.tsx` : textes d'introduction alignés sur la même logique.

## 4. Navigation mobile admin sur deux lignes (capture 5)
- `globals.css` : la barre à défilement horizontal est remplacée, sous 920 px, par deux rangées superposées (6 + 5 onglets) sans défilement. Marge basse de page admin recalculée pour que le contenu ne passe plus sous la barre.
- `admin/page.tsx` : icônes distinctes pour « Journal » (horloge) et « Transferts de représentation » (partage).

## 5. Récupération de compte : aider sans exposer le secret (capture 6)
**Décision : la réponse secrète n'est jamais affichée.** Elle n'est conservée que sous forme d'empreinte (`recovery_answer_hash`) : elle ne peut pas être relue, et la montrer à un administrateur permettrait de prendre le compte de quelqu'un en se faisant passer pour lui. Les tentatives, elles, étaient déjà visibles et le restent.

Méthode proposée à la place (écran Admin → Récupération) :
1. **Rechercher le compte par e-mail** : fiche avec la question secrète choisie, date d'inscription, dernier accès, espaces, nombre de réponses fausses, état de blocage.
2. **Lever le blocage** (remet les échecs à zéro).
3. Si la personne ne se souvient plus de sa réponse : case « J'ai vérifié l'identité » obligatoire, puis **mot de passe temporaire** à usage unique (affiché une seule fois, valable 7 jours, changement forcé à la première connexion) à transmettre par un canal fiable.
4. Bouton « Aider » directement sur les comptes bloqués et sur les demandes d'aide reçues (la demande est marquée traitée).
5. **Traçabilité** : chaque action est inscrite au journal (« par l'équipe ») et le titulaire reçoit un e-mail d'alerte, sans le mot de passe.

Fichiers : `AdminRecoveryClient.tsx`, `admin-recovery.css`, `apps/api/apps/identity/admin_recovery_assist.py` (nouveau), `urls.py`, `admin_views.py`, `test_admin_recovery.py`. Nouvelles routes : `admin/recovery/account/`, `admin/recovery/accounts/<id>/unlock/`, `admin/recovery/accounts/<id>/temporary-password/`. Réservé au super-utilisateur ; comptes équipe, inactifs ou supprimés refusés.

## 6. Débordements et blocs cassés
- Cartes de visiteurs (admin, activité) : textes longs et codes passent à la ligne au lieu de dépasser (`admin-establishments.css`).
- Pro → « Mes rattachements » : double `section-grid` imbriqué supprimé, le bloc reprend toute la largeur (`ProfessionalAccess.tsx`).
- Pro → Consultations : « Plans de suivi » et « Vaccinations à confirmer » sont maintenant deux tuiles pliables dans la grille standard (`professionnel/consultations/page.tsx`) ; l'étiquette technique « PRO-12 · PAT-15 » devient « Suivi des patients » (`ProfessionalFollowUpPlans.tsx`).

## Vérification
- TypeScript (`tsc --noEmit`) : sans erreur. ESLint : 0 erreur.
- Tests Django du module identité : 39 réussis (dont 7 nouveaux pour l'aide à la récupération).
- Tests web : mêmes 5 échecs que dans l'archive d'origine (aide, rattachement médecin, QR visite, schémas, stockage local), aucun ajouté ; 4 tests web ajustés ou ajoutés pour les points 1 à 4.
- Rendu mobile 411 px (captures Playwright) : admin (navigation, activité, récupération), pro (accès, consultations avec tuile ouverte, paramètres), patient (accueil, consultations, paramètres) — aucun défilement horizontal, et le clic sur « Partager en QR » arrive bien sur Consultations.

## Non vérifié ici
`next build` complet, `makemigrations --check` (aucune migration ajoutée), essais sur vrais téléphones.
