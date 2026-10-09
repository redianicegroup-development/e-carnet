# Runbook — staging, restauration et pilote fictif V1

**État revu le 08/10/2026 :** procédure préparatoire. PostgreSQL 16 local et un smoke de restauration isolée ont réussi ; aucun staging, fournisseur OAuth réel ni essai Android/4G n’est documenté. Ce document n’autorise pas le traitement de données réelles. Voir les rapports [tests PostgreSQL](../reports/postgres-tests-20261008.txt) et [restauration](../reports/postgres-restore-20261008T081823Z.txt).

## 1. Données et limites

Utiliser uniquement des identités/dossiers inventés (`example.test`, `TEST-*`). Ne pas copier téléphone, dossier, email, pièce ou données médicales réelles dans les tests, captures, logs, tickets ou outils d’IA. Le MFA/TOTP et l’OTP SMS sont reportés en V3; aucun test V1 ne doit imposer TOTP. Le pilote reste fictif tant que l’hébergement ivoirien et les gates Go/No-Go ne sont pas approuvés.

## 2. Préconditions staging

1. Appliquer la [roadmap](ROADMAP-V1-V5.md) et la [matrice CA-01 à CA-24](RECETTE-V1.md); A8–A16 conservent des validations métier/juridiques ouvertes.
2. Configurer secrets propres au staging, HTTPS, domaines web/API, cookies, CSRF/CORS, hôtes autorisés et désindexation.
3. Enregistrer les callbacks OAuth auprès des fournisseurs; ne pas activer Google/Facebook/Apple tant que credentials et URLs ne sont pas vérifiés. Apple demande un setup Developer spécifique.
4. Exécuter migrations, tests et audit des dépendances; appliquer/vérifier le trigger d’audit sur PostgreSQL.
5. Vérifier service worker, exclusion des APIs et espaces privés du cache.
6. Le flow établissement est présent côté API/UI, mais ne pas l’utiliser pour des accès réels avant la configuration SMTP de staging et la recette PostgreSQL et la validation des permissions.

## 3. Comptes et scénarios fictifs

| Compte d’essai | Usage |
|---|---|
| `patient.demo.001@example.test` | Profil et carnet synthétiques; consentement AccessGrant. |
| `medecin.demo.001@example.test` | Profil professionnel et établissement A fictifs. Aucun TOTP requis en V1. |
| `admin.etablissement.demo.001@example.test` | Administrateur établissement nominatif fictif, à activer via le flow d’invitation privé déjà livré. |
| `medecin.demo.002@example.test` | Contexte établissement B pour essais d’isolation. |

La seed locale est uniquement pour développement local explicitement opt-in; son état `verified` ne constitue pas une vérification réelle.

## 4. Parcours de recette (code présent ; succès staging non établi)

1. Créer un compte unique par e-mail/social; tester un second fournisseur, conflit d’e-mail sans fusion, session, déconnexion et liaison explicite.
2. Tester onboarding étape 1 (nom/prénoms/avatar modifiable), étape 2 (Patient/Professionnel), étape 3 (formulaire propre au contexte); interrompre/reprendre.
3. Patient : profil fictif, pré-consultation, brouillon/clôture et traces.
4. Structure : simuler la réception de preuves structure par la boîte officielle (sans upload public); staff autorisé valide/refuse dans sa route privée. Après validation, créer l’établissement et un admin nominatif, puis émettre invitation unique 48 h.
5. Responsable : ouvrir une invitation une fois, définir son mot de passe; rejeter lien expiré, consommé, révoqué ou envoyé à une adresse non liée. Vérifier qu’aucun secret n’est transmis par e-mail.
6. Admin établissement : générer un code médecin valable 48 h et à usage unique; tester l’expiration, la révocation et la double consommation concurrente.
7. Médecin : utiliser son compte Professionnel déjà existant, saisir un code, vérifier demande `pending`, puis l’admin établissement accepte/refuse. Aucun justificatif médecin ne doit être demandé ou stocké sur E‑Carnet.
8. Remplacer l’administrateur : conserver l’entité établissement et l’historique; l’ancien compte perd l’accès structure; vérifier qu’un admin ne peut agir sur une autre structure.
9. Médecin rattaché : choisir établissement actif et demander un AccessGrant; aucune donnée avant consentement patient.
10. QR : générer côté patient, scanner/saisir le jeton et saisir l’UUID patient requis par le formulaire actuel ; vérifier absence de donnée de santé dans le QR, usage unique et expiration de 5 minutes.
11. Patient : vérifier identité du professionnel, structure, scopes et durée; refuser/accepter, prolonger puis révoquer.
12. Professionnel : lire uniquement selon AccessGrant; tenter IDs/URLs d’une autre structure; vérifier que le compte admin établissement reçoit 403/404 sur toutes routes cliniques.
13. Tester les charges SVG hostiles; confirmer rejet/sanitation, hash et horodatage; vérifier stockage/rendu.
14. Confirmer l’absence de TOTP obligatoire, OTP SMS et rôle infirmier autonome en V1.
15. Répéter sur navigateur mobile et Android/4G; inspecter focus, lecteur d’écran, clavier, session expirée et absence de cache privé.

La console staff, le compte admin établissement, les invitations SMTP et les codes 48 h sont présents côté API/UI. Les tests PostgreSQL 16 et les tests locaux du sanitizer SVG sont documentés ; restent la configuration e-mail de staging, OAuth fournisseur, le flux QR complet sur mobile et les preuves de staging. Ne pas déclarer ces scénarios réussis avant preuve d’exécution.

## 5. Sauvegarde et restauration

Un smoke local PostgreSQL 16 a réussi le 08/10 et restauré une archive dans une base isolée, sans modifier la source. Rejouer la procédure contre la cible de staging et ses sauvegardes planifiées. Avant de clore CA-22, obtenir des objectifs RPO/RTO approuvés; enregistrer heures UTC, empreintes, durées, marqueurs synthétiques et résultat d’un test de lecture applicative. Aucun dump ni identifiant ne doit entrer dans Git.

## 6. Mobile et design

Les prototypes sont une référence visuelle mobile, pas une source de flows. Vérifier navigation compacte, icônes cohérentes, densité des cartes, proportions, contrastes, focus et zones tactiles, sans réintroduire leurs parcours périmés. Les glyphes Unicode actuels de la navigation doivent être remplacés dans le travail UI.

## 7. Sortie du pilote fictif

Clore seulement avec preuves staging, mobile et ordinateur pour CA-01 à CA-24, OAuth configuré, console staff/admin établissement testée, invitations et codes uniques testés, sécurité SVG revue, QR/scopes ratifiés, trigger PostgreSQL, restauration RPO/RTO et dépendances traitées. Toute fuite inter-établissements, donnée réelle non autorisée ou lecture sans consentement entraîne arrêt et procédure d’incident (A16).
