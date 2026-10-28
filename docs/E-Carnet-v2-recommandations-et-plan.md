# Mon E‑Carnet — audit de la v2 : recommandations, corrections et plan

Date : 18 octobre 2026 · Version examinée : `e-carnet_v2.zip` (construite sur la v15 + lot 1)

Ce document rassemble tout ce qui est ressorti de la relecture de la v2 : ce qui est bien, ce qu'il faut corriger, comment, dans quel ordre, et comment vérifier que c'est fait. Aucune valeur secrète n'y est reproduite.

---

## 1. Verdict en une page

La v2 est une vraie avancée. Elle conserve le lot 1 (identité du titulaire, constantes, trois blocs de consultation, ordonnance en lignes, examens demandés) et y ajoute documents, vaccinations, mesures, rappels, rendez‑vous, notifications, ordonnance PDF avec en‑tête d'établissement, tableaux de bord et tests e2e.

Elle n'est pas prête pour de vrais utilisateurs, pour quatre raisons :

1. **Secrets** : un fichier `apps/api/.env` d'apparence réelle voyage dans l'archive.
2. **Documents médicaux** : validation trop lâche, pas de suppression, pas d'effacement à la suppression de compte.
3. **Ordonnance PDF** : incomplète (pas de nom du patient, pas de signature ni de cachet, pas de numéro d'ordre).
4. **Données** : deux systèmes parallèles de constantes, et ta décision de champs libres (tension, glycémie) n'est appliquée nulle part.

Mon avis produit : tant que la boucle *identité → pré‑consultation → consultation signée → carnet et documents du patient* n'a pas tourné dans un vrai établissement, ne pas ajouter de nouveau module (rappels, rendez‑vous, plans de suivi sont déjà là : les geler).

### Ce qui est bien (à garder)

- Lot 1 intact dans la v2 (blocs de consultation, prescription structurée, constantes avec provenance, identité du titulaire).
- Migrations en chaîne linéaire `care 0009 → 0014`. Les migrations générées par `makemigrations` (0013, 0014) ne contiennent que des `CreateModel` : aucune dérive sur les modèles du lot 1.
- Documents sur Cloudinary en **livraison privée**, téléchargés par l'API authentifiée (jamais d'URL publique), avec événement d'audit à chaque lecture.
- `render.yaml` déclare les secrets en `sync: false`.
- Vaccinations : le patient ne peut pas se « confirmer » lui‑même (`status` en lecture seule), et une donnée inconnue n'est jamais présentée comme « non effectuée ».
- Navigation regroupée : 5 entrées par espace patient et professionnel, 4 pour l'établissement.
- CI renforcé : typecheck, tests web et Playwright.

### Ce qui a été vérifié, et ce qui ne l'a pas été

