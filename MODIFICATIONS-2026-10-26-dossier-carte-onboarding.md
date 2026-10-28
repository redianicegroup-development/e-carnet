# 26/10/2026 — Dossier commun, carte avec métier, étape 3 professionnel en un bloc

Base : `e-carnet_v2-2.zip`, puis réappliqué le 27/10 sur `e-carnet-3.zip` (qui n'en contenait que les nouveaux fichiers : 6 erreurs de types ; réparé, aucun conflit avec les fichiers de monitoring). Reprend et termine le paquet « maj 2026-10-25 » (dossier, carte, onboarding) sans rien écraser de v2-2
(proches de confiance, adressages, ouvertures établissement, historique de soins).

## 1. Dossier patient et dossier médecin : même présentation
- Nouveau composant `DossierCard` (+ `dossier-card.css`) : photo, nom en titre, métier (si professionnel), lignes d'informations.
  Utilisé par `ProfessionalDossier` (dossier médecin) et `PatientHomeIdentity` (dossier patient).
- **Les champs du patient restent ceux d'origine** : âge, genre déclaré, ville, téléphone, adresse, couverture santé
  (organisme, numéro, expiration), puis « Mes autres déclarations » avec leur provenance. Le paquet avait ajouté Profession et
  E-mail et regroupé la couverture : retiré. Prénom et nom sont dans le titre.
- Le dossier patient porte toujours la carte virtuelle et le QR de la carte (une seule section d'accueil).

## 2. Carte virtuelle
- Carte du professionnel = mêmes champs que celle du patient + le métier (écran et PNG). Aucun métier sur la page publique du QR.
- Le métier s'affiche aussi sous le nom dans le dossier patient d'un professionnel et dans le dossier médecin.

## 3. Onboarding : étape 3 d'un professionnel en un seul bloc
- `/onboarding/patient?suite=professionnel` affiche `ProfessionalStep3` : un formulaire, un Retour / Suivant, deux groupes
  « Dans votre espace patient » (carnet : mêmes champs que l'étape 3 d'un patient) et « Dans votre espace professionnel »
  (spécialité obligatoire ; numéro d'ordre, cachet, signature facultatifs).
- Enregistrement : carnet patient → activation de l'espace professionnel → spécialité → ordonnance → étape 4. Répétable sans doublon.
- Anciens liens `?etape=3` (`/professionnel/onboarding`, `/professionnel/onboarding/ordonnance`) redirigent vers le bloc unique ;
  le Retour de l'étape 4 y ramène. « Compléter mon profil » et les paramètres gardent leurs pages.
- Factorisation : `PatientIdentityFields` (champs du carnet), `useSpecialtyChoice` / `SpecialtyFields`, `useCredentialsDraft` / `CredentialFields`.
  `PatientOnboarding` n'a plus de variante professionnelle.

## 4. Autres reprises du paquet
- API : le QR du patient annonce aussi `documents` (cohérent avec `REQUIRED_SCOPES` déjà présent dans v2-2).
- CGU, confidentialité, aide : documents en lecture seule demandés avec le QR (textes de v2-2 conservés).
- Textes raccourcis : invitation établissement, carnet, pré-consultations, accès pro, vaccinations.
- Tests API ajoutés : `care/test_qr_documents_scope.py`, `establishments/test_member_detail.py`.

## Documentation
- CDC `docs/.cdc/e-carnet-cdc-v12-actualise-27-10-2026.docx` : sections 0, 2, 5, 11 et 28 actualisées, annexe A (évolutions 08–27/10). La V9 est conservée.
- `docs/IMPLEMENTATION-UI-DOSSIER-CARTE-ONBOARDING-2026-10-26.md` : corrigée (étape 3 en un bloc, champs patient d'origine).

## 27/10 (suite) — corrections de la revue de la surveillance technique
- **Console opérations** : `ECARNET_OPERATIONS_ADMIN_EMAILS` est obligatoire hors développement. Liste vide = accès fermé à tous (seul `DEBUG` local ouvre aux superadmins de test). `ECARNET_ENVIRONMENT` fixe l'étiquette (staging, production).
- **Incidents** : un incident résolu ne peut plus être acquitté ni résolu à nouveau (409) ; acquitter deux fois est sans effet. Le journal d'audit garde maintenant `incident_key`, `category` et `severity` (ces clés étaient filtrées par la liste blanche).
- **Webhook de monitoring** : **changement de contrat**, l'horodatage est signé. En-têtes `X-Ecarnet-Monitor-Timestamp` et `X-Ecarnet-Monitor-Signature: sha256=HMAC("horodatage.corps")`, tolérance 300 s ; l'ancien format est refusé (401). Débit limité par IP (`ECARNET_RATE_MONITOR_WEBHOOK`, 600/h). Ouvertures, réouvertures, changements de gravité et résolutions auditées (acteur « monitoring »). Résoudre une clé inconnue ne crée plus d'incident. Un payload qui n'est pas un objet JSON répond 400.
- **Script d'envoi** `ops/send-monitoring-event.py` (+ `ops/test-monitoring-event.py`, ajouté à la CI) : secret lu dans l'environnement uniquement. Essayé de bout en bout contre un serveur Django local.
- **Archives et tests** : `private-media/` dans `.gitignore` et refusé par `scripts/make-archive.sh` ; les tests téléversent dans un dossier temporaire (ils écrivaient dans `apps/api/private-media`).
- Documentation : `docs/MONITORING-WEBHOOK.md`, `docs/DEPLOYMENT.md`, exemples d'environnement et CDC v12 (annexe A.4) mis à jour.

### Non traité, à décider
- Image web : adresse de l'API figée à la construction (`ECARNET_API_ORIGIN`).
- Migrations lancées à chaque démarrage du conteneur API.
- Sauvegarde de la base de production et des fichiers (`ops/backup-db.sh` vise le Compose local).
- Les 5 PDF de `private-media` et `db.sqlite3` sont encore dans l'archive de travail.

## Vérifications (27/10, sur e-carnet-3 réparé puis corrigé)
- `tsc --noEmit` : 0 erreur. Lint passé sur les fichiers modifiés : 0 erreur. Aucun fichier web modifié lors des corrections de la revue.
- Tests web : 205, 200 passent ; les 5 échecs existent déjà dans l'archive de départ.
- Tests Django : suite complète, **429 réussis**, 3 ignorés, sur SQLite local ; aucune migration manquante. Sondes `ops/` : réussies.
- Non rejoués : `next build`, PostgreSQL, rendu sur navigateurs et téléphones.
