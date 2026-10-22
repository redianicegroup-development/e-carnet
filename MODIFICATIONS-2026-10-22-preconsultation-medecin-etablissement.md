# Mises à jour du 22/10/2026 (2) — pré-consultation, espace médecin, espace établissement

**Une migration** : `establishments/0010_joincode_code_encrypted` (ajout d'une colonne texte vide par défaut ; aucune donnée existante touchée).
Lancer `python manage.py migrate`. Aucune nouvelle dépendance (`cryptography` est déjà installée avec Authlib).

## Patient
- **Pré-consultation en un seul bloc**, 4 sections : 1. motif · 2. symptômes et maux (20 symptômes courants à cocher + champ libre « Autre ») ·
  3. constantes (poids, taille, température en **listes déroulantes** ; tension, fréquence cardiaque, SpO₂, glycémie restent en saisie libre) ·
  4. personne qui remplit avec le patient (facultatif). Un seul bouton « Enregistrer le brouillon » ; seul le motif est obligatoire.
  Aucun champ serveur ajouté : les symptômes cochés et le texte libre sont rangés dans `observations` (« Symptômes : Fièvre, Toux » puis « Autres : … »), relus à l'identique
  à la modification ; un ancien brouillon (texte seul) reste lisible. Le médecin voit ce texte tel quel dans « Symptômes ».
- **Accueil** : la carte « Mise en route » (carnet essentiel, 3 rubriques) passe **avant** le dossier patient. Elle disparaît quand les 3 rubriques sont commencées.

## Médecin
- **Onglets** : tant que le rattachement n'est pas validé, seuls **Accueil** et **Rattachement** apparaissent ; une fois le code validé par l'établissement, tous les onglets (Patients, Suivi, Rattachement, Moi) apparaissent. Le profil, les paramètres et la déconnexion restent dans le menu du compte.
- **Accueil** : « Prêt » est remplacé par la même carte **Mise en route** que le patient (elle disparaît une fois tout configuré) + nouveau **Dossier médecin** (nom, profession, spécialité, identifiant, e-mail, établissement actif avec logo, cachet et signature).
- **Paramètres** : « Paramètres établissement » supprimé (le médecin n'entre plus dans l'espace établissement). **Modifier mon profil** devient un bouton secondaire dans Informations professionnelles (retour aux paramètres après enregistrement) et disparaît de la page Rattachement.
- **Scanner QR** : champ « coller le jeton » supprimé. Cause du bug : la vidéo n'existait qu'après le clic, donc la caméra ne démarrait jamais. Nouveau lecteur (`QrScanner`) : caméra arrière, lecture automatique, arrêt de la caméra à la fermeture, messages clairs (refus, caméra absente/occupée, http), et repli « Photographier le QR ».
- **Pliables** : « Mes consultations », « Vaccinations à confirmer », « Mes rattachements » (ce dernier ouvert par défaut). Les rattachements montrent le **logo** de chaque établissement (API : `establishment_logo` dans `/professionals/me/`).
- Statuts des demandes d'accès en français (au lieu de `active`, `pending`).

## Établissement
- **Code à remettre** : les codes valables restent **affichés 48 h** (avec « Expire dans … » et bouton Copier), puis disparaissent ; un code utilisé disparaît aussi.
  Le serveur conserve une copie **chiffrée** (Fernet, clé dérivée de `SECRET_KEY`) uniquement pour le réafficher à l'administrateur de la structure ; elle est effacée à l'usage, à la révocation ou à l'expiration. La vérification reste faite par empreinte.
  API : `GET /api/v1/establishments/<id>/join-codes/active/` (administrateur de la structure uniquement, `Cache-Control: no-store`).
  Attention : si `DJANGO_SECRET_KEY` change, les codes en cours ne pourront plus être réaffichés (ils restent utilisables si on les a déjà remis).
- **Équipe** : photo de profil des médecins (et dans les demandes). API : `professional_avatar_url` ; route `…/memberships/<id>/avatar/` pour les images stockées en base (administrateur de la structure uniquement).

## Tests
- Node : `tests/espaces-2026-10-22.test.mjs` (15 tests). Suite complète 179/182 ; les 3 échecs existaient avant (aide/FAQ, QR visite, cache de thème).
- Python (écrits, **non exécutés ici**, Django absent) : `establishments/test_join_code_display.py`. Lancer `python manage.py test apps.establishments apps.professionals apps.identity`.
- Non vérifié : rendu navigateur, caméra sur appareil réel, `next build`.
