# 12/11/2026 — PRO-21 : consultation en attente de résultats et espace laboratoire

**Statut : écrit et relu, NON exécuté.** L'environnement de rédaction n'avait ni Django ni dépendances web : aucun test n'a été lancé, le web n'a pas été compilé (seulement un contrôle de syntaxe TypeScript). À faire avant toute fusion : `python manage.py makemigrations --check`, `python manage.py test apps.care.test_lab_results`, la suite complète, `npm run typecheck`, `npm test`, `npm run build`.

Tout est derrière `ECARNET_LAB_ENABLED` (défaut `false`) : éteint, les nouvelles routes répondent 404 et l'interface n'affiche rien. Données fictives uniquement tant que `REAL_HEALTH_DATA_ALLOWED=false`.

## Parcours
1. L'administrateur d'un établissement crée un laboratoire (nom + e-mail de son administrateur) : compte ouvert avec mot de passe temporaire montré une seule fois. Le responsable du labo se connecte et arrive directement dans l'espace laboratoire.
2. Le médecin demande un examen et clique **« Attendre les résultats »** : sa saisie est enregistrée sans signature, son accès au carnet se ferme, la consultation est bloquée.
3. Le patient affiche son **QR d'examen** (le masque, le renouvelle ou le retire quand il veut).
4. Le laboratoire scanne : il voit le nom, la date de naissance et les examens demandés, **rien d'autre**. Il confirme l'identité, puis dépose un PDF par examen.
5. Quand tous les examens sont reçus (ou abandonnés), la consultation passe « à reprendre ». Le patient présente un **nouveau QR d'accès**, le médecin reprend, lit les PDF et signe. Les examens et PDF rejoignent la vraie consultation.
6. Sortie de secours : « Abandonner l'examen » (motif écrit, audité) côté médecin ; « Annuler l'attente » côté patient.

## Fichiers
**API — nouveaux** : `care/pending_services.py`, `care/pending_views.py`, `care/lab_services.py`, `care/test_lab_results.py`, `care/migrations/0029_pending_consultation_lab_results.py`, `establishments/laboratories.py`, `establishments/migrations/0017_establishment_laboratory.py`.
**API — modifiés** : `care/models.py` (PendingConsultation, PendingExam, champs de MedicalDocument, contrainte), `care/services.py` (motif de fin d'accès), `care/consultation_services.py` (blocage et reprise à la signature), `care/serializers.py`, `care/urls.py`, `establishments/models.py` (`is_laboratory`, `parent`), `establishments/serializers.py`, `establishments/views.py` (catalogue, codes médecin), `establishments/urls.py`, `establishments/clinical_views.py` (laboratoire exclu), `identity/account_action_views.py` (suppression de compte), `config/settings.py` (drapeau, TTL, deux débits).
**Web — nouveaux** : `application/lab-results.ts`, `components/PatientPendingConsultations.tsx`, `ProfessionalPendingResults.tsx`, `LaboratoryWorkspace.tsx`, `EstablishmentLaboratories.tsx`, `lab-results.css`.
**Web — modifiés** : `components/ProfessionalConsultations.tsx`, `components/EstablishmentConsole.tsx`, `application/professional-access-grants.ts`, `app/patient/consultations/page.tsx`.

## Décisions prises faute de réponse (à confirmer)
- Blocage maintenu, avec sortie « Abandonner l'examen » (sinon blocage éternel si le patient ne fait jamais l'examen).
- Reprise = nouveau QR d'accès (le consentement ne se transmet pas).
- QR d'examen valable 14 jours.
- Un laboratoire n'a pas de techniciens pour l'instant (un seul compte administrateur).
- Pas de quota de documents appliqué aux dépôts du laboratoire (10 MiB max par PDF).

## Limites connues
- Le menu de l'espace établissement n'est pas adapté : l'administrateur d'un laboratoire arrive sur l'espace laboratoire, mais les autres pages établissement restent atteignables par adresse (le serveur leur refuse toute lecture clinique et tout code médecin).
- Pas de notification push au médecin tant que les clés VAPID n'existent pas (le patient, lui, est notifié dans l'application).
- Les valeurs structurées (analyte, valeur, unité) et l'intégration HL7/FHIR ne sont pas faites : dépôt PDF uniquement.
- Aucune interprétation automatique des résultats.
