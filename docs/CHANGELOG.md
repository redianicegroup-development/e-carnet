## 2026-10-08 — invitation privée, fin de rattachement, conditions et sauvegarde PostgreSQL

- Retrait définitif du jeton d’invitation brut des réponses API et de la console staff; invitation délivrée par e-mail SMTP configurable.
- Conditions d’accès médecin versionnées; le code médecin n’est pas consommé sans acceptation explicite enregistrée (version, auteur, horodatage).
- Résiliation possible côté établissement et côté médecin; accès futur révoqué, historique, audit et dossiers conservés.
- Décision du porteur : Vercel + Render + Neon pour V1/V2; VPS à réévaluer après V2. Exigences de localisation et rétention encore à valider juridiquement.
- Suite Django vérifiée sur PostgreSQL 16; smoke test sauvegarde/restauration isolée et rapport déposés dans `reports/`.
- Preuves détaillées : [77 tests PostgreSQL](../reports/postgres-tests-20261008.txt), [restauration locale isolée](../reports/postgres-restore-20261008T081823Z.txt) et [matrice CA-01 à CA-24](RECETTE-V1.md). Elles ne constituent pas une recette du staging managé ni une mesure RPO/RTO.


## 2026-10-05 (soir) — Correctifs de revue et refonte UI/UX

> Entrée historique. Les résultats/limites rapportés ici décrivent cette passe du 05/10 ; les preuves PostgreSQL et restauration du 08/10, ainsi que l’état actuel du code, priment.

**Correctifs bloquants relevés à la revue**
- CSRF : le front lisait le cookie avec `slice(9)` (« =jeton »), ce qui faisait refuser par Django toute écriture après connexion (403). Lecture centralisée dans `infrastructure/api/client.ts`, jeton renvoyé aussi en JSON par `/api/v1/csrf/` et gardé en mémoire (fonctionne quand l’API et le web n’ont pas le même domaine). Test navigateur simulé : jeton correct 200, `=jeton` 403.
- Limitation des tentatives : connexion (par IP et par email ciblé), inscription, code médecin, invitation établissement, demandes d’accès, console d’administration Django. Compteurs en table de cache partagée entre workers.
- Configuration : `DJANGO_DEBUG` vaut désormais `false` par défaut ; redirection HTTPS, HSTS (1 jour par défaut), cookies Secure/SameSite=None, confiance au proxy, chemin d’admin configurable (`DJANGO_ADMIN_PATH`).
- Inscription : message d’erreur générique, plus de confirmation qu’une adresse existe déjà.
- Un médecin sans établissement n’avait aucun champ pour saisir son code : ajout de l’écran « Mon rattachement ». Le profil professionnel expose maintenant ses rattachements et la raison d’un verrouillage.
- La feuille de style de l’application était quasi vide (les classes `card`, `button`, `topbar`… n’avaient aucune définition) : réécriture complète.

**UI/UX**
- Shell commun aux trois espaces : en-tête, barre basse à 5 onglets (mobile) / rail latéral (bureau), garde de session. Onglets : patient Accueil · Carnet · Consult. · Accès · Moi ; professionnel Accueil · Patients · Consult. · Accès · Moi ; établissement Accueil · Demandes · Médecins · Aide · Moi.
- Thème par défaut **inchangé** (palette Lagon, police Unbounded) ; la personnalisation palette/police du compte n’a pas bougé. Les styles de l’application sont écrits pour fonctionner avec n’importe quelle palette et police du sélecteur. Jeu d’icônes unique.
- Accueils réels pour les trois espaces (le professionnel n’avait qu’un texte de présentation). Verrou fonctionnel du scan QR tant que vérification, rattachement et établissement actif ne sont pas réunis.
- Nouvelle landing marketing et pages publiques sous un même en-tête/pied de page. Workflow global : `docs/WORKFLOW-GLOBAL.svg`.

**Limites à cette date** : build rejoué dans un bac à sable sans accès aux polices Google (polices stubées pour la compilation) ; aucun navigateur disponible, donc pas de test visuel ni de test E2E authentifié ; PostgreSQL réel, sauvegarde/restauration et staging non rejoués au 05/10. PostgreSQL 16 local et restauration isolée ont depuis été testés le 08/10 ; staging et données réelles restent NO-GO.

## 2026-10-05 — Synchronisation documentation et recette finale

> Résultats historiques de cette passe ; ne pas les confondre avec la preuve PostgreSQL plus récente du 08/10.

- README, cahier de décisions A1–A16, état réel, plan V1, roadmap, matrice de recette, sécurité et déploiement alignés sur le code courant.
- État vérifié : 57 tests API OK, 1 ignoré ; build Next.js avec 27 routes ; smoke Chromium local sur 6 routes.
- A9 documenté comme appliqué : QR opaque à usage unique, 5 minutes ; `preconsultation` + `declarations` par défaut, `consultations` sélectionnable, `documents` hors V1.
- Sanitation SVG documentée comme allowlist stricte avec tests adversariaux.
- Verdict maintenu : NO-GO staging/production tant que PostgreSQL réel, restauration, staging et validations métier/sécurité ne sont pas signés.
# Changelog

