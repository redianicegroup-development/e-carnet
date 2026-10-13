# État réel du projet — V1

**État documentaire revu : 13/10/2026 — base v1.8 et modifications locales en cours**  
**Comparaison :** preuves historiques horodatées ci-dessous; les changements locaux du 13/10 sont vérifiés par les contrôles listés, mais ne sont ni déployés ni acceptés
**Verdict : V1 en construction, non acceptée et non autorisée pour des données de santé réelles.**

## Résumé exécutif

> **Source actuelle pour l’état d’implémentation.** La roadmap porte les décisions produit ; ce document et les rapports datés décrivent les preuves. Les anciens plans/audits ne sont pas des listes actives de tâches sans comparaison au code.


Le dépôt contient un socle fonctionnel sérieux : monorepo Next.js/Django, sessions serveur, CSRF, profils patient/professionnel, pré-consultations, AccessGrant, consultations, audit, PWA et un flow établissement désormais largement implémenté côté API et interface.

La V1 n’est toutefois pas finalisée :

- la preuve la plus récente est **77 tests réussis sur PostgreSQL 16 local, zéro échec et zéro ignoré**, le 08/10 ; elle n’équivaut pas à une recette de la base managée de staging ;
- la génération QR côté patient, le scan/saisie côté professionnel et l’API existent. Le correctif local du 13/10 retire le champ UUID séparé et ajoute un test de contrat QR seul; ce test et le parcours mobile doivent encore être exécutés;
- le correctif local ajoute un journal patient des ressources et quantités lues, avec instant, durée snapshotée du droit et expiration; à confirmer par tests et recette staging;
- les préférences d’apparence ont été étendues aux couples de polices et à trois tailles de texte; synchronisation API, cache et application selon l’espace restent à confirmer par tests/build;
- A9 est décidé : QR à usage unique de 5 min ; scopes par défaut `preconsultation` + `declarations`, `consultations` sélectionnable et `documents` hors V1 ;
- callbacks et interface de liaison/déliaison OAuth présents ; credentials réels, essais avec les fournisseurs et contrôle de sécurité du parcours restent à faire ;
- la sanitation SVG est maintenant une allowlist stricte, couverte par des tests adversariaux ;
- l’invitation utilise le transport SMTP Django configurable ; le jeton brut n’est jamais renvoyé par l’API, même en mode debug ;
- PostgreSQL 16 local et restauration isolée locale sont démontrés ; Docker Compose de bout en bout, cible PostgreSQL managée, sauvegardes planifiées, RPO/RTO opérationnel, staging, mobile/4G et validations médicales/juridiques ne sont pas démontrés.

## Contrôles et preuves disponibles (dates/contextes explicites)

| Contrôle | Résultat |
|---|---|
| Tests Django sur PostgreSQL 16, 08/10 | **OK** : 77 réussis, 0 échec, 0 ignoré ; preuve la plus récente disponible |
| Smoke de sauvegarde/restauration locale PostgreSQL, 08/10 | **OK** : restauration isolée, marqueur et migrations vérifiés ; commande de restauration 1 s, non assimilable au RTO |
| Suite SQLite rapportée le 05/10 | **Historique :** 57 tests OK, 1 ignoré dans un rapport ; 71 OK, 1 ignoré dans un rapport ultérieur du même jour |
| `npm run check:api`, migrations, lint | **OK historiquement** le 05/10 ; non rejoués dans cette mise à jour |
| `npm run build` | **OK historiquement** le 05/10 ; les rapports donnent 27 ou 31 routes selon la passe ; nombre actuel non revérifié |
| `npm ci` / avertissement Authlib | Observations du 05/10 : 5 vulnérabilités `high` dans l’arbre npm et dépréciation `authlib.jose` ; état actuel non revérifié |
| Contrôles locaux ciblés du 13/10 | Build Next.js OK; lint sans erreur (4 avertissements `img`); 12 tests Django identité OK; migration sans changement manquant |
| Suite web complète du 13/10 | **24/44 réussis, 20 échecs** dus aux chemins de fichiers Windows construits en `C:\C:\...`; résultat non concluant pour les tests concernés |

Les comptes et marqueurs de recette sont synthétiques. Les divergences de comptage des rapports du 05/10 ne changent pas le résultat PostgreSQL daté du 08/10. Les contrôles locaux du 13/10 ne constituent ni une recette staging ni un audit de sécurité indépendant.

### Note sur les anciens rapports de tests

Les mentions d’échecs sur l’ancienne création publique d’établissement, l’ancien code permanent et le gate global `verified` correspondent à un état antérieur. Le contrat courant est privé : staff crée l’établissement, invitation par e-mail, code à usage unique puis décision par l’établissement. **Ne pas restaurer les anciens tests ou comportements** ; voir [la roadmap](ROADMAP-V1-V5.md), [ADR-002](adr/ADR-002-etablissement-invitation-et-rattachement.md) et les tests du code courant.

## Ce qui est réellement présent

### Socle et identité

- Next.js 16 / React 19, Django 5.2 / DRF et PostgreSQL cible ; SQLite reste la base locale par défaut, et la suite PostgreSQL 16 a aussi été exécutée le 08/10.
- Session serveur, cookies HttpOnly/Secure hors debug, CSRF/CORS configurés ; pas de JWT dans `localStorage`.
- Argon2id configuré comme premier hasher Django.
- Compte unique avec choix Patient ou Professionnel ; `AuthIdentity` et callbacks Google/Facebook/Apple présents.
- Onboarding identité/avatar → contexte → formulaire métier → question de récupération complémentaire présent ; la réponse est hachée et le profil de compte est distinct du dossier patient.
- La question de récupération ne constitue pas à elle seule un parcours de récupération : aucune vérification par SMS ni réouverture du dossier sur cette seule preuve n’est implémentée.

