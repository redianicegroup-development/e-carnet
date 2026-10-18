# Implémentation V1 — documents, vaccination et ordonnances

Date : 18 octobre 2026

## Résumé

La V1 intègre désormais le parcours simple demandé : le patient peut importer ses ordonnances et documents médicaux, conserver son carnet de vaccination et télécharger une ordonnance imprimable issue d’une consultation validée.

Les établissements disposent aussi d’un modèle d’ordonnance personnalisable. Ils configurent uniquement la présentation du document ; le médecin reste responsable du contenu médical, de la prescription et de sa validation.

## Fonctionnalités réalisées

### Documents médicaux

- Import patient de fichiers PDF, PNG et JPG/JPEG.
- Classement : ordonnance, analyse, imagerie, certificat, compte rendu ou autre.
- Date du document et établissement émetteur facultatifs.
- Taille maximale : 10 Mo.
- Stockage privé ; aucun fichier n’est servi par une URL publique.
- Téléchargement uniquement par le patient authentifié et propriétaire du document.
- Journal d’audit pour l’import et la consultation.
- Les documents restent exclus du périmètre QR professionnel de la V1.

### Carnet de vaccination

- Nom du vaccin, numéro de dose, date d’administration et prochain rappel.
- Numéro de lot, centre, professionnel et note facultatifs.
- Statut initial « Déclarée ».
- Une vaccination ancienne inconnue n’est jamais convertie automatiquement en « non effectuée ».

### Ordonnance imprimable

- PDF généré depuis une consultation validée et ses lignes de prescription.
- Informations du professionnel, de l’établissement, date, médicament, dosage, posologie, durée et instructions.
- Bouton « Imprimer / PDF » dans l’historique patient.
- Téléchargement protégé par l’authentification et l’appartenance au dossier patient.

### Modèle d’ordonnance établissement

L’administrateur d’un établissement actif peut configurer :

- URL du logo ;
- texte d’en-tête ;
- adresse ;
- téléphone ;
- email ;
- texte de pied de page.

Ces éléments sont intégrés au PDF d’ordonnance. Le professionnel conserve la responsabilité de la prescription.

### Frontend

Les mentions visibles « pilote », « phase de test », « environnement de test » et « données fictives uniquement » ont été retirées des pages et composants frontend visibles. Les textes ont été remplacés par des informations générales sur la confidentialité et l’utilisation responsable du compte.

Le loader d’espace affiche désormais : « Veuillez patienter, chargement de votre espace… ».

## Fichiers backend touchés

### Care / médical

- `apps/api/apps/care/models.py` — modèles `MedicalDocument` et `Vaccination`, stockage privé des documents.
- `apps/api/apps/care/serializers.py` — serializers documents, vaccinations et métadonnées de téléchargement.
- `apps/api/apps/care/views.py` — import, téléchargement, vaccination et génération PDF d’ordonnance.
- `apps/api/apps/care/urls.py` — routes documents, vaccinations et ordonnance PDF.
- `apps/api/apps/care/migrations/0010_medicaldocument.py` — table des documents.
- `apps/api/apps/care/migrations/0011_vaccination.py` — table des vaccinations.
- `apps/api/apps/care/test_medical_documents.py` — tests documents, isolement, vaccinations et ordonnance PDF.
- `apps/api/config/settings.py` — dossier privé `MEDIA_ROOT`.
- `apps/api/apps/cloudinary_storage.py` — configuration, upload et téléchargement signé Cloudinary.
- `apps/api/apps/care/migrations/0012_medicaldocument_cloudinary.py` — identifiants Cloudinary des documents.
- `apps/api/apps/identity/auth_views.py` — avatars WebP envoyés à Cloudinary.

### Établissements

- `apps/api/apps/establishments/models.py` — modèle `PrescriptionTemplate` lié à un établissement.
- `apps/api/apps/establishments/serializers.py` — lecture et validation du modèle.
- `apps/api/apps/establishments/views.py` — GET/PATCH administrateur du modèle.
- `apps/api/apps/establishments/urls.py` — route `/<establishment_id>/prescription-template/`.
- `apps/api/apps/establishments/migrations/0008_prescriptiontemplate.py` — migration du modèle.

### Dépendances

- `apps/api/requirements.in` — ajout de ReportLab.
- `apps/api/requirements.txt` — ajout de ReportLab pour la génération PDF.
- `apps/api/requirements.in` et `apps/api/requirements.txt` — ajout de Cloudinary pour les uploads.

### Cloudinary

