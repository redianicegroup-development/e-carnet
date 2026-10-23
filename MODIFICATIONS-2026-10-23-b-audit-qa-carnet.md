# Mises à jour du 23/10/2026 (2) — audit QA médecin/établissement, carnet

À appliquer **par-dessus** `e-carnet-maj-2026-10-23.zip`. Aucune migration.

## Carnet patient
- **« Mes consultations » retiré du carnet** (doublon avec l'onglet **Visites**, où l'historique reste affiché). `PatientCarnet.tsx` ; test `ux-flows` mis à jour.

## Audit QA (détail dans RAPPORT-QA-AKATECH-2026-10-23-medecin-etablissement.md)
- **F1** `establishments/views.py` : seule une demande de rattachement **en attente** peut être approuvée ou refusée (un rattachement quitté ou refusé ne peut plus être « réapprouvé »).
- **F2** `care/views.py` : création d'un plan de suivi = même contrôle que les autres lectures cliniques (établissement courant, autorisation non expirée, périmètre « consultations »).
- **F3** `identity/middleware.py` + `config/settings.py` : `Cache-Control: private, no-store` par défaut sur toute l'API.
- `requirements.in` : `cryptography` ajoutée comme dépendance directe → **lancer `make lock`**.

## Tests
- Node : `un-compte-deux-espaces.test.mjs` passe à 10 tests, verts ; suite complète inchangée (3 échecs préexistants sur des fichiers du 17-19/10).
- Python (**non exécutés**, Django absent ici) : `establishments/test_audit_qa_2026_10_23.py`, `identity/test_api_no_store.py`, `care/test_self_access.py` (classe `FollowUpPlanGrantTests` ajoutée).
  Commande : `python manage.py test apps.establishments apps.identity apps.care`.
