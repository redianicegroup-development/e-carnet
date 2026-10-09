# Décisions produit et validations restantes — A1 à A16

**Mise à jour : 08/10/2026.** Ce journal porte les décisions produit ; pour l’implémentation et les preuves, utiliser [l’état réel V1](ETAT-REEL-V1.md) et [la matrice de recette](RECETTE-V1.md). Les décisions ne valent ni validation médicale/juridique ni recette de déploiement.

## Décisions les plus récentes (source produit)

| Sujet | Décision du porteur | État du code observé |
|---|---|---|
| Rôles | Inscription publique limitée à Patient/Professionnel. L’établissement est un espace privé accessible à un administrateur nominatif; pas de rôle Root global. | Choix Patient/Professionnel présent ; route publique établissement neutralisée ; espace établissement lié à `EstablishmentAdministrator`. |
| Onboarding | Étape 1 identité (nom, prénoms, avatar modifiable); étape 2 choix Patient/Professionnel; étape 3 formulaire conditionnel. | Implémenté côté web/API ; avatar par URL éditable, sans upload de fichier ; recette métier restante. |
| Patient | Nom/prénoms et avatar modifiable; date de naissance; téléphone facultatif, format local. Couverture/profil ensuite selon les champs retenus. | Étape identité/avatar puis formulaire patient présents ; recette médicale et UX restante. |
| Professionnel/médecin | Le médecin a déjà son compte Professionnel; sa vérification se fait en interne avec l’établissement. Il saisit un code à usage unique (48 h), ce qui crée une demande; l’établissement décide. Pas de justificatifs personnels envoyés à E‑Carnet. | Code hashé à usage unique, conditions versionnées acceptées avant consommation, demande `pending`, décision établissement et résiliation par les deux côtés présents ; tests PostgreSQL locaux du 08/10. |
| Structure / startup | L’établissement envoie les preuves par e-mail à E‑Carnet; un staff vérifie dans une route privée et crée un compte administrateur nominatif après validation. | Console staff et invitation hashée 48 h présentes ; SMTP configurable. Configuration et délivrabilité staging restent à tester. |
| Administrateur établissement | Un administrateur principal nominatif en V1, associé à une seule structure; peut être changé sans recréer la structure. Invitation unique 48 h, mot de passe défini par le destinataire. | Relation historisée et flow d’invitation présents ; le jeton brut n’est jamais renvoyé dans une réponse API. |
| Dossiers cliniques | Demandés et lus dans le contexte Professionnel, après approbation du rattachement par l’établissement, établissement actif et consentement patient. L’espace établissement ne donne aucun accès clinique. | Garde serveur par contexte professionnel, établissement/rattachement actifs et AccessGrant/consentement ; tests locaux, à répéter sur staging. |
| Connexion | E-mail/mot de passe, Google, Facebook, Apple; un compte unique. Liaison explicite après authentification; pas de fusion silencieuse par email. | Callbacks, retour UI, interface de liaison/déliaison, audit et contraintes anti-doublon présents ; credentials et recette fournisseurs réels restent à faire. |
| OTP SMS | Repoussé en V3. WhatsApp non retenu. | Aucun flow SMS; cohérent avec le report V3. |
| MFA/TOTP | Repoussé en V3; ne bloque pas V1. | Endpoints et stockage des secrets retirés de V1; réimplémentation V3 avec stockage chiffré et limitation des essais. |
| QR | QR opaque, usage unique, sans donnée médicale, valable 5 minutes. | API et UI de génération/scan présentes ; l’API ne conserve que le hash et consomme le jeton à la création de la demande. L’UUID patient doit encore être saisi séparément. |
| Scopes AccessGrant | V1 : `preconsultation` + `declarations` par défaut ; `consultations` sélectionnable ; `documents` hors V1. | Contrat appliqué côté API et visible dans les écrans. |
| Design | S’inspirer de l’expérience générale des prototypes en mobile (icônes, navigation, densité, proportions), sans reprendre leurs parcours obsolètes. | Textes auth français et marque E-carnet présents; navigation utilise encore des glyphes Unicode; composition mobile reste à rapprocher. |

### Explication — « scopes hardcodés »

Un scope est le périmètre précis de données couvert par l’autorisation du patient. « Hardcodé » signifie que les options et valeurs sont directement écrites dans le code. La décision A9 est appliquée : `preconsultation` + `declarations` par défaut, `consultations` sélectionnable, `documents` hors V1. Les valeurs présentes ne sont pas une décision ouverte ; la recette UX mobile/staging reste nécessaire.