Cloudinary devient le stockage des uploads applicatifs. Les documents médicaux sont envoyés comme assets privés, puis récupérés par l’API uniquement après contrôle du propriétaire et génération d’un téléchargement signé. Les avatars et logos sont envoyés comme assets images Cloudinary. Les secrets ne sont jamais placés dans le frontend : seules les variables `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` et `CLOUDINARY_BASE_FOLDER` sont lues côté serveur ou par le script de migration.

Le script `scripts/upload-cloudinary.cjs` parcourt `apps/web/public` par défaut et envoie les PDF, PNG, JPG/JPEG, WebP, GIF, SVG, AVIF, WebM, MP4 et MOV. Il accepte `CLOUDINARY_SOURCE_DIR` pour un autre dossier et `--dry-run` pour simuler l’envoi. Il met à jour `apps/web/src/data/cloudinaryVersions.js` afin que la migration soit réexécutable.

## Fichiers frontend touchés

- `apps/web/src/components/MedicalDocuments.tsx` — import et historique des documents.
- `apps/web/src/components/Vaccinations.tsx` — carnet de vaccination.
- `apps/web/src/components/PatientCarnet.tsx` — intégration documents et vaccinations.
- `apps/web/src/components/PatientConsultations.tsx` — bouton d’ordonnance imprimable.
- `apps/web/src/components/PrescriptionTemplateSettings.tsx` — formulaire du modèle établissement.
- `apps/web/src/components/EstablishmentSettingsClient.tsx` — entrée de navigation et écran du modèle.
- `apps/web/src/components/shell/SpaceShell.tsx` — nouveau message du loader et retrait du pied de page de test.
- `apps/web/src/infrastructure/api/client.ts` — envoi sécurisé multipart avec `apiUpload`.
- `apps/web/src/infrastructure/api/client.ts` — helper multipart PATCH pour le logo Cloudinary.
- `apps/web/src/app/page.tsx` et pages publiques — retrait des textes de phase pilote/test.
- `apps/web/src/app/aide/page.tsx`, `apps/web/src/components/help/HelpCenter.tsx` et `helpContent.ts` — textes utilisateurs actualisés.
- `apps/web/src/app/cgu/page.tsx`, `confidentialite/page.tsx`, `mentions-legales/page.tsx`, `securite/page.tsx` — retrait des mentions d’environnement de test visibles.
- `apps/web/src/app/v1/page.tsx`, `apps/web/src/app/a-propos/page.tsx`, `apps/web/src/app/credits/page.tsx` — retrait des messages de données fictives/pilote.
- `apps/web/src/lib/landing-content.ts`, `apps/web/src/lib/legal/config.ts` — textes de présentation mis à jour.
- `apps/web/public/llms.txt` — description publique mise à jour.
- `scripts/upload-cloudinary.cjs` — migration réexécutable des assets visuels et PDF vers Cloudinary.
- `.env.example`, `apps/api/.env.production.example` — variables Cloudinary documentées.
- `docker-compose.yml`, `render.yaml` — transmission des variables Cloudinary au backend.

## Variables nécessaires

À renseigner dans Render, Docker Compose ou un fichier local non committé :

```text
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_BASE_FOLDER=e-carnet
```

Le frontend ne reçoit jamais la clé secrète. En production, l’absence de Cloudinary bloque les nouveaux uploads au lieu de les enregistrer silencieusement en local. Le fallback local est conservé uniquement pour les tests automatisés sans secrets.

## Sécurité et permissions

- Un document médical n’est listé que dans le dossier patient courant.
- Un téléchargement d’ordonnance ou de document vérifie le patient authentifié.
- La configuration du modèle d’ordonnance est réservée à l’administrateur actif de l’établissement.
- Les professionnels utilisent le modèle de leur établissement lors de l’impression, mais ne peuvent pas le modifier depuis le parcours clinique.
- Les documents médicaux ne sont pas ajoutés automatiquement aux accès QR.

## Vérifications exécutées

- `manage.py check` : réussi.
- `manage.py makemigrations --check --dry-run` : aucune migration manquante détectée après ajout des migrations.
- Tests ciblés documents/vaccination/ordonnance : réussis.
- Suite explicite des applications métier : 244 tests réussis, 3 ignorés.
- Compilation Python : réussie.

Le build frontend complet doit être exécuté dans l’environnement de développement du projet qui possède le paquet privé `@ecarnet/ui`.

## Limite volontaire

La signature électronique qualifiée, les exigences propres aux pharmacies et la conformité juridique locale doivent encore être validées par les responsables compétents. Le PDF est un document imprimable généré depuis une consultation validée ; il ne prétend pas remplacer une validation légale externe.
