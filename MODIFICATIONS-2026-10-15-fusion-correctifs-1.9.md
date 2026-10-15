# Fusion de « 1.9 correctifs » dans la 1.10 fusion — 15 octobre 2026

## Base et méthode

Base : `e-carnetv_1_10_fusion.zip` (1.10 + fusion « pilule + réveil » du 14/10), prise telle quelle. Les 37 fichiers de `e-carnet_V1_9-correctifs.zip` ont été comparés un par un à cette base. **La 1.10 l'emporte en cas de recouvrement** : les blocs des correctifs ont été repris sauf quand ils auraient effacé du code propre à la 1.10.

## Repris tels quels (la 1.10 n'y avait rien changé)

- **API** : `care/{serializers,services,views,tests}.py`, `patients/{models,serializers,views,tests}.py`, `establishments/test_join_codes.py`, `config/settings.py`, `.env.example`, migration `patients.0007_patientemergencycard_city` (suite directe de la 0006), commande `cleanup_access_qr_tokens`.
- **Web** : carte d'urgence virtuelle (`emergency-card/*`, `PatientEmergencyCardSettingsClient`, `PublicEmergencyCard`, icônes `drop`/`download`/`phone`), types et libellés d'accès professionnel (`reference` à la place de `patient_id`), `AccountSettingsClient`, `ProfessionalAccessFlow`, `ProfessionalConsultations`, `tests/emergency-card.test.mjs`.
- **Docs** : `ETAT-REEL-V1`, `RECETTE-V1`, `api/openapi.yaml`, `README`, `DEPLOYMENT`.

## Fusionnés bloc par bloc (les deux côtés ont changé)

- `SpaceShell.tsx` : le QR quitte le shell (correctif) ; **conservés** `isSessionMissing` (401/403), l'onboarding établissement `profilePending`, l'attente du réveil du serveur.
- `PatientAccessGrants.tsx` : le QR vit dans l'onglet « Accès et QR » (`ActiveAccessQr`) ; **conservée** la confirmation avant autoriser / refuser / prolonger (`decide`, 1.10).
- `globals.css` : règles restaurées (taille du texte, police des titres, assistant de pré-consultation, listes professionnelles, boutons de consentement) ; **conservés** `.notice.error` et `.admin-management-grid` (1.10). Ces règles manquaient dans la 1.10 fusion : les composants les utilisaient sans style.
- `docs/SECURITY.md` : nouveaux textes QR ; **conservée** la section « Hygiène des archives ». `docs/CHANGELOG.md` : les deux entrées du 14/10 sont gardées. `apps/web/package.json` : `emergency-card` et `fusion-correctifs` s'ajoutent à `ux-flows` et `session`.

## Non repris

- `apps/api/apps/identity/tests.py` : les correctifs réparent le même test OAuth, mais la 1.10 le fait déjà et ajoute un second test (« sans récupération → étape sécurité »). Version 1.10 conservée.

## Changement de comportement à connaître

L'API **refuse désormais toute demande d'accès professionnelle sans `qr_token`** et ne renvoie plus `patient_id` au professionnel. Le front fusionné est aligné ; un client ou un script externe qui envoie `patient_id` seul recevra une erreur 400.

## Vérifications

- Web : 59 tests passent (49 de la 1.10 fusion + 6 `emergency-card` + 4 `fusion-correctifs` qui verrouillent les parties 1.10 conservées).
- API : syntaxe Python vérifiée sur tous les fichiers touchés ; cohérence statique (appelants, migration, sérialiseurs, plus aucun POST `patient_id` vers les accès).
- **Non vérifié** : les tests Django (Django non installé ici ; les « 169 tests » du changelog des correctifs ont été mesurés sur leur base, pas sur cette fusion), `makemigrations --check`, `next build`, `tsc`, ESLint, la concurrence du QR sur PostgreSQL, le rendu navigateur.

## Au déploiement

1. Appliquer `python manage.py migrate` (patients.0007) **avant** de déployer le front.
2. Planifier chaque jour `python manage.py cleanup_access_qr_tokens`.
3. Variables optionnelles : `ECARNET_RATE_QR_CREATE` (30/h), `ECARNET_RATE_EMERGENCY_CARD` (120/h).