### Patient, accès clinique et consultation

- Profil patient, déclarations, pré-consultation brouillon/clôture, historique et consultation persistée.
- AccessGrant : demande, consentement/refus, expiration serveur à 2 h, deux prolongations d’1 h et révocation.
- Le garde clinique exige maintenant un contexte professionnel actif, un établissement actif, un rattachement actif et le consentement patient ; le statut global `verification_status == verified` n’est plus le contrôle d’accès dans `professionals/access.py`.
- Le backend QR émet un jeton opaque hashé, à usage unique, avec validité produit de 5 minutes ; les scopes V1 sont appliqués.
- L’attestation SVG est parsée, sanitationnée par allowlist stricte, hashée en SHA-256 et horodatée ; les charges script/CSS/URL/DTD sont couvertes par tests.

### Établissement et rattachement médecin

Le nouveau flow est **largement présent** :

- création et validation via routes staff protégées ; la route publique historique est neutralisée ;
- modèle `EstablishmentAdministrator` séparé, nominatif et historisé ; un seul administrateur actif par structure en V1 ;
- invitation hashée, unique et valable 48 h ; le responsable choisit son mot de passe ;
- modèle de code médecin hashé, à usage unique et valable 48 h ; la saisie crée `pending` ;
- acceptation/refus par l’administrateur établissement ; suspension/départ historisé ;
- isolation entre établissements et espace établissement sans lecture clinique ;
- pages web de console staff, activation d’invitation, gestion établissement et rattachements présentes.

Limites restantes : configurer et vérifier SMTP/délivrabilité en staging, tester les permissions et durcir la console staff avant production. Ne jamais réintroduire le jeton brut dans une réponse API.

### Frontend et PWA

- Pages Patient, Professionnel, Établissement, Staff, onboarding, sécurité et FAQ présentes. Les comptes-rendus de build du 05/10 donnent 27 ou 31 routes selon la passe ; ce total est historique et doit être revérifié avant de s’y référer.
- Manifest/service worker présents ; aucune donnée médicale ne doit être mise en cache.
- Un smoke Chromium headless valide 6 routes pour mobile/accessibilité de base ; la recette Android/iOS/4G et l’audit WCAG 2.2 AA complet restent à faire.
- Le formulaire QR v1.8 permet scan/saisie du jeton. Le retrait local du champ UUID ajouté le 13/10 n’est pas encore validé par les tests/build.

## Travaux restants pour déclarer la V1 finalisée

### Bloquants fonctionnels immédiats

1. Rejouer les tests sur la base PostgreSQL managée de staging, notamment concurrence, isolation, refus et révocation.
2. Recetter en staging le transport SMTP, SPF/DKIM/DMARC, délivrabilité, expiration et procédure de renvoi ; ne jamais exposer le jeton dans une réponse API.
3. Recetter QR/A9 sur mobile : durée produit de 5 minutes et scopes décidés ; vérifier le contrat QR seul et l’absence d’exigence d’UUID distinct.
4. Recetter l’onboarding identité/avatar et les formulaires métier ; l’avatar URL est livré, l’upload de fichier n’est pas prévu en V1.
5. Rejouer la sanitation SVG stricte sur le pipeline de staging et vérifier le rendu avec le composant final.

### Bloquants sécurité et exploitation

6. Tester sur PostgreSQL de staging les permissions DB, le trigger append-only et l’interdiction `TRUNCATE` ; concurrence et isolation A/B ont déjà une preuve locale PostgreSQL 16.
7. Rejouer sauvegarde/restauration isolée sur staging ; approuver et mesurer le RPO/RTO opérationnel. La preuve locale du 08/10 ne mesure que la durée d’une commande de restauration.
8. Configurer et tester OAuth Google/Facebook/Apple sur staging, avec callbacks réels, retour UI, liaison/déliaison explicite, audit et Apple Developer.
9. Faire un audit npm actuel (la mention de 5 vulnérabilités `high` date du 05/10) et traiter ses constats ; migrer `authlib.jose` vers `joserfc` avec tests JWT Apple ou documenter une décision justifiée.
10. Vérifier rate limiting, cookies/CSRF sur domaines réels, stockage privé, rétention, procédure d’incident et absence de cache privé.

### Validation produit et Go/No-Go

11. Faire valider médicalement les champs de pré-consultation/consultation, unités et corrections.
12. Formaliser les décisions juridiques sur hébergement ivoirien, conservation, droits, e-mail des justificatifs structure et incidents.
13. Recetter navigateur mobile, Android/4G, clavier, lecteur d’écran, focus, session expirée et responsive desktop.
14. Corriger les chemins Windows de la suite web puis rejouer les 20 tests actuellement en échec; les contrôles ciblés du 13/10 (build, lint, 12 tests Django identité et migration) sont passés localement.
15. Réaliser une recette staging complète CA-01 à CA-24 avec SMTP réel, QR sur mobile et preuves horodatées, puis prendre une décision Go/No-Go. Tant que cette étape n’est pas signée, utiliser uniquement des données `example.test`.

## Documents de référence

- [Roadmap V1–V5](ROADMAP-V1-V5.md)
- [Plan V1](V1-PLAN.md)
- [Matrice de recette](RECETTE-V1.md)
- [Sécurité](SECURITY.md)
- [Flow établissement](FLOW-ETABLISSEMENT.md)
- [Audit détaillé](RAPPORT-AUDIT-ECARNET.md)
