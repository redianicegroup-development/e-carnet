# v1.4 (29/10/2026)

Base : v1.3. Le document « reste à faire » n'est volontairement pas modifié ; il sera mis à jour ensuite d'après l'état réel.

## Fusion du lot P2 (e-carnet-P2-charge-WCAG-mobile-2026-10-29.zip)
11 fichiers (images et styles de la landing, plan de charge Hodi, recette mobile / WCAG / charge, script d'audit WCAG, test de charge k6, rapport, `package.json` avec le script `audit:wcag`). Aucun fichier en commun avec les modifications de la v1.3 : aucun conflit.

## ETA-09 — ouverture d'un dossier par un administrateur d'établissement
- Nouveau motif **« Urgence »** (sans texte libre) : modèle, contrainte de base de données et migration `establishments/0013`.
- **Aucune limite de durée** tant que le motif est enregistré : `expires_at` devient facultatif (vide = sans limite). `ECARNET_RECORD_OPENING_TTL_MINUTES` (défaut 0) rétablit une expiration automatique si besoin.
- Inchangé : tous les administrateurs actifs de l'établissement, motif obligatoire, audit à chaque ouverture, historique visible par le patient.
- Le journal d'audit (ADM-07) n'affiche plus les clés d'identifiants (`*_id`).
- Tests : `establishments/test_patient_records.py` (le test de la limite de 30 minutes est remplacé ; deux tests ajoutés : motif Urgence, durée réglable).
- **À savoir** : l'écran d'ouverture avec choix du motif n'existe pas dans l'application web (seule l'API existe ; le patient voit l'historique dans `PatientEstablishmentViews`). Le motif Urgence est donc disponible côté API, pas encore dans une interface d'administrateur.

## PAT-14 — rappels de médicaments
- **Jours de la semaine** : `days_of_week` (0 = lundi … 6 = dimanche ; vide = tous les jours), migration `care/0024`, validation, prise en compte par `send_due_reminders`, cases à cocher dans le formulaire.
- **Fin du traitement** : champ « Fin du traitement » ajouté au formulaire (il existait côté serveur, pas à l'écran).
- **Renouvellement** : un seul rappel, `ECARNET_REMINDER_RENEWAL_DAYS` jours (3 par défaut, 0 = désactivé) avant la date de fin : « Un de vos traitements se termine bientôt. Pensez à demander son renouvellement. » Texte neutre, sans nom de médicament ; une seule fois par traitement et par date de fin. Aucune notion de stock.
- Tests : `care/test_reminders.py` (jours, tous les jours, renouvellement unique, désactivation, API).

## PAT-16 / PRO-16 — rendez-vous côté professionnel et établissement : non réalisé
Constat : le patient crée un rendez-vous sans choisir de professionnel ni d'établissement (le sérialiseur ne les expose pas), donc aucun rendez-vous n'est rattaché à un destinataire et aucun parcours professionnel ou établissement ne peut les voir. Il faut d'abord que le patient puisse choisir le destinataire (parmi les professionnels ou établissements avec lesquels il a une relation), puis ajouter les actions confirmer, déplacer, annuler, rappeler.

## Vérification
Tests web : 199 réussis, mêmes 6 échecs qu'avant. Python compilé, noms résolus dans la commande modifiée, numérotation des migrations linéaire (care 0023 → 0024, establishments 0012 → 0013). **Non exécutés ici** : tests Django (nouveaux tests écrits, pas lancés), `makemigrations --check` (migrations écrites à la main : à contrôler), build Next.