## État des décisions A1–A16

| ID | Sujet | État et suite requise |
|---|---|---|
| A1 | OTP WhatsApp | **Décidé :** exclu. Ne pas l’intégrer. |
| A2 | Authentification | **Décidé :** e-mail/mot de passe, Google, Facebook et Apple; identité unique et liaison explicite. **Implémenté :** callbacks, retour UI, liaison/déliaison et audit. **Restant :** credentials, URLs réelles et tests fournisseurs. SMS est V3. |
| A3 | Récupération/MFA | **Décidé :** MFA/TOTP V3. Règles détaillées de récupération de compte à préciser; pas de contournement ad hoc. |
| A4 | Vérification structure et compte établissement | **Décidé :** la structure envoie ses justificatifs à l’adresse officielle E‑Carnet; un staff vérifie via une route privée puis crée l’accès nominatif. Un administrateur principal en V1. Invitation unique 48 h; le destinataire définit son mot de passe. Aucune demande/upload public. Rétention des pièces e-mail à formaliser. |
| A5 | Accès clinique administrateur établissement | **Décidé :** aucun accès clinique via l’espace établissement en V1. Les demandes/lectures cliniques restent au professionnel avec consentement patient. |
| A6 | Validation médecin et rattachement | **Décidé :** E‑Carnet ne collecte pas les justificatifs personnels du médecin; la vérification se fait en interne entre médecin et établissement. L’administrateur établissement émet un code à usage unique/48 h; sa saisie crée `pending`, puis l’établissement accepte/refuse. L’acceptation est la validation institutionnelle du rattachement pour cette structure. |
| A7 | Aide à la pré-consultation | Pas de compte infirmier. Champ d’aide éventuel sans authentification ni droits supplémentaires. Règles exactes de l’établissement et de la personne aidante à confirmer si modifiées. |
| A8 | Champs de pré-consultation | **Ouvert médicalement :** champs, unités, bornes, obligatoires/facultatifs, antécédents et documents. Validation référent médical requise. |
| A9 | Scopes et QR | **Décidé et implémenté pour la V1 :** QR opaque, usage unique, validité 5 min; défaut `preconsultation` + `declarations`; `consultations` sélectionnable; `documents` hors V1. | Génération et lecture QR présentes ; parcours mobile et UUID patient saisi séparément à recetter/clarifier. |
| A10 | Champs consultation | **Ouvert médicalement :** champs communs/optionnels et corrections après signature. |
| A11 | Justificatifs/documents | **Décidé :** pas d’upload à E‑Carnet des justificatifs personnels/professionnels médecin; ceux-ci restent entre médecin et établissement. Les justificatifs structure sont reçus par e-mail par l’équipe E‑Carnet. **À formaliser :** sécurité/rétention de cette boîte et des preuves structure. |
| A12 | PostgreSQL | **Décision d’architecture V1/V2 :** Vercel (web), Render (API), Neon (PostgreSQL). La région effective, les contrats/localisations des copies et sauvegardes, les coûts et la restauration managée doivent encore être vérifiés ; un smoke de restauration locale a réussi le 08/10. |
| A13 | Hébergement ivoirien | À choisir et vérifier avant données réelles; pilote fictif uniquement. |
| A14 | Droit local | Avis écrit du juriste requis; ne pas déduire une conformité. |
| A15 | Conservation/correction/export/suppression | Durées et règles à faire approuver par le juriste; maintenir l’historique/audit sans suppression silencieuse. |
| A16 | Incidents/notifications | Responsables, seuils, délais, confinement et notification restent à définir/valider. |

## Délais établissement retenus

| Objet | Durée | Effet |
|---|---:|---|
| Invitation compte établissement | 48 h, une utilisation | Le destinataire définit son mot de passe; consommation ou expiration invalide le lien. |
| Code de rattachement médecin | 48 h, une utilisation | La saisie crée une demande en attente seulement; l’administrateur établissement doit ensuite accepter/refuser. |

## Conditions avant activation réelle

Finaliser les validations médicales/juridiques ouvertes; configurer et tester en staging la console staff, l’accès admin établissement, l’invitation et le code à 48 h, OAuth, QR et scopes; exécuter PostgreSQL/restauration/RPO-RTO; valider les dépendances, l’accessibilité et l’expérience mobile. Le verdict actuel reste NO-GO et les données restent synthétiques (`example.test`).