| Vérifié par moi | Résultat |
|---|---|
| Compilation de tous les fichiers Python (158) | 0 erreur |
| Chaîne de migrations `care 0009 → 0014` et `establishments 0008` | Linéaire, cohérente |
| Lot 1 présent dans la v2 | Oui (composants et backend) |
| Tests web rejoués dans mon environnement | 105 réussis sur 107 ; 1 échec lié à la v2 (carte d'urgence, §7), 1 échec présent aussi sur la v15 (cache de thème, probablement dû à des dépendances non installées ici) |
| Lecture du code des documents, vaccins, mesures, ordonnance PDF | Faite |

| **Non** vérifié | Pourquoi |
|---|---|
| Tests Django, `makemigrations --check`, `next build`, `eslint`, Playwright | Environnement sans réseau : Django et Next.js non installables |
| « 250 tests backend réussis, build OK » | Chiffres issus de `docs/AUDIT-RECETTE-V2-2026-10-18.md`, rédigé à 07:49, **avant** la dernière retouche CSS de la carte d'urgence (08:27). À rejouer. |

---

## 2. Tableau des priorités

| Prio | Sujet | Pourquoi | Taille |
|---|---|---|---|
| **P0** | Secrets du `.env` | Fuite potentielle de la base, des sessions et des fichiers médicaux | S |
| **P0** | Nettoyage de la racine du dépôt | `git add .` enverrait un ZIP, des images et un fichier de build | S |
| **P1** | Validation des fichiers (formats, contenu réel) | SVG/vidéos acceptés côté API, type MIME falsifiable | S |
| **P1** | Quotas et limite de débit à l'envoi | Coût Cloudinary, abus | S |
| **P1** | Suppression d'un document + effacement de compte complet | Droit à l'effacement, cohérence avec la promesse faite à l'utilisateur | M |
| **P1** | Logo de l'ordonnance (requête serveur vers une URL libre) | Risque d'appel vers des adresses internes, pas de plafond de taille | S |
| **P1** | Ordonnance PDF complète | Sans nom du patient ni cachet, elle n'a pas de valeur d'usage | M |
| **P1** | Test de la carte d'urgence / CI rouge | Le CI exécute maintenant `test:web` | S |
| **P2** | Constantes : un seul historique, tension et glycémie en champs libres | Cohérence des données et décision produit | M |
| **P2** | Périmètre « documents » pour le médecin | Le médecin ne voit pas la radio ni le bilan | M |
| **P2** | Lien examen demandé ↔ document (« résultat reçu ») | Referme la boucle ouverte par le lot 1 | M |
| **P2** | Confirmation des vaccins par un professionnel | Le statut « confirmée » n'est atteignable par personne | M |
| **P3** | QR de vérification d'ordonnance, modèles personnalisés par spécialité | Utile, mais après le pilote | L |
| **P3** | Rappels, rendez‑vous, notifications, plans de suivi | Déjà codés : geler et mesurer l'usage avant d'étendre | — |

Taille : S = quelques heures, M = une à deux journées, L = plusieurs jours.

---

## 3. P0 — Secrets et hygiène du dépôt

### 3.1 Constat

`apps/api/.env` est dans l'archive v2 (et, pour la base et la clé Django, déjà dans la v15). Sa forme correspond à de vraies valeurs : chaîne de connexion Neon avec mot de passe, clé secrète Django, clé et secret Cloudinary (le secret Cloudinary est nouveau en v2). Je ne les reproduis pas ici.

`.gitignore` exclut `.env`, donc un `git add .` ne le pousse pas. Mais un ZIP partagé, lui, l'emporte.

### 3.2 Actions

1. **Faire pivoter** : le mot de passe de la base Neon, `DJANGO_SECRET_KEY` (les sessions existantes seront invalidées, c'est voulu) et le secret API Cloudinary.
2. Mettre les nouvelles valeurs **uniquement** dans le tableau de bord Render (le `render.yaml` les attend déjà en `sync: false`).
3. **Supprimer `apps/api/.env`** du dépôt de travail et de toute archive. Ne garder que `.env.example` et `apps/api/.env.production.example`.
4. Si le dépôt GitHub a déjà reçu un push contenant ce fichier (le script `jj` pousse vers un dépôt distant), considérer les valeurs comme compromises même après suppression : l'historique Git les conserve. Les pivoter suffit ; purger l'historique est un plus.
5. Ajouter à `.gitignore` : `*.tsbuildinfo`, `*.zip`, et un dossier `design-assets/` pour les images sources.
6. Sortir de la racine : `jj` (script local avec l'adresse du dépôt distant), `akatech-v3.1.zip`, les trois images (`Sourire et…webp`, `Sourire et QR code…webp`, `Stéthoscope en forme de cadenas.png`) et `apps/web/tsconfig.tsbuildinfo`. Les noms d'images contiennent des caractères cyrilliques et des accents : à renommer en ASCII (`hero-sourire.webp`) avant tout usage dans le site.
7. Nettoyer la ligne `*.REGARDE LE MODEL/` du `.gitignore` (reliquat sans effet).

### 3.3 Critère de fin

- Aucune archive livrée ne contient de fichier `.env` (hors `.example`).
- Un `git status` propre après `git add .` (rien d'indésirable ajouté).
- L'ancien mot de passe Neon et l'ancien secret Cloudinary ne fonctionnent plus.

---

## 4. P1 — Documents médicaux

Code concerné : `apps/api/apps/care/views.py` (`PatientMedicalDocumentListCreateView`, `PatientMedicalDocumentDownloadView`), `apps/api/apps/cloudinary_storage.py`, `apps/web/src/components/MedicalDocuments.tsx`, `apps/api/apps/identity/account_action_views.py`.

### 4.1 Formats : réduire au nécessaire et vérifier le contenu

**Constat.** L'API accepte `.pdf .png .jpg .jpeg .webp .gif .svg .avif .webm .mp4 .mov`, alors que l'écran ne propose que PDF, PNG et JPEG. La vérification porte sur l'extension et sur le `Content-Type` envoyé par le navigateur, deux valeurs que l'envoyeur contrôle. Un SVG peut contenir des scripts. Les vidéos coûtent cher à stocker et n'ont pas d'usage ici.

**Correction.**
- Autoriser seulement : PDF, PNG, JPEG, WebP.
- Vérifier la **signature du fichier** (les premiers octets) :
  - PDF : commence par `%PDF-`
  - PNG : `\x89PNG\r\n\x1a\n`
  - JPEG : `\xff\xd8\xff`
  - WebP : `RIFF` suivi de `WEBP` aux octets 8 à 12
- Déduire le type enregistré (`content_type`) de la signature, jamais de l'en‑tête client.
- Refuser si l'extension et la signature divergent.
- Garder la taille maximale à 10 Mo côté serveur, et **compresser côté téléphone** avant envoi (redimensionner à environ 1 800 px de côté, qualité JPEG 0,8) : une photo de carnet fait souvent 4 à 8 Mo.
- Aligner le texte d'erreur sur la liste réelle.

**Tests à ajouter** (`test_medical_documents.py`) :
- un fichier nommé `.pdf` dont le contenu est du HTML est refusé ;
- un SVG, un MP4 et un GIF sont refusés ;
- un JPEG déclaré `image/png` est enregistré avec le type réel ;
- un PDF valide passe.

### 4.2 Quotas et limite de débit

- Ajouter une portée de limitation (`document_uploads`, par exemple 20 envois par heure et par utilisateur) dans la configuration DRF et la poser sur la vue d'envoi.
- Plafonner par patient : 100 documents et 200 Mo cumulés (valeurs de départ à ajuster).
- Message clair quand le plafond est atteint.

### 4.3 Suppression d'un document

**Constat.** Aucune route de suppression : un document envoyé par erreur ne peut pas être retiré.

**Correction.**
- `DELETE /api/v1/patient/care/documents/<id>/` : propriétaire uniquement, supprime l'objet **et** l'asset Cloudinary (`cloudinary.uploader.destroy` avec le bon `resource_type` et `type="private"`).
- Événement d'audit `medical_document.deleted` (sans contenu).
- Si la suppression Cloudinary échoue : ne pas laisser un enregistrement orphelin silencieux. Marquer le document « suppression en attente » et réessayer, ou refuser avec un message.
- Confirmation dans l'interface avant suppression.

### 4.4 Effacement à la suppression de compte

**Constat.** `account_action_views.py` n'a pas été étendu aux nouveaux modèles : après une demande de suppression, documents (et leurs fichiers Cloudinary), vaccinations, mesures, rappels, prises, rendez‑vous, notifications et plans de suivi subsistent. C'est une lacune de mon lot 1 devenue plus lourde avec la v2 : l'anonymisation ne couvrait que ce qui existait alors.

**Correction.** Dans la même transaction que l'anonymisation actuelle :
1. supprimer les assets Cloudinary de chaque `MedicalDocument` du patient (avant de supprimer les lignes, pour garder les identifiants) ;
2. supprimer les lignes `MedicalDocument`, `Vaccination`, `HealthMeasurement`, `MedicationReminder` (et leurs prises), `Appointment`, notifications du patient ;
3. conserver ce qui relève du dossier clinique signé (consultations, ordonnances, révisions), comme aujourd'hui, et le dire dans le texte de confidentialité ;
4. tracer un événement d'audit sans donnée personnelle.

**Test** : créer un patient avec un document, un vaccin, une mesure, un rappel, un rendez‑vous ; déposer la demande de suppression ; vérifier que tout a disparu, que l'appel de destruction Cloudinary a été fait (simulé), et que les consultations signées sont conservées.

### 4.5 Hébergement chez un tiers (décision juridique)

Des documents médicaux sont stockés chez Cloudinary, en dehors de la Côte d'Ivoire. À documenter dans le dossier de relecture juridique : finalité, localisation du stockage, durée de conservation, autorisation éventuelle de l'ARTCI pour le transfert, sous‑traitance. La livraison privée et le passage par l'API sont de bonnes mesures techniques, mais ne règlent pas la question légale.

### 4.6 Périmètre « documents » pour le médecin

**Constat.** Le périmètre du QR n'inclut pas les documents (commentaire dans la vue : « en V1 »). Le patient garde la maîtrise, mais le médecin ne peut pas consulter la radio ni le bilan pendant la consultation, alors que c'était le but.

**Proposition**, cohérente avec ta décision de partage tout‑ou‑rien :
- ajouter `"documents"` à `ALLOWED_SCOPES` et au périmètre par défaut d'une demande d'accès ;
- l'écran de consentement du patient le dit en clair (« documents du carnet : radios, analyses, ordonnances ») ;
- endpoints en **lecture seule** pour le professionnel : liste et téléchargement, protégés par `require_scope(grant, "documents")`, avec événement d'audit à chaque lecture ;
- côté médecin : un panneau « Documents du patient » sous le brouillon de pré‑consultation.

Mettre à jour les tests qui comparent la liste exacte des périmètres.

**À confirmer** : veux‑tu que le consentement par défaut inclue les documents, ou une case séparée ?

### 4.7 Lien examen demandé ↔ document

Le lot 1 crée des examens « demandés » (`ExamRequest.status = requested`). La v2 n'a aucun lien avec les documents.

- À l'envoi, le patient peut choisir « Résultat d'un examen demandé » parmi ses examens ouverts.
- Le document est rattaché à l'examen, qui passe à « résultat reçu ».
- Le document reste marqué **« ajouté par le patient, non vérifié »** (`verified = false`) : un résultat n'est jamais présenté comme vérifié tant qu'un professionnel ne l'a pas confirmé.
- Plus tard : l'établissement qui réalise l'examen dépose lui‑même le résultat (provenance « établissement »).

---

## 5. P1 — Ordonnance PDF complète

Code concerné : `PatientPrescriptionDownloadView` (`apps/api/apps/care/views.py`), `PrescriptionTemplate` (`apps/api/apps/establishments/models.py`), écran `PrescriptionTemplateSettings.tsx`.

### 5.1 Ce qui existe

Un PDF généré avec reportlab à partir des lignes d'ordonnance structurées, avec en‑tête d'établissement (logo, texte d'en‑tête, adresse, téléphone, e‑mail, pied de page). C'est la bonne base : l'en‑tête fixe rempli une fois par l'établissement.

### 5.2 Ce qui manque ou pose problème

| Problème | Détail |
|---|---|
| Nom du patient absent | Le PDF affiche établissement, prescripteur et date, mais pas à qui est destinée l'ordonnance |
| Aucune zone signature et cachet | Une ordonnance papier porte le cachet du médecin |
| Numéro d'ordre absent | Les cachets de tes photos portent un numéro (N° ONMC pour un médecin, N° ONCD pour un chirurgien‑dentiste) |
| « Prochain RDV » absent | Présent sur le modèle papier |
| Coupure de ligne à 95 caractères | Pas de mesure de la largeur réelle : débordement possible, mots coupés |
| Logo téléchargé à chaque PDF | `urlopen(logo_url)` sur une URL saisie par l'établissement, sans plafond de taille ni restriction d'adresse |
| Police standard Helvetica | Suffisante pour le français courant, mais fragile pour d'autres caractères |

### 5.3 Correction proposée

**Contenu du PDF (de haut en bas)**
1. En‑tête d'établissement : logo, nom, adresse, téléphone, e‑mail.
2. Titre « ORDONNANCE MÉDICALE », lieu et date.
3. **Patient : nom et prénoms** (et âge si la date de naissance est renseignée).
4. Prescription numérotée : médicament, dosage, posologie, durée, instructions.
5. « Prochain RDV : » (date si un rendez‑vous existe, sinon une ligne vide).
6. **Bloc « Signature et cachet du médecin »** : image du cachet et de la signature, nom, spécialité, numéro d'ordre.
7. Pied de page de l'établissement + mention « Document généré par Mon E‑Carnet ».

**Cachet et signature : par médecin, pas par établissement.** Un cachet est personnel. L'établissement fournit l'en‑tête, le logo et le pied de page ; chaque médecin téléverse **son** cachet et **sa** signature (PNG fond transparent) et saisit son numéro d'ordre.
- Nouveau modèle `ProfessionalSeal` (professionnel, image Cloudinary privée, numéro d'ordre, ordre professionnel), ou champs sur le profil professionnel si un champ de numéro d'ordre existe déjà : à vérifier dans `apps/api/apps/professionals/`.
- L'image est placée **uniquement** si la consultation est signée par ce médecin.
- Un PDF généré pour une consultation non signée n'existe pas (il est déjà impossible d'en créer, mais l'écrire dans un test).

**Logo.** Remplacer `logo_url` par un envoi d'image (PNG/JPEG/WebP, 1 Mo maximum, vérifié par signature) stocké sur Cloudinary, avec mise en cache ou redimensionnement à l'envoi. Plus aucune requête vers une URL libre pendant la génération. En attendant : n'autoriser que `https`, refuser les adresses privées et locales, fixer un délai court et un plafond de 1 Mo de lecture.

**Mise en page.** Utiliser `reportlab.lib.utils.simpleSplit` (ou des `Paragraph`) pour couper selon la largeur de la page, et embarquer une police Unicode (DejaVu Sans ou équivalent libre) pour être indépendant du jeu de caractères.

**Valeur d'usage.** Le pied de page actuel dit « à imprimer selon les exigences légales applicables ». C'est honnête. Il faut faire valider par un juriste ou l'ordre concerné ce qu'une pharmacie ivoirienne accepte (impression papier signée, ou ordonnance numérique) avant de promettre quoi que ce soit.

**Plus tard (P3).** Un QR sur l'ordonnance qui mène à une page de vérification (empreinte de l'ordonnance, médecin, date), pour qu'une pharmacie puisse contrôler l'authenticité.

### 5.4 Tests à ajouter

- le PDF contient le nom du patient et les lignes d'ordonnance (extraction de texte) ;
- le PDF d'une consultation d'un autre patient est refusé (404) ;
- aucune requête réseau n'est faite pendant la génération ;
- un cachet absent produit un PDF valide avec la zone vide, pas une erreur ;
- une ordonnance de plus de 40 lignes s'étend sur plusieurs pages sans perdre de ligne ;
- les accents et apostrophes typographiques s'impriment correctement.

---

## 6. P2 — Constantes : un seul historique, tension et glycémie en champs libres

### 6.1 Constat

Deux systèmes coexistent :

| | Constantes de consultation (lot 1) | Mesures du patient (v2) |
|---|---|---|
| Stockage | JSON sur la pré‑consultation et la consultation signée | `HealthMeasurement` (une ligne par valeur) |
| Tension | `systolic` et `diastolic` numériques | deux types de mesure séparés |
| Unités | non imposées, rappel d'écran | **imposées** : mmHg, g/L (`HealthMeasurementSerializer` refuse une autre unité) |
| Provenance | `preconsultation` / `professional` | `measured` / `declared` |

Aucun pont entre les deux : une constante prise en consultation n'alimente pas la courbe du patient. Et ta décision (laisser la tension et la glycémie à remplir librement) n'est appliquée ni dans l'un ni dans l'autre.

### 6.2 Décision à appliquer

- **Tension** : un seul champ texte libre (exemples affichés : `12/8`, `120/80 mmHg`). Le serveur n'impose ni unité ni conversion.
- **Glycémie** : un seul champ texte libre (exemples : `0,9 g/L`, `5,2 mmol/L`).
- **Poids, taille, température, fréquence cardiaque, SpO₂** : restent numériques, leur unité n'étant pas ambiguë.

### 6.3 Mise en œuvre

**Backend (`care/vitals.py`)**
- Remplacer `systolic`, `diastolic`, `glycemia_g_l` par `blood_pressure` et `glycemia` (texte, 24 caractères maximum, au moins un chiffre, espaces normalisés).
- Mettre à jour `VITAL_KEYS` et la fusion avec provenance (`build_consultation_vitals` fonctionne déjà sur des valeurs quelconques).
- **Migration de données** (`RunPython`) pour les valeurs déjà enregistrées : `systolic`/`diastolic` → `blood_pressure = "110/70 mmHg"` ; `glycemia_g_l` → `glycemia = "0,9 g/L"`, sur `CareEncounter.vitals` et `Consultation.vitals`.
- Mettre à jour `test_consultation_content.py` : cas de la tension à moitié saisie et de la tension inversée remplacés par « texte sans chiffre refusé » et « texte trop long refusé ».

**Frontend (`lib/vitals.ts`, `PatientPreconsultations.tsx`, `ProfessionalConsultations.tsx`, `PatientConsultations.tsx`)**
- Champs texte pour ces deux constantes, avec exemples en `placeholder`.
- Affichage tel que saisi, sans reformatage.
- Adapter `tests/consultation-visite.test.mjs`.

**Mesures du patient (`HealthMeasurement`)**
- Tension et glycémie : stocker le texte saisi (champ `raw_value`), valeur numérique facultative.
- Supprimer la contrainte d'unité imposée pour ces deux types.

### 6.4 Un seul historique

- Source de vérité : les constantes d'une consultation signée sont immuables ; les mesures du patient sont ses relevés personnels.
- Créer une **vue d'historique** (lecture seule) qui fusionne les deux, triée par date, avec la provenance : « relevée en pré‑consultation », « mesurée par le médecin », « mesurée par le patient », « déclarée ».
- Les courbes ne portent que sur les constantes numériques à unité non ambiguë (poids, température, fréquence cardiaque, SpO₂). Pour la tension et la glycémie en texte libre, afficher une **liste datée** : tracer une courbe supposerait de deviner l'unité (12/8 en cmHg ou 120/80 en mmHg), et je déconseille de la deviner.
- Option ultérieure si tu veux des courbes de tension : un petit sélecteur d'unité facultatif à côté du champ libre.

---

## 7. P1 — CI et tests

### 7.1 Test de la carte d'urgence

`tests/emergency-card.test.mjs` (lignes 17 et 19) attend le QR **à côté** des informations (`.ecard__body` en deux colonnes). La v2 a modifié `emergency-card.css` à 08:27 (carte au format 9/16, QR sous les informations) sans toucher au test, qui date du 17 octobre : il échoue.

Trois options :
1. si le nouveau design est voulu : mettre à jour le test pour qu'il vérifie la nouvelle règle (colonne unique, `aspect-ratio: 9 / 16`, largeur 420 px) ;
2. sinon : revenir à l'ancien CSS ;
3. dans les deux cas : garder un garde‑fou, la leçon du test étant qu'une version avait déjà perdu ces règles par accident.

Le CI lance désormais `npm run test:web` : tant que ce test échoue, le CI est rouge.

### 7.2 Séquence de recette à rejouer avant toute livraison

```bash
# Backend
cd apps/api
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test apps.care apps.identity apps.patients apps.establishments

# Frontend
cd ../web
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Noter dans le document de recette **la date et l'heure de chaque exécution** et ne plus modifier le code après sans les rejouer : l'audit actuel est antérieur à la dernière retouche.

### 7.3 Fichiers de test hors script

`tests/modal-illustrations.test.mjs` et `tests/mon-e-carnet-v13.test.mjs` existent mais ne sont pas dans `npm test`. Les ajouter au script (ils passent aujourd'hui : 13 tests) ou les supprimer.

---

## 8. P2 — Vaccinations

**Bien en place** : modèle dédié (une ligne par dose), statuts `declared / documented / confirmed`, `status` en lecture seule côté patient.

**À ajouter**
1. **Circuit de confirmation** : un professionnel avec accès actif (périmètre « consultations » ou « documents ») peut confirmer une vaccination ; le statut passe à « confirmée », avec son nom et la date, et un événement d'audit.
2. **Statut « documentée »** : quand le patient rattache un document (photo de la page vaccinations du carnet papier), la vaccination passe de « déclarée » à « documentée ». Elle ne devient « confirmée » que par un professionnel.
3. **Liste préremplie** reprenant les vaccins imprimés dans le carnet papier : BCG, DT‑Coq‑Polio (1ʳᵉ, 2ᵉ, 3ᵉ injections et rappels), rougeole, fièvre jaune, et « Autre ». Sans interprétation médicale ajoutée.
4. **Prochaine échéance** : le champ `next_due_on` existe ; l'afficher sur l'accueil et le brancher sur les rappels **après** le pilote.
5. **Photo directe** de la page du carnet : plus réaliste que la saisie dose par dose (les pages vaccinations des carnets d'adultes sont souvent vides).

**Tests** : le patient ne peut pas envoyer `status=confirmed` (ignoré) ; un professionnel sans accès ne peut pas confirmer ; une confirmation crée un événement d'audit.

---

## 9. P3 — À geler jusqu'au pilote

Rappels de médicaments, rendez‑vous, notifications, plans de suivi, modèles de pré‑consultation, tableaux de bord. Ils sont codés et testés ; je recommande de **ne plus les étendre** et de mesurer d'abord leur usage réel dans un établissement. Chaque module ajouté augmente la surface de données à protéger (et à effacer, §4.4) avant que la boucle principale ait fait ses preuves.

Mettre en pause aussi : modèles d'ordonnance personnalisés par spécialité (un dentiste note des actes par numéro de dent, un laboratoire rend des résultats : les modèles rigides ne conviennent pas à tous), études de marché et documents de roadmap supplémentaires.

---

## 10. Plan par lots

### Lot 2 — Sécuriser (P0 + P1)

| # | Tâche | Critère de fin |
|---|---|---|
| 2.1 | Rotation des secrets, suppression du `.env`, nettoyage de la racine | §3.3 |
| 2.2 | Formats autorisés réduits + vérification de signature + compression côté téléphone | Tests §4.1 verts |
| 2.3 | Quotas et limite de débit à l'envoi | Test : le 21ᵉ envoi de l'heure est refusé (429) |
| 2.4 | Suppression d'un document (base + Cloudinary) | Test + audit |
| 2.5 | Effacement complet à la suppression de compte | Test §4.4 vert |
| 2.6 | Logo d'ordonnance : envoi d'image, plus de requête vers une URL libre | Test : aucune requête réseau à la génération |
| 2.7 | Test et CSS de la carte d'urgence alignés ; tests orphelins ajoutés au script | `npm test` vert |
| 2.8 | Recette complète rejouée et horodatée | §7.2 |

### Lot 3 — Données cohérentes (P2)

| # | Tâche | Critère de fin |
|---|---|---|
| 3.1 | Tension et glycémie en champs libres (backend, frontend, mesures) + migration de données | Tests §6.3 verts |
| 3.2 | Historique unifié (liste datée + courbes numériques) | Une consultation signée apparaît dans l'historique du patient |
| 3.3 | Périmètre « documents » + panneau côté médecin | Test : sans le périmètre, 403 ; avec, lecture seule et audit |
| 3.4 | Lien examen demandé ↔ document, statut « résultat reçu » | Test : le document rattaché passe l'examen à « résultat reçu », non vérifié |

### Lot 4 — Ordonnance complète

| # | Tâche | Critère de fin |
|---|---|---|
| 4.1 | Nom du patient, « prochain RDV », mise en page par largeur, police Unicode | Tests §5.4 |
| 4.2 | `ProfessionalSeal` : cachet, signature, numéro d'ordre par médecin | Test : cachet présent uniquement pour une consultation signée |
| 4.3 | Écran de téléversement du cachet dans le profil professionnel | Recette manuelle sur téléphone |
| 4.4 | Validation juridique de l'usage en pharmacie | Avis écrit |

### Lot 5 — Vaccins et pilote

| # | Tâche | Critère de fin |
|---|---|---|
| 5.1 | Confirmation par un professionnel, statut « documentée » | Tests §8 |
| 5.2 | Liste préremplie des vaccins du carnet papier + photo de la page | Recette manuelle |
| 5.3 | Pilote avec un établissement : un médecin, un infirmier, dix patients volontaires | Retours écrits, liste des blocages |
| 5.4 | Décision sur les modules gelés selon l'usage mesuré | Décision datée |

---

## 11. Décisions à confirmer

- [ ] Le consentement par défaut inclut‑il les documents, ou une case séparée ? (§4.6)
- [ ] Carte d'urgence : design 9/16 voulu, ou retour à l'ancien ? (§7.1)
- [ ] Cachet et signature par médecin, en PNG téléversé : validé ? (§5.3)
- [ ] Courbes de tension et glycémie : liste datée seulement, ou sélecteur d'unité facultatif plus tard ? (§6.4)
- [ ] Quotas de départ : 100 documents et 200 Mo par patient, 20 envois par heure ? (§4.2)
- [ ] Ethnie : toujours absente du carnet ? (décision du lot 1, à confirmer avec la relecture juridique)
- [ ] Qui valide juridiquement l'ordonnance numérique et l'hébergement Cloudinary ? (§4.5, §5.3)

---

## 12. Annexe — fichiers concernés

| Chantier | Fichiers |
|---|---|
| Secrets et hygiène | `apps/api/.env`, `.gitignore`, `jj`, `akatech-v3.1.zip`, images racine, `apps/web/tsconfig.tsbuildinfo` |
| Documents | `apps/api/apps/care/views.py`, `serializers.py`, `models.py`, `urls.py`, `apps/api/apps/cloudinary_storage.py`, `apps/api/config/settings.py`, `apps/web/src/components/MedicalDocuments.tsx`, `care/test_medical_documents.py` |
| Suppression de compte | `apps/api/apps/identity/account_action_views.py`, `identity/test_identity_titulaire.py` |
| Ordonnance | `PatientPrescriptionDownloadView` (`care/views.py`), `apps/api/apps/establishments/models.py` (`PrescriptionTemplate`), `PrescriptionTemplateSettings.tsx`, `apps/api/apps/professionals/` (cachet, numéro d'ordre) |
| Constantes | `apps/api/apps/care/vitals.py`, `models.py` (`HealthMeasurement`), `serializers.py`, `apps/web/src/lib/vitals.ts`, `HealthMeasurements.tsx`, `PatientPreconsultations.tsx`, `ProfessionalConsultations.tsx`, `PatientConsultations.tsx`, `tests/consultation-visite.test.mjs` |
| Vaccins | `care/models.py` (`Vaccination`), `care/views.py`, `apps/web/src/components/Vaccinations.tsx` |
| CI et tests | `apps/web/tests/emergency-card.test.mjs`, `apps/web/src/components/emergency-card/emergency-card.css`, `.github/workflows/ci.yml`, `apps/web/package.json` |

---

*Document établi à partir de la lecture du code de `e-carnet_v2.zip`. Les tests Django, le build et le e2e n'ont pas été exécutés dans mon environnement : à rejouer avant toute décision de mise en production. La plateforme reste en phase de test : ne saisir que des données fictives.*
