# Modifications du 08/11/2026 — fin d'accès automatique, scan → consultation, cartes uniformes, bienvenue centré

Base : V1.7.3.

## 1. Fin d'accès automatique à la signature
- Signer la consultation (`POST /professional/consultations/`) ferme l'accès du professionnel **dans la même transaction** : statut `expired`, `expires_at` = maintenant. Le patient n'a rien à révoquer si le professionnel oublie.
- Point unique : `end_access_grant()` (`apps/care/services.py`), utilisé aussi par « Terminer l'accès ». Mise à jour **conditionnelle** (seulement si l'accès est encore actif) : pas de double événement ni de double notification en cas de course ; renvoie `False` si l'accès n'était plus actif.
- Audit : `access_grant.ended` avec `reason_code` = `consultation_signed` ou `professional_ended` (clé déjà autorisée par la liste blanche du journal ; la liste n'est pas élargie).
- Notification patient (`access.ended`) : « Consultation terminée … son accès s'est fermé automatiquement ».
- Signature refusée (pré-consultation inconnue, accès révoqué…) : l'accès reste ouvert, rien n'est écrit.
- **Conséquence à connaître** : après la signature, le professionnel ne peut plus ajouter de mesures ni de pièces sur ce patient sans un nouveau QR. Il saisit tout avant de signer.
- Test existant adapté : `test_patient_consent_to_professional_consultation_and_revocation` (après signature, l'accès est déjà fermé : révoquer répond 409).

## 2. Scan réussi → consultation du patient
- `ProfessionalAccessGrants.tsx` : la lecture du QR ouvre l'accès **sans second clic** (garde contre le double envoi), puis redirige vers `/professionnel/consultations?acces=<id>`.
- `ProfessionalConsultations.tsx` : ouvre ce patient (même s'il y en a plusieurs de connectés), retire le paramètre de l'adresse, amène le formulaire sous les yeux.
- Échec (ex. patient déjà connecté à un confrère) : l'erreur s'affiche près du bouton ; le QR n'est pas consommé, « Ouvrir l'accès » réessaie.
- Après signature, le patient quitte la liste des patients connectés ; message et confirmation précisent que l'accès se ferme tout seul.

## 3. « Mes demandes » : cartes identiques
- Chaque carte : identité (photo + nom, une ligne, « … »), périmètre (2 lignes max), pied (statut, temps restant, « Terminer l'accès »). Hauteur minimale commune, grille `auto-fill` : mêmes rectangles quel que soit le statut.
- `consultation-flow.css` : `.record.request-row` (spécificité relevée pour passer devant `.record` de `globals.css`), `.request-list`.

## 4. Bienvenue
- Centré au milieu de l'écran (horizontal **et** vertical), PC et mobile, toujours non bloquant.
- La goutte gooey naît au centre de la carte (`goo-blob-grow-center`) ; `GooLayer` se recale à la rotation / au redimensionnement. Mouvement réduit : inchangé (aucun calque).

## Tests
- Serveur : `test_auto_end_on_signature.py` (5 tests). Suite `apps.care` + `apps.audit` : tout passe après adaptation du test existant.
- Front : `acces-consultation-2026-11-08.test.mjs` (4 tests). `tsc --noEmit` et `eslint` propres sur les fichiers modifiés.
- 4 fichiers de tests front échouent déjà en V1.7.3 (imports sans extension non résolus par `node --test`) : `boutons-gooey-aide`, `hors-connexion-2026-11-05`, `landing`, `site`.
- **Non vérifié** : le rendu visuel (aucun navigateur lancé) — à contrôler sur mobile : cartes « Mes demandes » (actif / expiré / en attente), redirection après scan, bienvenue centré avec la goutte.

## À appliquer
Dézipper par-dessus le projet. Aucune migration, aucune dépendance ajoutée.
