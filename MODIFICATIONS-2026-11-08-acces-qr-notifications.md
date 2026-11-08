# Modifications du 08/11/2026 — accès par QR, notifications, historique des accès

Base : V1.7 + overlay « tuiles » du 08/11/2026 (fusionné, voir `MODIFICATIONS-2026-11-08-tuiles-dashboard.md`).

## 1. Nouvelle règle d'accès : le scan du QR vaut accord, un seul professionnel à la fois
- Le professionnel scanne le QR du patient → l'accès est **actif tout de suite**, 2 h, sans validation du patient (pré-consultation, déclarations, documents en lecture seule). Le QR reste à usage unique (5 min).
- **Un seul professionnel connecté par patient** (comme une connexion Bluetooth). Un second scan est refusé (400, message clair) et son QR n'est pas consommé : il fonctionne dès que l'accès en cours se termine (expiration, révocation par le patient, ou fin par le professionnel).
- Un périmètre plus large (`consultations`, `care_history`) reste une demande que le patient accepte ou refuse ; l'acceptation respecte aussi la règle « un seul professionnel » (409).
- Le délai de 30 jours après un refus ne s'applique plus à un QR que le patient présente lui-même.
- Nouveau : `POST /api/v1/patient/care/professional/access-grants/<id>/end/` — le professionnel termine son accès (fin de consultation) ; bouton « Terminer l'accès » (confirmation rouge) dans « Mes demandes » côté professionnel, avec le temps restant.
- Audit : événements `requested` + `accept` avec `method: "qr_scan"` ; notification patient « Accès ouvert » (`access.opened`), « Accès terminé » (`access.ended`).
- Côté patient : le QR affiché disparaît dès qu'il est scanné, et la fenêtre « Partager en QR » confirme « Accès ouvert ».

## 2. Notifications (cloche patient)
- « Temps réel » : `GET /notifications/pulse/` (une requête agrégée, quelques octets) toutes les **5 s** tant que l'écran est visible et en ligne ; la boîte n'est rechargée que si le résumé change. Réveil immédiat au retour sur l'onglet, au retour du réseau et à la réception d'un push (`public/sw.js` prévient les fenêtres ouvertes). Reprise espacée (jusqu'à 60 s) en cas d'erreurs.
- UX : onglets **« Les nouvelles » / « Voir toutes »**, bouton **« Effacer »** par notification, **« Tout marquer comme lu »**, **« Tout effacer »** (seconde pression pendant 4 s). La boîte renvoie les 30 plus récentes.
- API : `DELETE /notifications/<id>/`, `POST /notifications/read-all/`, `POST /notifications/clear/` (`only_read`), portée de limitation `notification_changes` (120/h, `ECARNET_RATE_NOTIFICATION_CHANGES`). Effacer une notification ne touche pas le journal des accès.
- Limite connue : ce n'est pas un WebSocket/SSE (gunicorn sur Render ne tient pas de connexions ouvertes). Vrai temps réel prévu avec le VPS (V3).

## 3. Accueil patient
- Retrait du bloc « Vous êtes hors connexion… Réessayer » ; l'écran se recharge de lui-même au retour du réseau ou de l'application.

## 4. Historique des accès (patient) et consultations (professionnel)
- « Demandes et autorisations » : photo du professionnel (+ logo de sa structure), fonction, temps restant ; accès terminés en lignes compactes.
- « Historique des accès » : **une carte par professionnel** (photo, dernier événement, nombre d'accès et de lectures) ; au toucher, une fenêtre montre **tout ce qu'il a fait**, accès par accès, en frise chronologique (phrases claires, plus de « 0 élément… »).
- « Mes consultations » (professionnel) : photo et nom du patient sur chaque ligne ; la recherche inclut le nom du patient.
- API : `professional_avatar`, `professional_title`, `establishment_logo` sur les accès côté patient ; `professional_id`, `professional_avatar`, `access_grant_id`, `method` dans le journal ; `patient_name`, `patient_avatar` sur les consultations côté professionnel.

## 5. Textes alignés sur la règle
Fenêtre QR, aide (FAQ + dépannage), CGU, confidentialité, visite guidée, schéma des acteurs. **À faire valider par la revue juridique** : le consentement passe de « le patient accepte » à « le patient présente son QR ».

## Tests
- Serveur : `test_auto_access.py` (nouveau, 17 tests) + 6 tests existants mis à jour. 566 tests, 1 échec déjà présent en V1.7 (`test_patient_records` : `test_record_requires_same_user_current_admin_unexpired_opening_and_active_establishment`).
- Front : `historique-acces-2026-11-08.test.mjs` (nouveau) + cloche et QR mis à jour. 383/384, 1 échec déjà présent en V1.7 (« un seul centre d'aide »).
- `tsc --noEmit` et `eslint` propres sur les fichiers modifiés.
- Non vérifié : le rendu visuel (aucun navigateur lancé) — à contrôler sur mobile : cloche, fenêtre d'historique, cartes « Demandes et autorisations ».

## À appliquer
Dézipper par-dessus le projet (chemins relatifs à la racine). **Aucune migration, aucune dépendance ajoutée.**
