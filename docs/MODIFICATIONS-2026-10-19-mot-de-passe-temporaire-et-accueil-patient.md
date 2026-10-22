# 2026-10-19 — Accès établissement par mot de passe temporaire, espace patient

## Accès du responsable d'établissement (remplace le lien d'invitation par e-mail)
Cause du blocage observé dans le journal : l'envoi SMTP échouait (`Network is unreachable`) puis l'activation répondait 409 (compte déjà existant).
Désormais l'ouverture d'un accès ne dépend plus d'aucun e-mail :

1. Le staff saisit le nom vérifié et l'e-mail du responsable. Le serveur mémorise l'e-mail, crée le compte, y attache l'établissement
   et génère un mot de passe temporaire aléatoire (16 caractères, haché, jamais stocké ni journalisé en clair).
2. Ce mot de passe n'est révélé qu'une fois, dans la réponse réservée au staff (`Cache-Control: no-store`), avec un message prêt à transmettre.
3. Le responsable se connecte avec son e-mail et ce mot de passe. `ForcePasswordChangeMiddleware` ferme alors toute l'API (403
   `password_change_required`) sauf `me`, `me/password`, `logout`, le thème et le strict nécessaire ; l'écran `/connexion/nouveau-mot-de-passe`
   impose le remplacement (et demande prénom/nom si le staff ne les a pas donnés). Le mot de passe temporaire ne sert donc qu'une fois ;
   il expire aussi au bout de 7 jours (refusé comme un mauvais mot de passe).
4. Il remplit ensuite la fiche de son établissement (onboarding existant).

- Un e-mail qui correspond déjà à un compte n'est jamais modifié sans confirmation explicite du staff (`use_existing_account`) ; le compte
  garde alors son propre mot de passe.
- Renvoi = nouveau mot de passe temporaire (ancien invalidé) tant que le responsable ne s'est pas connecté ; révocation = mot de passe
  inutilisable. Un responsable déjà activé n'est jamais réinitialisé par l'équipe.
- Les anciens liens d'invitation encore en circulation continuent de fonctionner (`invitations/preview|accept`).
- Nouveaux fichiers API : `identity/temporary_password.py`, `establishments/provisioning.py`, migration `identity/0018`. `establishments/email_service.py` est supprimé.

## Espace patient
- Panneau de notifications : largeur et ancrage (gauche/droite) calculés pour rester dans l'écran, en-tête mobile comme sidebar PC.
- Tous les plier/déplier du carnet reprennent le geste de « Ma carte virtuelle » (titre-bouton + chevron). La feuille `carnet-skin.css`
  n'est pas chargée (seule `soft-skin.css` l'est) : les styles vivent désormais dans `components/patient-sections.css`.
- Pré-consultations : plus de pli.
- Onboarding étape 3 : âge (calculé depuis la date de naissance) et genre.
- Accueil : le dossier patient et le QR de la carte virtuelle forment une seule section.

## Non vérifié ici
Django et les dépendances npm n'étaient pas installables dans le bac à sable : les tests Python (nouveaux et réécrits), `next build`, ESLint, `tsc` complet
et le rendu navigateur n'ont pas été exécutés. Les tests Node du web passent (mêmes 3 échecs qu'avant : aide/FAQ, QR visite, cache de thème).
