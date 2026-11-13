# Appliquer la mise à jour du 07/11/2026

1. Remplacer le code par ce zip (backend `apps/api`, frontend `apps/web`).
2. Backend (Render) : exécuter `python manage.py migrate` — migration `care.0028_examrequest_proof_document`.
3. Frontend (Vercel) : déployer normalement. Le service worker se met à jour tout seul.
4. Essais sur téléphone (voir `docs/MODIFICATIONS-2026-11-07-consultation-par-selection.md`) :
   - consultation : patient, listes, ordonnance, photo d'examen, signature ;
   - rattachements : changer d'établissement actif ;
   - accueil patient : « Partager en QR » deux fois de suite (deux QR différents) ;
   - mode avion pendant la navigation dans les onglets et les paramètres, puis retour de la connexion (la page se met à jour seule).
