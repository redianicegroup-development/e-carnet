# Mises à jour du 22/10/2026 — cachet & signature, récupération de compte, liaison Google

Aucune migration à appliquer. Aucune nouvelle dépendance.

## 1. Cachet et signature du prescripteur
- **Capture** (`InkCapture.tsx`) : photo depuis le navigateur (caméra), import d'une image ou **dessin à la main** (signature). Le fond est retiré dans le navigateur (`lib/ink-extract.ts`, sans bibliothèque) : papier estimé par zones, seuil proportionnel au contraste, bords adoucis, poussières effacées, recadrage sur l'encre. Encre d'origine, noire ou bleue, avec réglage de sensibilité. Une feuille vide ou trop sombre est refusée avec un message.
- **Réglages** : `ProfessionalCredentialsSettings` (aperçu, remplacement, suppression).
- **Onboarding professionnel** : nouvelle étape `/professionnel/onboarding/ordonnance` avant la sécurité, avec bouton **Passer**.
- **Consultations** : `ConsultationSeal` affiche, en fin de consultation, le cachet et la signature enregistrés.
- **API** : `GET/DELETE /api/v1/professionals/credentials/<stamp|signature>/` (fichiers privés, servis via l'API).
- **Ordonnance PDF** : cachet + signature en pied, et mention « Signé électroniquement dans Mon E-Carnet par … le … · réf. … » (signature électronique, comme E-Carnet) même sans image.

## 2. Récupération de compte
- **Modal claire** (`RecoveryNoticeDialog`, `recoveryNotice.ts`) : réponse incorrecte (essais restants), blocage (heure de fin), trop de tentatives, réponse acceptée.
- **Anti-énumération conservé** : mêmes champs et mêmes valeurs pour une adresse inconnue (compteur en cache).
- **Console admin** : nouvel onglet « Récupération » (`AdminRecoveryClient`) — réponses fausses, blocages, comptes bloqués maintenant, réponses acceptées, mots de passe réinitialisés, demandes « Écrire à l'équipe » avec statut. API : `GET /api/v1/identity/admin/recovery/`, `PATCH /api/v1/identity/admin/contact-messages/<id>/`.
- Les adresses sans compte ne sont pas journalisées ; les réponses et mots de passe ne le sont jamais.

## 3. Liaison automatique Google (établissements)
- Après l'enregistrement de la fiche, si l'adresse du compte est Gmail/Googlemail, Google est configuré et pas encore lié : la liaison démarre seule (une validation chez Google reste nécessaire).
- **Serveur** : pour un compte établissement, le compte Google doit porter **la même adresse** et Google doit l'avoir **confirmée** ; sinon refus (`email_mismatch` / `email_unverified`), trace `oauth.link_refused`, retour sur les paramètres avec le message.
- Retour de liaison adapté au rôle (plus de `/patient/parametres` pour tous). Nouvelle route `GET /api/v1/identity/oauth/providers/` (fournisseurs configurés, sans secret).
- Autres adresses que Gmail : liaison manuelle dans Paramètres › Sécurité.

## Tests
- Node : `tests/ink-capture-2026-10-21.test.mjs` (11 tests, passent). Suite complète : 164/167, les 3 échecs existaient déjà.
- Python : `test_credentials.py`, `test_recovery.py`, `test_admin_recovery.py`, `test_oauth_establishment.py` écrits mais **non exécutés ici** (Django absent) : lancer `python manage.py test apps.identity apps.professionals`.
