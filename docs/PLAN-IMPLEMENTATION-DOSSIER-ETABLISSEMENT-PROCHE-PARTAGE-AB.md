> **Référence d’état auditée le 06/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`../ETAT-REEL-PROJET-2026-11-06.md`](ETAT-REEL-PROJET-2026-11-06.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# Plan d'implémentation — dossier établissement, proche de confiance, partage A → B

Version de travail du 26 octobre 2026. Base : archive du dépôt « e-carnet » (v1.10, 25 oct). **L'archive `e-carnet-2` (« dernière version ») n'a pas été reçue** : si elle contient déjà une partie du chantier A, rayer les étapes correspondantes (voir §1, ce qui manque dans l'archive lue).

Les estimations sont en jours-homme, ordre de grandeur, tests et recette inclus.

---

## 0. Vue d'ensemble

| Chantier | Ce que ça livre | Estimation | Gate avant données réelles |
|---|---|---|---|
| **0. Fondations communes** | `notify_patient()`, contexte d'accès patient (`PatientAccess`), whitelist d'audit élargie, drapeaux | 2–3 j | aucun |
| **A. Dossier des soins de l'établissement** | accès admin par défaut + motif obligatoire + notification patient + historique des vues + badge | 5–6 j | avis juridique (§A8) |
| **B. Proche de confiance** | délégation lecture seule, périmètre « fiche d'urgence », retrait immédiat | 6–7 j | modèle de délégation validé par le juriste |
| **C. Partage A → B** | adressage (C1) puis demande par QR côté B (C2) | C1 : 12–15 j, C2 : 4 j | consentement inter-établissements + conservation des copies validés |

Ordre conseillé : **0 → A → B → C1 → C2**. A d'abord, parce qu'il remplace un endpoint existant qui lit tout sans motif, et parce qu'il fixe le mécanisme « notifier le patient + tracer » que B et C réutilisent.

Tout reste sous le verdict **NO-GO** du dépôt : données fictives, hébergement UE, drapeaux désactivés en production tant que les validations ne sont pas signées.

---

## 1. Ce que le code fait aujourd'hui (constats, avec fichiers)

**Dossier établissement**
- `apps/api/apps/establishments/clinical_views.py` — `EstablishmentPatientRecordsView` : en **un seul GET** l'administrateur reçoit les dossiers de **tous** les patients de sa structure (pré-consultations clôturées + consultations). Pas de motif, pas de notification, pas d'historique côté établissement. L'audit écrit **un `clinical_data.read` par patient à chaque appel** (même sans qu'un dossier soit réellement ouvert).
- Écran : `apps/web/src/components/EstablishmentPatientRecords.tsx` (page `app/etablissement/dossiers`), appelle `/api/v1/establishments/{id}/patient-records/`.
- Tests existants : `establishments/test_patient_records.py` (4 tests : cloisonnement, non-admin, suspendu).
- `apps/audit/services.py` : l'audit filtre les métadonnées (`ALLOWED_METADATA_KEYS`) ; `reason_code` existe, pas de catégorie de motif ni d'identifiant d'ouverture. Table append-only (trigger PostgreSQL, migration `audit/0002`).
- `care/views.py` `PatientAccessAuditView` : n'expose que `access_grant.*` et `clinical_data.read`, et affiche « Professionnel / Établissement » **par défaut quand il n'y a pas de grant** → une lecture admin apparaîtrait sans nom de structure.
- `PatientNotification` (care/models.py) : modèle simple, création en ligne dans les vues ; **il n'existe de notification que pour le patient** (rien pour professionnel ou admin).

**Rattachement des soins**
- `Consultation` porte `patient`, `professional`, `establishment`, `access_grant` : OK.
- `HealthMeasurement` et `MedicalDocument` : **aucun `establishment` ni `professional`**. Une mesure est créée uniquement par le patient (`PatientMeasurementListCreateView`, `source` = measured/declared) ; un document est importé par le patient (`verified` booléen). → « chaque mesure/document validé est rattaché à l'établissement et au professionnel » **n'est pas possible en l'état**.
- `Vaccination` : `confirmed_by` (professionnel) + `confirmed_access_grant` (qui porte l'établissement), mais pas de colonne `establishment`.

**Contexte patient / représentation**
- `patients/views.py` `profile_for(user, request)` : renvoie le profil patient depuis la **session** (`active_patient_profile_id`) ; n'accepte que des profils **sans compte** (`patient__user__isnull=True`) liés par `PatientRepresentation`. Appelée **39 fois** (patients/views.py, care/views.py), y compris pour des écritures et suppressions.
- `PatientRepresentation` : un **seul** représentant actif par patient (contrainte `unique_active_patient_representation`), pensé pour les enfants avec confirmation de représentation légale. **À ne pas réutiliser** pour le proche de confiance (autre nature juridique, plusieurs proches possibles, patient adulte avec compte).
- Carte d'urgence : `PatientEmergencyCard` + `emergency_card_data()` ; vue publique par QR (`EmergencyCardQrView`, throttle IP).

**Partage entre établissements**
- N'existe pas. `ProfessionalConsultationListCreateView.get` filtre `professional=profile, establishment=active` : un médecin ne lit **que ses propres consultations**. Portées documentées dans `require_scope` (care/services.py) : `preconsultation`, `declarations`, `consultations`, `documents` ; le QR donne par défaut `preconsultation` + `declarations` (`ETAT-REEL-V1`). Mais aucune portée ne permet de lire ce qu'**une autre structure** a produit.
- Cible déjà écrite : `docs/FLOW-ETABLISSEMENT.md` § « Cible V3 — continuité du dossier entre établissements (A → B) » et `docs/ROADMAP-V1-V5.md` § V3 (prérequis : consentement granulaire et révocable, rattachement actif à B, durée/périmètre minimaux, pas d'énumération de patients, pas d'accès administrateur seul, copie en lecture seule, addendum pour correction). Le plan ci-dessous **suit ces textes**.

**Incohérence documentaire à corriger dans le même lot** : `FLOW-ETABLISSEMENT.md`, `ETAT-REEL-V1.md`, README affirment encore « aucune lecture clinique pour l'établissement », alors que le code (et la règle que tu viens d'énoncer) l'autorisent.

---

## 2. Règles produit à écrire noir sur blanc avant de coder

1. **Le dossier établissement = les soins réalisés par l'établissement**, pas le carnet entier du patient. Y entrent : consultations, pré-consultations clôturées reçues, mesures et documents validés par un professionnel de la structure, vaccinations confirmées par elle. N'y entrent jamais : les déclarations du patient, ses documents importés, les soins d'une autre structure (sauf partage A → B, chantier C).
2. **Administrateur** : accès par défaut, en lecture seule, **uniquement** à ce périmètre, **uniquement** pour les patients ayant un soin dans sa structure. Contrepartie : motif obligatoire, notification, historique, badge.
3. **Professionnels impliqués** : lecture dans le cadre de la prise en charge (déjà le cas via `AccessGrant`) ; leurs lectures apparaissent dans le même historique.
4. **Le patient voit tout** : qui, quand, quelle structure, quel motif, combien de fois.
5. **Rien d'éditable côté établissement** : une correction passe par un addendum signé, jamais par modification (principe déjà posé dans `FLOW-ETABLISSEMENT`).
6. **Proche de confiance** : compte propre, délégation acceptée, lecture seule, périmètre minimal, retrait immédiat, jamais de mot de passe ou code de connexion partagé, jamais présenté comme une représentation légale.
7. **A → B** : le patient décide, par élément ; B ne découvre jamais un patient par recherche ; l'administrateur de B n'obtient pas le contenu par le seul fait d'être administrateur.

---

## 3. Chantier 0 — Fondations communes (2–3 j)

1. **`notify_patient(patient, kind, title, body, metadata, coalesce_key=None, window=timedelta(minutes=30))`** dans `apps/care/notifications.py`. Remplace les `PatientNotification.objects.create(...)` en ligne (care/views.py l. 400, 477, 591, 614, 799, 947 ; patients/views.py l. 504). Si `coalesce_key` + notification non lue dans la fenêtre : incrémenter `metadata.count` au lieu d'en créer une nouvelle (évite 15 notifications pour 15 ouvertures du même dossier).
2. **`PatientAccess`** : objet posé sur `request` par `profile_for` — `mode` (`owner` | `guardian` | `delegate`), `delegation`, `scopes`. Aucun changement de comportement pour `owner` et `guardian`. Sert au chantier B ; le poser maintenant évite de retoucher les 39 appels plus tard.
3. **Audit** : ajouter à `ALLOWED_METADATA_KEYS` : `reason_category`, `opening_id`, `delegation_id`, `referral_id`, `counterparty_establishment_id`. Ajouter l'index `(establishment, patient, event_type, created_at)` sur `AuditEvent`. **Ne jamais** copier un texte libre dans l'audit (règle déjà documentée).
4. **`PatientAccessAuditView`** : afficher le nom de l'établissement depuis `event.establishment` quand il n'y a pas de grant, et inclure les nouveaux types (`establishment_record.*`, `delegation.*`, `referral.*`).
5. **Drapeaux** (settings) : `ECARNET_TRUSTED_CONTACTS_ENABLED=false`, `ECARNET_REFERRALS_ENABLED=false`. Le chantier A n'a pas de drapeau (il remplace l'existant) ; il a un interrupteur serveur `ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ` (défaut `true`, règle énoncée) pour pouvoir restreindre vite si le juriste l'exige.

