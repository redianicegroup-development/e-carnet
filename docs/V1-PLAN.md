# Plan d’implémentation — V1 de Mon Carnet Numérique

**État revu le 08/10/2026 :** V1 en construction, non acceptée. Ce plan est un aide-mémoire, pas une liste de tâches à appliquer aveuglément : comparer chaque point au [code et aux preuves](ETAT-REEL-V1.md), et prendre les flows dans la [roadmap active](ROADMAP-V1-V5.md). Les prototypes ne dictent que la direction visuelle.

## Périmètre et règles

- Application mobile-first, comptes uniques; contexte public limité à Patient / Professionnel.
- L’établissement est privé, sans inscription publique, avec un administrateur nominatif (un seul actif en V1); pas de rôle global `root`. La structure envoie ses preuves par e-mail à E‑Carnet; staff vérifie puis crée le compte. Invitation unique 48 h, mot de passe choisi par le destinataire. Le médecin est vérifié en interne par la structure; aucun justificatif personnel ne remonte à E‑Carnet. Code médecin 48 h/une fois → demande en attente → approbation établissement.
- Aucun accès clinique espace établissement. Dossiers demandés/consultés par le professionnel après rattachement actif, établissement actif et consentement patient.
- OTP SMS et TOTP/MFA : V3, non prérequis V1. Aucun rôle ou endpoint infirmier autonome.
- Données fictives uniquement avant l’autorisation formelle de traitement réel.

## État des jalons

| Jalon | État du dépôt audité |
|---|---|
| 1. Socle | Présent : monorepo, Next.js/Django, sessions, CSRF, migrations et Docker Compose. Tests PostgreSQL 16 et smoke de restauration locale réussis le 08/10 ; staging managé et Docker Compose bout en bout non démontrés. |
| 2. Identité/onboarding | Partiel : email, `AuthIdentity` et callbacks OAuth existent; onboarding identité/avatar → choix Patient/Professionnel → formulaire contextuel présent ; recette métier restante. Argon2id est configuré. |
| 3. Patient | Socle présent : profil, déclarations/provenance, pré-consultation, clôture, consultations et historique; recette terrain encore requise. |
| 4. Startup/administrateur établissement/professionnel | Implémenté côté API/UI : route publique neutralisée, console staff, administrateur nominatif, invitation 48 h, code médecin 48 h à usage unique et décision établissement. |
| 5. AccessGrant | Consentement, expiration 2 h, 2 prolongations d’1 h, révocation et audit présents. QR génération/scan partiellement intégrés (UUID patient toujours requis séparément), jeton à usage unique/hash/5 min ; scopes A9 appliqués. |
| 6. Consultation | Flux consultation présent; SVG parsé avec allowlist stricte, hash et horodatage; sanitizer robuste et tests hostiles présents. |
| 7. Public/PWA | Pages publiques, manifest, SEO et service worker présents; vérifier déploiement réel et éviter toute donnée privée mise en cache. |
| 8. Qualité/recette | 77 tests PostgreSQL 16 locaux réussis le 08/10 ; smoke de restauration isolée réussi, RPO/RTO opérationnel non mesuré. Check, migrations, lint/build (27 routes) et smoke Chromium datent du 05/10. Staging, mobile réel, revue de dépendances actuelle et validation produit restent à faire. |

## Décisions produit confirmées

- Compte unique; liaison OAuth explicite sans fusion silencieuse.
- Fournisseurs voulus : e-mail/mot de passe, Google, Facebook et Apple (Apple soumis aux credentials Developer). OTP SMS reporté en V3.
- Onboarding en 3 étapes : identité de base/avatar éditable; choix Patient ou Professionnel; formulaire de rôle.
- Médecin : identité et profil nécessaires; pas d’upload de pièces personnelles à E‑Carnet. Vérification interne par l’établissement; code 48 h à usage unique crée une demande, puis l’établissement accepte/refuse.
- Startup reçoit les preuves structure par e-mail, vérifie via ses équipes et crée l’accès administrateur nominatif à partir d’une console privée. Pas de Root global. Invitation unique 48 h pour choisir le mot de passe; aucun secret transmis par e-mail.
- Un admin établissement actif par structure en V1; changement d’admin sans recréer la structure. Plusieurs admins éventuels plus tard.
- Conserver les événements et anciennes associations; suspension/révocation plutôt que suppression. L’espace établissement n’accède pas aux dossiers médicaux.
- MFA TOTP reporté en V3; résidus TOTP dans le code ne doivent pas être présentés comme requis V1.
- Prototypes : référence de design responsive/mobile seulement; anciens flows obsolètes ne sont pas à réintroduire.

## Points à terminer avant pilote

Le modèle et le flow établissement sont désormais présents dans l’archive. Les points ci-dessous sont les **finitions et preuves restantes**, et non des fonctionnalités entièrement absentes :

1. **Flow établissement :** SMTP configurable livré ; aucun token brut n’est retourné par l’API ; valider SMTP, le domaine, SPF/DKIM/DMARC et le parcours de réception en staging.
2. **Recette établissement :** les tests PostgreSQL locaux couvrent maintenant concurrence, consentement, terminaison et invitation ; les rejouer sur PostgreSQL/staging et couvrir le remplacement admin, les permissions et SMTP réel.
3. **Onboarding :** implémentation identité/avatar et formulaires présents ; recetter la reprise de parcours et le métier en staging.
4. **OAuth :** callback, retour UI, liaison/déliaison et audit présents ; fournir les credentials, URLs et tests fournisseurs réels.
5. **QR/scopes :** A9 est décidé et appliqué. Le scan/saisie du jeton existe, mais le professionnel doit encore saisir l’UUID patient ; valider ou compléter ce parcours et recetter sur mobile/staging.
6. **Sécurité :** sanitizer SVG strict et tests adversariaux présents ; rejouer le rendu en staging et maintenir TOTP hors des prérequis V1.
7. **Exploitation :** staging, PostgreSQL/trigger, sauvegarde-restauration/RPO-RTO, Android/4G, accessibilité, icônes/mobile et dépendances.
8. **Go/No-Go :** obtenir les validations médicales, juridiques et sécurité avant toute donnée réelle.

## Vérifications exécutées


Le 05/10/2026 : les résultats consignés étaient 57 tests OK et 1 ignoré sous SQLite, `check`, migrations, lint et build réussis, 27 routes. Le 08/10 : 77 tests PostgreSQL 16 réussis et smoke de restauration locale isolée réussi (rapports dans `reports/`). Les alertes npm/Authlib datent du 05/10 et leur état actuel n’est pas revérifié. Aucun de ces résultats n’est une recette staging ni un audit sécurité indépendant.