## V1 — flow établissement confirmé par le porteur — 2026-10-05

> Décision produit historique, amendée le 08/10. Pour l’implémentation et les gates actuels, voir [le flow établissement](FLOW-ETABLISSEMENT.md) et [l’état réel V1](ETAT-REEL-V1.md).

- L’établissement envoie ses preuves par e-mail à E‑Carnet; aucune demande/upload public. Un staff autorisé vérifie puis crée un compte d’administrateur nominatif; un seul admin actif en V1, remplaçable sans recréer la structure.
- Invitation unique à 48 h, mot de passe défini par le responsable; aucun mot de passe temporaire par e-mail.
- Code médecin émis par l’établissement, unique et valable 48 h; il crée seulement une demande `pending`, ensuite approuvée/refusée par l’établissement.
- E‑Carnet ne collecte pas les justificatifs personnels/professionnels médecin; la vérification est interne entre médecin et établissement. L’espace établissement ne lit aucun dossier patient.
- Historique non destructif des comptes, invitations, codes, décisions et rattachements; fin d’accès par suspension/révocation.
- Consigné dans [FLOW-ETABLISSEMENT.md](FLOW-ETABLISSEMENT.md) et [ADR-002](adr/ADR-002-etablissement-invitation-et-rattachement.md); le flow est désormais implémenté côté API/UI ; l’e-mail réel et la recette production restent à faire.

## V1 — audit comparatif et harmonisation des décisions — 2026-10-05

> État et backlog historiques remplacés depuis par la mise à jour du 08/10 ci-dessus.

- Rejeu local des validations sur l’archive : **52 tests Django détectés : 51 réussis et 1 ignoré**, `check`, migrations, lint et build Next.js passés; build avec 26 routes.
- Correction du rapport d’audit ancien : Argon2id est configuré; les callbacks OAuth/`AuthIdentity` existent; un backend QR à jeton haché/usage unique existe; l’attestation SVG a déjà une blacklist partielle, empreinte SHA-256 et horodatage. Ces fonctions restent partielles, pas déclarées complètes.
- Décisions du porteur consignées à cette date : OTP SMS et MFA/TOTP en V3; onboarding identité/avatar puis choix Patient/Professionnel; établissement privé et administrateur nominatif (pas de rôle global « Root »); équipe E‑Carnet vérifie la structure; l’administrateur établissement gère le rattachement.
- Les deux roadmaps ont été harmonisées; les prototypes sont explicitement référence de design mobile, non de flow produit.
- État UI constaté : textes d’authentification français et logo E-carnet; navigation encore fondée sur glyphes Unicode; alignement visuel mobile à terminer.
- À la date de cette entrée, A9, le sanitizer strict, le flow établissement complet et certains parcours UI restaient ouverts ; ces points ont depuis été décidés ou implémentés selon [l’état réel V1](ETAT-REEL-V1.md).
- Aucune modification du code applicatif dans cette mise à jour; changements limités à la documentation.

## V1 — parcours complet et alignement de la recette — 2026-10-04

- Ajout d’un test d’intégration patient → demande AccessGrant → consentement → pré-consultation clôturée → consultation → révocation.
- Sessions serveur et protections d’accès clinique; TOTP/MFA reporté en V3 selon la décision produit actuelle.
- `DJANGO_SECRET_KEY` exigée hors DEBUG; contrôles de tests ciblés.
- Rapport antérieur indiquait 38 tests API à ce moment-là; le dépôt audité le 05/10 contenait 52 tests détectés, avec 51 réussis et 1 test ignoré ; cette formulation est historique et le code a depuis été corrigé. Cette entrée est historique ; voir l’état réel V1 pour le verdict courant.
- À la date de cette entrée : staging, trigger PostgreSQL réel, restauration, Android/4G, OAuth fournisseurs et validations métier restaient à exécuter. Voir la mise à jour du 08/10 pour les preuves PostgreSQL/restauration ultérieures.

## V1 — tranche de sécurisation et préparation de recette — 2026-10-03

- Next.js 16.3.8 et configuration ESLint flat; avis de dépendances à réévaluer.
- Audit append-only, endpoints patient/professionnel, établissement actif, historique et tests d’isolation progressivement ajoutés.
- Seed locale `example.test` opt-in; ne jamais exécuter sur staging partagé/production.
- La suite de tests évoluait pendant les travaux; consulter la recette datée pour l’état courant.

## 0.1.0 — 2026-10-03

- Création du monorepo Next.js/Django, Compose local, CI et préférences de thème par compte.
- Documentation initiale, API et prototypes archivés.

Les entrées historiques consignent l’état à leur date; pour l’état courant, voir [rapport d’audit](RAPPORT-AUDIT-ECARNET.md), [roadmap](ROADMAP-V1-V5.md) et [recette](RECETTE-V1.md).