---

## 4. Chantier A — Dossier des soins de l'établissement (5–6 j)

### A1. Rattacher chaque soin à l'établissement et au professionnel (1–1,5 j)
Migration `care/0018` :
- `HealthMeasurement` : `establishment` (FK nullable), `professional` (FK nullable), `validated_at` (nullable). Null = mesure du patient (inchangé).
- `MedicalDocument` : mêmes trois champs (document produit ou validé par la structure, ex. résultat d'examen).
- `Vaccination` : `establishment` (FK nullable), rempli à la confirmation.
- Contrainte `CheckConstraint` : `establishment` non nul ⇒ `professional` non nul ET `validated_at` non nul.
- Pas de rétro-remplissage (les lignes existantes sont des données patient).
- Côté professionnel : endpoint de **saisie d'une mesure** pendant la consultation (écrit `establishment`, `professional`, `validated_at`, `source="measured"`) ; l'upload de document par la structure est une **étape optionnelle** (A1-bis) : `ETAT-REEL-V1` classe la portée `documents` hors V1 par défaut.
- Service unique `establishment_care_records(patient, establishment)` qui renvoie l'union des 4 types, **filtrée par `establishment`**. C'est la seule porte vers le contenu : aucun serializer ne lit en dehors.

### A2. Ouverture avec motif (1,5–2 j)
Nouvelle table `EstablishmentRecordOpening` (app `establishments`), **sans champ modifiable** :
`id`, `establishment`, `patient`, `opened_by` (user), `opened_by_role` (`establishment_admin`), `reason_category`, `reason_note` (≤140 car., exigé si `autre`, jamais copié dans l'audit), `opened_at`, `expires_at` (= +30 min).

Catégories fermées : `soins_en_cours`, `continuite_soins`, `demande_patient`, `facturation_assurance`, `qualite_audit`, `reclamation`, `autre`.

Endpoints (remplacent `GET patient-records/`) :

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/establishments/{id}/patients/` | **Liste sans contenu clinique** : nom, âge, date du dernier soin, `views_total`, `views_30d`, dernière vue (qui, quand). Recherche par nom **dans ses propres patients**, pagination. |
| POST | `/establishments/{id}/patients/{patient_id}/openings/` | Corps `{reason_category, reason_note?}` → crée l'ouverture, l'audit `establishment_record.opened` (`reason_category`, `opening_id`), la notification patient. Renvoie `{opening_id, expires_at}`. |
| GET | `/establishments/{id}/openings/{opening_id}/record/` | Contenu (via `establishment_care_records`). Valide seulement si : ouverture non expirée, même utilisateur, administrateur toujours actif, structure active. Audit `establishment_record.read` avec `resource_count`. Réponse `Cache-Control: no-store`. |
| GET | `/establishments/{id}/patients/{patient_id}/view-history/` | Historique : ouvertures admin **+** lectures de professionnels (`clinical_data.read` de la structure), avec qui / quand / motif ou « accès autorisé par le patient ». |

Règles serveur :
- Patient éligible = au moins un soin ou une pré-consultation clôturée dans **cette** structure (reprendre le queryset actuel). Sinon 404 (pas 403 : ne pas confirmer l'existence).
- Refus si l'administrateur est lui-même le patient (comme `SelfAccessRefused` pour les grants), avec événement `establishment_record.self_refused`.
- Throttle par utilisateur (`establishment_record_open`, ex. 30/h) + alerte staff si > 15 patients distincts ouverts en 1 h (signal de consultation « en balade »).
- Ancien endpoint `GET patient-records/` : répondre **410** « Actualisez l'application » (même style que le refus des champs déplacés de la carte d'urgence), pour les PWA en cache.

### A3. Notification et vue côté patient (0,5–1 j)
- `notify_patient(kind="establishment_record.opened", title="Votre dossier a été consulté", body="{Établissement} · motif : {catégorie}", coalesce_key=f"{opener}:{patient}")`. Pas de nom du soignant dans le texte (le détail est dans l'historique), pas de contenu clinique.
- Nouvel endpoint patient `GET /patient/record-views/` : par établissement, nombre d'ouvertures, dernière ouverture, et liste détaillée (qui, rôle, date, motif). Alimente le badge côté patient et l'écran « Qui a consulté mon dossier ».
- `PatientAccessAuditView` (chantier 0) inclut ces événements.

### A4. Écrans (1–1,5 j)
- `EstablishmentPatientRecords.tsx` → liste + **badge** (« 3 vues ») ; clic ⇒ panneau « Historique des vues » (qui, quand, motif).
- Clic sur un patient ⇒ modale de motif (boutons radio des catégories ; champ court si « autre ») + rappel : « Cet accès est enregistré et le patient en est informé. »
- Vue du dossier : bandeau permanent avec le minuteur de l'ouverture (30 min) ; à l'expiration, retour à la liste (nouveau motif requis).
- Patient : dans `PatientAccessGrants.tsx` (ou nouvel onglet), bloc « Établissements » avec badge et détail ; `PatientNotifications.tsx` reconnaît le nouveau `kind`.

### A5. Tests (1 j) — étendre `test_patient_records.py`
- liste sans contenu clinique ; ouverture sans motif → 400 ; motif hors liste → 400 ; `autre` sans note → 400
- ouverture crée **exactement** 1 ouverture + 1 audit + 1 notification (et une 2ᵉ ouverture dans la fenêtre incrémente `count`)
- lecture du contenu : ouverture expirée → 403 ; autre utilisateur → 403 ; admin révoqué ou structure suspendue → 403
- cloisonnement : patient sans soin dans la structure → 404 ; contenu d'une autre structure **jamais** renvoyé (consultation, mesure, document)
- périmètre : déclarations et documents importés par le patient absents du contenu
- auto-accès refusé et tracé ; throttle ; ancien endpoint → 410
- audit : aucune `reason_note` dans les métadonnées ; les nouveaux événements sont immuables (`audit/tests.py` ne contient aujourd'hui que le test TRUNCATE : ajouter un test d'immutabilité `save`/`update`/`delete`)
- patient : voit l'ouverture avec le **nom de la structure** (régression du libellé par défaut)

### A6. Documents à aligner dans le même lot
`FLOW-ETABLISSEMENT.md`, `ETAT-REEL-V1.md`, README, `ADMIN-GOVERNANCE-AND-MONITORING.md`, `CDC` (règle d’accès admin), politique de confidentialité et CGU, tableau comparatif du business plan (section 5). **Mise à jour 06/11 :** ce plan prévoyait d’informer le patient d’une ouverture admin motivée et notifiée ; cette capacité est maintenant désactivée par défaut et la décision A8/le rôle autorisé restent à confirmer. Les textes actuels doivent dire qu’elle est désactivée, puis être revus si une décision ultérieure autorise son activation.

### A7. Risques propres au chantier
- Notifications trop fréquentes → fenêtre de coalescence ; l'audit, lui, reste exhaustif.
- Fuite via la liste → la liste ne renvoie **aucun** champ clinique (pas même le dernier motif de consultation).
- Contournement par l'ancien endpoint → 410, pas de redirection.

### A8. À faire valider (juriste + référent médical)
Base légale d'un accès **sans consentement préalable** de l'administrateur, secret médical pour un administrateur non soignant, formulation de la promesse faite aux patients. D'où l'interrupteur `ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ`. Option de repli simple si le juriste l'exige : réserver le **contenu** à un rôle de santé habilité (direction médicale) et laisser à l'administrateur simple la liste, les indicateurs et l'historique.

---

## 5. Chantier B — Proche de confiance (6–7 j)

### B1. Modèle (1 j) — app `patients`
`TrustedContactDelegation` :
`id`, `patient` (FK, **profil avec compte propre**), `delegate` (FK user, nul tant que l'invitation n'est pas acceptée), `invited_email`, `relationship_label` (liste : conjoint·e, enfant adulte, parent, ami·e, autre), `scopes` (liste, V1 = `["emergency_card"]`), `status` (`pending`, `active`, `declined`, `revoked`, `expired`), `token_hash` (sha256, comme `EstablishmentAdminInvitation`), `invitation_expires_at` (72 h), `accepted_at`, `expires_at` (30/90/365 j, choix du patient, renouvelable), `revoked_at`, `last_used_at`.
Contraintes : un seul `pending|active` par (`patient`, `delegate`/email) ; maximum 3 proches actifs par patient ; `delegate ≠ patient.user` ; le patient doit avoir un compte (jamais sur un profil enfant : ceux-là restent sur `PatientRepresentation`).
Mode **toujours lecture seule** : pas de colonne « écriture » tant que le juriste n'a pas validé une extension.

### B2. Invitation et acceptation (1,5 j)
- Patient : `POST /patient/delegations/` (e-mail, lien de parenté, portée, durée) → e-mail avec lien à usage unique. `GET` liste, `POST /{id}/revoke/`, `POST /{id}/renew/`.
- Proche : `GET /delegations/invitations/preview/?token=` (affiche qui invite et ce qui sera visible), `POST /delegations/accept/`. L'acceptation exige un **compte connecté dont l'e-mail vérifié = l'adresse invitée** (Google/Facebook fournissent un e-mail vérifié) ; sinon un **code à 6 chiffres** envoyé à l'adresse invitée (10 min, 5 essais, `IpScopedThrottle`). Le code **prouve la maîtrise de l'adresse, pas un droit** : l'autorité vient uniquement du consentement du patient. Le texte à l'écran le dit.
- Le patient reçoit « X a accepté » (`notify_patient`).
- Audit : `delegation.invited / accepted / declined / revoked / expired / renewed`.

### B3. Accès délégué, lecture seule **par défaut interdit** (1,5–2 j)
Point critique : `profile_for` est appelée 39 fois, y compris pour des suppressions de documents. Un simple « sélectionner le carnet du proche » ouvrirait tout. Donc **refus par défaut dans `profile_for` elle-même** :
- nouvelle clé de session `active_delegation_id` ; `GET /delegations/mine/` et `POST /delegations/{id}/select/` (comme `representations/active/`) ;
- `profile_for(user, request, scope=None)` : en mode `delegate`, lève `PermissionDenied` si la méthode n'est pas sûre (GET/HEAD/OPTIONS), **ou** si `scope` n'est pas dans `delegation.scopes`, **ou** si la délégation n'est pas `active` / est expirée (relu en base à chaque requête, donc la révocation est immédiate) ;
- seuls les appels qui passent explicitement `scope="emergency_card"` (lecture de la carte d'urgence) fonctionnent. **Les 38 autres appels sont refusés sans les toucher.**
- Audit à chaque accès : `actor` = le proche, `actor_role="delegate"`, `patient` = le patient ; notification au patient à la première lecture de la journée (`coalesce_key`).
- Ne pas exposer : gestion du QR d'urgence, téléchargement, export du carnet, documents, consultations.

### B4. Écrans (1,5 j)
- Patient : paramètres → « Proches de confiance » (calquer `PatientRepresentationsSettingsClient.tsx`) : inviter, voir le statut, durée restante, **Retirer l'accès** (un geste, effet immédiat).
- Proche : sélecteur « Carnet de {prénom} (lecture seule) » + bandeau permanent « Vous consultez le carnet d'un proche · accès limité · journalisé » ; aucun bouton d'écriture.
- Libellés : jamais « représentant légal » ; « proche de confiance ».

### B5. Tests (1 j)
- refus de **toute** écriture et de toute vue hors portée en mode délégué (test paramétré sur les routes qui appellent `profile_for`)
- révocation → la requête suivante échoue ; expiration idem
- jeton : usage unique, expiré, mauvais e-mail ; code : 5 essais max
- plafond de 3 proches ; auto-délégation refusée ; profil enfant refusé
- audit `actor_role="delegate"` visible dans l'historique du patient ; aucune donnée clinique dans les notifications
- non-régression : mode `owner` et `guardian` inchangés

### B6. Garde-fous
- Derrière `ECARNET_TRUSTED_CONTACTS_ENABLED` (faux en production) jusqu'à validation juridique du modèle de délégation/consentement (exigée par `ROADMAP-V1-V5`).
- **Pas de cache hors ligne** des données du proche (interdit par la roadmap avant validation).
- Extensions futures, chacune après décision : ajouter des portées (`appointments`, `follow_up`), puis éventuellement des actions limitées. Jamais d'accès au contenu des consultations par délégation sans validation distincte.

---

## 6. Chantier C — Partage A → B (adressage)

### C0. Principe
Une seule logique de consentement, deux entrées :
- **C1 — A adresse son patient à B** (ce que tu décris : « de A vers B »).
- **C2 — B demande l'accès via QR** (cible déjà écrite dans la doc ; réutilise `AccessGrant`).
Le dossier maître reste le carnet du patient ; B reçoit un **instantané en lecture seule**, jamais l'original ni un droit de modification.

### C1. Workflow d'adressage

```
A (professionnel)           Patient                    B (professionnels / admin)
 1. crée l'adressage ─────▶
    (destination = B,
     éléments proposés,
     motif catégorisé)
 2. signe / envoie ───────▶ 3. reçoit la demande
                               voit : A, B, motif, éléments, durée
                               coche / décoche chaque élément
                               ACCEPTE ou REFUSE
                            4. accepte ───────────────▶ 5. instantané figé créé
                                                           « adressages reçus » (liste sans contenu)
                                                        6. un professionnel de B ouvre
                                                           (rattachement actif requis)
                            ◀── notification « consulté par Dr X (B) »
                                                        7. B prend en charge (statut : consulté)
                                                        8. (optionnel, C3) contre-référence B → A,
                                                           avec le même consentement
Le patient peut RÉVOQUER à tout moment ⇒ B perd la lecture immédiatement.
```

**États** : `brouillon → proposé → accepté | refusé | expiré | annulé → consulté → clos`, plus `révoqué` (patient) depuis `accepté` ou `consulté`.
Délais : proposition valable 14 jours ; fenêtre de lecture par B = durée choisie par le patient (défaut 30 jours, bornée) ; à l'échéance, B ne lit plus.

### C1.1 Modèle (app `referrals`, 2–3 j)
- `CareReferral` : `patient`, `from_establishment`, `from_professional`, `to_establishment`, `reason_category` (liste fermée : avis spécialisé, examen complémentaire, hospitalisation, suivi, autre), `status`, `proposed_at`, `patient_decided_at`, `read_until`, `revoked_at`, `expires_at`.
- `CareReferralItem` : `referral`, `record_type` (consultation | measurement | document | vaccination), `record_id`, `proposed_by_A` (bool), `accepted_by_patient` (bool). Éléments **produits par A uniquement** (au sens du chantier A1) ; une déclaration du patient (ex. allergie) peut être proposée mais exige sa case cochée.
- `CareSnapshot` : `referral`, `payload` (JSON figé), `payload_hash`, `created_at`. **Immuable** (même garde que `AuditEvent` : `save`/`delete`/`update` interdits). Contient provenance par élément : patient / professionnel auteur / établissement source / date de validation.
- Aucun contenu clinique libre dans l'audit.

### C1.2 Règles d'accès côté B (1,5 j)
- Lecture réservée aux **professionnels de B** avec rattachement actif (`professional_clinical_access_error`), **pas** à l'administrateur de B par défaut. Il voit l'**inbox** (patient, A, motif, statut, échéance), jamais le contenu.
- Si B veut que son administrateur lise le contenu reçu : il passe par le mécanisme du chantier A (motif + notification), une fois la copie versée — **décision à prendre, voir C5**.
- Pas de recherche de patients : B ne voit un adressage que s'il lui est adressé ; l'identification à l'accueil se fait par le **code d'adressage** (QR) montré par le patient dans son application.
- Une correction chez A crée un **addendum** versionné ; B voit « version 2 disponible » seulement si le patient l'a autorisé (nouvelle demande, pas de mise à jour silencieuse).

### C1.3 Endpoints (3 j)
| Côté | Route | Effet |
|---|---|---|
| A (pro) | `POST /referrals/` | crée (brouillon) ; vérifie rattachement actif à A et soin existant à A |
| A (pro) | `POST /referrals/{id}/send/` | passe à `proposé` ; notification patient ; audit |
| A (pro) | `POST /referrals/{id}/cancel/` | annule tant que non accepté |
| Patient | `GET /patient/referrals/` · `POST /{id}/accept/` (avec liste d'éléments cochés et durée) · `POST /{id}/decline/` · `POST /{id}/revoke/` | consentement granulaire ; `accept` crée le `CareSnapshot` et ouvre la fenêtre |
| B (pro/admin) | `GET /establishments/{id}/referrals/inbox/` | liste sans contenu (admin et pros) |
| B (pro) | `POST /referrals/{id}/open/` puis `GET /referrals/{id}/snapshot/` | lecture du contenu ; audit `referral.read` ; notification patient (coalescée) |
| B (pro) | `POST /referrals/{id}/acknowledge/` | statut `consulté` → `clos` |
Throttle : N adressages/jour par professionnel ; 404 uniforme pour tout adressage non destiné à l'appelant (pas d'énumération).

### C1.4 Écrans (2–3 j)
- A : bouton « Adresser à un confrère » dans le dossier d'une consultation ; choix de B dans le **catalogue des établissements actifs** (`EstablishmentCatalogView` existe), éléments proposés, motif.
- Patient : écran de consentement avec cases par élément, durée, résumé « B pourra lire ceci jusqu'au … », bouton Retirer l'accès ; QR d'adressage.
- B : inbox des adressages reçus, ouverture, bandeau « Reçu de A · lecture seule · valable jusqu'au … », bouton « Pris en charge ».

### C1.5 Tests (2 j)
- parcours complet A → patient → B ; refus ; expiration ; annulation ; révocation (B perd la lecture à la requête suivante)
- patient décoche un élément → absent du snapshot
- seul un professionnel de B rattaché actif lit ; administrateur de B : inbox oui, contenu non ; autre établissement → 404
- A ne peut adresser que ce que A a produit ; snapshot immuable (tests de garde)
- l'audit n'écrit que des identifiants (`referral_id`, `counterparty_establishment_id`) ; notification patient à chaque lecture (coalescée)
- aucune énumération (404 identiques)

### C2. B demande l'accès par QR (4 j, après C1)
Réutilise le flux existant (`PatientAccessQrCreateView` → `ProfessionalAccessGrantListCreateView`) avec une **nouvelle portée `care_history`** (distincte de `consultations`, qui ne donne aujourd'hui accès qu'aux consultations du médecin lui-même) : le patient choisit **quelles structures sources** (ex. A) ; B lit les soins produits ailleurs, **en lecture seule**, durée du grant (2 h + 2 × 1 h), révocable. Nouvelle vue de lecture qui filtre `establishment ≠ B` et `establishment ∈ sources choisies`, audit `clinical_data.read` avec `counterparty_establishment_id`. Pas de copie conservée en V1.

### C3. Plus tard (non planifié)
Contre-référence B → A, copie conservée par B (`ReceivedCareCopy`), addenda signés, téléexpertise. **Rien de cela sans** validation juridique de la conservation, de la rectification et de l'effacement des copies versées (la roadmap interdit de promettre leur effacement à distance).

### C4. Hors périmètre, à ne pas coder
- Accès d'urgence « bris de glace » (décision produit + juridique + sécurité distincte).
- Recherche de patients par B.
- Accès d'un administrateur d'établissement au contenu d'un autre établissement, par quelque chemin que ce soit.

### C5. Décisions à prendre (avec mon défaut proposé)
1. **B lit un instantané figé ou le dossier en direct ?** → instantané figé (preuve de ce qui a été partagé, révocation simple).
2. **B peut-il conserver une copie après la fenêtre ?** → non en V1 (C3 plus tard, sous contrat).
3. **L'administrateur de B lit-il le contenu reçu ?** → non par défaut ; s'il le faut, via motif + notification comme le chantier A.
4. **Qui peut adresser côté A ?** → tout professionnel actif de A ayant un soin avec ce patient (pas l'administrateur).
5. **Patient qui ne peut pas consentir** (enfant : le représentant consent via `PatientRepresentation` ; adulte inconscient : pas d'adressage, carte d'urgence seulement).

---

## 7. Calendrier indicatif (équipe de 3 développeurs)

| Semaine | Contenu |
|---|---|
| S1 | Chantier 0 + A1–A2 (modèle + ouverture avec motif) |
| S2 | A3–A5 (notification, écrans, tests) + alignement des documents · **recette A** |
| S3 | B1–B3 (modèle, invitation, accès délégué refus-par-défaut) |
| S4 | B4–B6 (écrans, tests) · **recette B** · début C1.1 |
| S5–S6 | C1 (endpoints, règles B, écrans) |
| S7 | C1 tests + recette ; C2 |

Chaque chantier se livre derrière sa recette (jeux de tests ci-dessus + parcours manuel avec comptes fictifs) et met à jour `ETAT-REEL-V1.md`, `FLOW-ETABLISSEMENT.md` et le business plan (section 3.4 et annexe B passent de « décrit, à vérifier » à « présent »).

---

## 8. Critères de fin

- **A** : un administrateur ne peut plus lire un dossier sans motif ; chaque ouverture laisse 1 ouverture + 1 audit + 1 notification ; badge et détail visibles côté établissement **et** patient ; plus aucune lecture de masse ; documents alignés.
- **B** : un proche délégué ne peut lire que la fiche d'urgence ; toute autre route est refusée ; retrait effectif à la requête suivante ; aucune confusion avec un représentant légal dans l'interface.
- **C1** : un patient décide élément par élément ; B ne lit qu'un instantané, pendant la fenêtre, par des professionnels rattachés ; l'administrateur de B n'a que l'inbox ; la révocation coupe tout.
- **Transversal** : aucun texte libre dans l'audit ; PostgreSQL 16 en CI ; aucune donnée réelle avant levée du NO-GO.
