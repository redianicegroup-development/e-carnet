# v1.3 (29/10/2026) — mise à jour du projet sur la liste du reste à faire

Base : v1.2. Décisions du porteur du projet appliquées ci-dessous. Le document « reste à faire » n'est volontairement pas modifié : il sera mis à jour ensuite, d'après l'état réel.

## Réalisé
- **PAT-09 — Export Excel par période** : `GET /api/v1/patient/care/export/?format=xlsx&from=AAAA-MM-JJ&to=AAAA-MM-JJ` (PDF inchangé par défaut). Classeur écrit avec la bibliothèque standard (aucune dépendance à verrouiller) : Résumé, Déclarations, Vaccinations, Mesures, Consultations validées, Documents (liste seulement), Rappels, Prises, Rendez-vous. Aucune formule possible (cellules neutralisées), export journalisé (`patient.carnet.exported`), jamais mis en cache. Écran : `PatientCarnetExport.tsx` (période, avertissement, case « J'ai compris »). Fichiers : `care/export_xlsx.py`, `care/views.py`, tests dans `care/test_v2_tracking.py`.
- **ADM-07 — Journal d'audit consultable** : `GET /api/v1/identity/admin/audit/` (filtres type, rôle, période ; pagination) et `/audit/export/` (CSV, 5 000 lignes maximum, journalisé). Réservé aux comptes d'exploitation (`IsOperationsAdmin`). Aucun identifiant de patient, e-mail de l'acteur masqué, seules les métadonnées autorisées sont rendues. L'immuabilité existait déjà (mise à jour et suppression interdites) et est maintenant testée. Écran : onglet « Journal d'audit » de la console (`AdminAuditJournal.tsx`). Fichiers : `identity/admin_audit.py`, `identity/urls.py`, `identity/test_admin_audit.py`.
- **ACC-02 — Connexion Google seule** : les boutons Facebook et Apple n'apparaissent que si le serveur les a configurés (`/oauth/providers/`) ; Google reste affiché d'emblée.
- **PAT-20 — Carte d'urgence** : l'alerte envoyée au patient lors de la consultation de la carte publique est supprimée (décision : carte publique, déclarations du patient, pas d'alerte). Test : `patients/test_emergency_card_no_alert.py`.

## Constaté sans modification
- ACC-06 récupération de compte : en place.
- ETA-09 : tous les administrateurs actifs d'un établissement peuvent ouvrir un dossier, avec motif obligatoire, audit et historique visible par le patient. Écarts avec la décision : durée fixée à 30 minutes (`RECORD_OPENING_TTL`) et aucun motif « Urgence » dans la liste. **Non modifié** en attendant la confirmation de ce que « durée indéfinie » doit changer.
- PAT-14 : le suivi des comprimés restants et le seuil de renouvellement existent dans le modèle ; le mot « stock » n'apparaît pas à l'écran.

## Pas encore fait
PAT-14 (récurrence par jours de la semaine, renouvellement), PAT-16 / PRO-16 (confirmer, déplacer, annuler, rappeler côté professionnel et établissement : aucun point d'accès n'existe), PRO-15, PAT-19 (résumé périodique des accès), PAT-21 (validation faible débit), ETA-11 à ETA-14 (relances, validation réelle), et la mise en service du Web Push (verrouillage de `pywebpush`, clés, cron, essais Android et iPhone).

## Vérification
Tests web : 199 réussis, mêmes 6 échecs qu'avant (aide, rattachement médecin, QR visite, schémas, stockage local, cache de thème). Python compilé ; classeur Excel ouvert avec openpyxl et LibreOffice. **Non exécutés ici** : tests Django (les nouveaux tests API sont écrits mais pas lancés), `makemigrations --check` (aucune migration ajoutée), build Next.
