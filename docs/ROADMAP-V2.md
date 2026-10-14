# Idées complémentaires avant et pendant la V2 — Mon Carnet Numérique

> Pistes issues de la revue des versions 1.7 à 1.9 (14/10/2026). Elles **complètent** la V2 « prévention et suivi quotidien » de [ROADMAP-V1-V5](ROADMAP-V1-V5.md) §8 sans la remplacer : mesures, rappels de médicaments, vaccination, rendez‑vous, messagerie et contenus éducatifs restent définis là‑bas. Ce ne sont **pas des engagements** : à arbitrer après la recette et le pilote avec données fictives. Pas de données réelles avant hébergement ivoirien, validation juridique et médicale, restauration testée et Go/No‑Go formel.

Légende effort : **S** = quelques jours · **M** = 1 à 3 semaines · **L** = plus d'un mois.

## Déjà couvert par la 1.9 (à ne pas refaire)

Carte d'urgence (QR, PDF, appel en un geste), profils représentés et demandes de transfert de représentation, question de récupération complémentaire, journal d'accès décrivant les ressources réellement consultées, pré‑consultation en écrans successifs, accès professionnel par QR seul, nouvelle barre latérale des espaces. Leur recette sur vrais appareils reste à faire.

## 1. Socle à consolider d'abord

| Idée | Pourquoi | Effort | Prérequis / risque |
|---|---|---|---|
| **Réinitialisation du mot de passe** | La question de récupération est enregistrée mais n'ouvre rien à elle seule (volontairement) : il manque la vérification complémentaire (e‑mail ou SMS) qui permet réellement de récupérer un compte | M | Courriel fiable, anti‑énumération de comptes, limitation d'essais ; lien avec l'OTP SMS de la V3 |
| **Courriel transactionnel validé** | L'invitation d'établissement n'existe qu'en clair dans le courriel : si le SMTP n'est pas fiable, l'onboarding s'arrête | S | Fournisseur choisi, SPF/DKIM, suivi des rebonds |
| **Console équipe complète** : remplacer l'administrateur d'un établissement depuis l'interface, suspendre/réactiver une structure, journal d'audit consultable | L'API remplace déjà un administrateur (`confirm_replace`) ; l'interface a la liste, le renvoi et la révocation | M | Qui, dans l'équipe, peut suspendre ; message envoyé à l'établissement |
| **Tests de bout en bout** (Playwright) sur : connexion, invitation → fiche → code médecin, demande d'accès patient, carte d'urgence | Les tests actuels vérifient le code, pas le navigateur | M | Environnement de recette stable |
| **CI** : lint, typecheck, tests web et API, `makemigrations --check` à chaque envoi | Un test OAuth cassé par la 1.9 (redirection vers `/onboarding/securite`) et cinq tests cassés par le consentement cookies à la 1.7 ont circulé sans alerte | S | — |
| **Observabilité** (erreurs front/back, alerte sur échec d'envoi de courriel) | Un échec d'envoi est visible dans la console équipe, mais personne n'est prévenu | S | Aucune donnée de santé dans les logs |

## 2. Côté patient

| Idée | Valeur | Effort | Prérequis / risque |
|---|---|---|---|
| **Notifications d'accès** : demande reçue, accès accepté, accès qui expire (courriel, puis dans l'application) | Une demande attend aujourd'hui que la personne ouvre l'application | M | Contenu minimal dans les courriels, aucune donnée de santé |
| **Alerte quand la carte d'urgence est consultée** | Complète la page publique de la 1.9 : la personne sait quand et si elle a servi | S–M | Journaliser la consultation de la page publique sans collecter plus que nécessaire |
| **Résumé périodique des accès** (« qui a vu quoi ce mois‑ci ») | Renforce « vous gardez la main » ; s'appuie sur le journal existant | S | Fréquence choisie par la personne |
| **Export du carnet** (PDF, puis FHIR en V4) | Prévu en V1.x pour le PDF ; la portabilité complète reste à cadrer | M | Périmètre validé, journal des exports |

## 3. Côté professionnel et établissement

| Idée | Valeur | Effort | Prérequis / risque |
|---|---|---|---|
| **Plusieurs administrateurs par établissement** (admin, secrétariat) | Prévu par l'[ADR‑002](adr/ADR-002-etablissement-invitation-et-rattachement.md) pour « une version future » | M | Rôles et droits, remplacement sans perte d'historique |
| **Tableau de bord établissement** (médecins rattachés, codes actifs, demandes en attente) | Visibilité sans toucher aux dossiers | S | Compteurs seulement, jamais de données cliniques |
| **Modèles de pré‑consultation par établissement** | Les structures posent des questions différentes | M | Validation médicale des modèles |
| **Relance à l'équipe quand une invitation expire sans activation** | Évite les établissements « oubliés » | S | Liste de la console équipe (en place) |

## 4. Accessibilité et conditions d'usage locales

| Idée | Valeur | Effort | Prérequis / risque |
|---|---|---|---|
| **Audit clavier et lecteur d'écran** des écrans récents (connexion à deux volets, bannière cookies, fiche d'établissement, confirmations) | Les contrastes sont déjà garantis par `resolveTheme()` sur les 5 palettes ; le parcours au clavier et les annonces vocales (bulle du personnage, messages d'état) ne sont pas testés avec un vrai lecteur d'écran | S | Grille de test, un testeur utilisant un lecteur d'écran |
| **Carnet en lecture hors ligne** au‑delà de la carte d'urgence, et faible débit | Connexions instables | L | Chiffrement local, effacement sur appareil partagé, revue juridique (déjà exigée pour les proches) |
| **Langage simple, pictogrammes, lecture audio** | Publics peu à l'aise avec l'écrit | M | Contenus relus par des utilisateurs réels ; langues locales à décider |
| **OTP SMS puis MFA TOTP**, compte établissement en priorité | Prévus en V3 ; l'établissement approuve les médecins | M | Coût et fiabilité des SMS |

## 5. Conformité et exploitation

- **Politique de rétention, export et suppression des données** : à faire valider par un juriste (droit ivoirien de la protection des données personnelles, autorité de contrôle comprise).
- **Sauvegardes** : mesurer un RPO/RTO réel sur l'environnement géré.
- **Hébergement** : la décision Vercel + Render + Neon vaut pour V1/V2 ; la localisation des données reste à valider.
- **Revue de sécurité externe** avant tout pilote avec de vraies personnes, en particulier : activation d'invitation, droits staff, carte d'urgence publique, transferts de représentation.

## 6. Ordre proposé

1. **Lot A (avant pilote) :** courriel validé, CI, tests de bout en bout, console équipe complète, réinitialisation du mot de passe.
2. **Lot B (pilote fictif) :** notifications d'accès, alerte de consultation de la carte d'urgence, tableau de bord établissement, audit d'accessibilité.
3. **Lot C (avec la V2 « prévention et suivi ») :** plusieurs administrateurs, export, lecture hors ligne, modèles de pré‑consultation.

## 7. Observations de la revue non traitées dans le code

- **Archives** : les archives 1.7 et 1.9 contiennent encore `apps/api/.env` et `apps/api/db.sqlite3`. Utiliser `scripts/make-archive.sh` et changer les secrets déjà partagés (voir [SECURITY](SECURITY.md)).
- Quatre avertissements ESLint (`<img>` non optimisé dans les paramètres et le sélecteur d'avatar).
- Le bouton « Donner votre avis » recouvre le bas du cadre de connexion sur grand écran.
