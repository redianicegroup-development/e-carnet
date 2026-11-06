> **Référence d’état auditée le 05/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`../ETAT-REEL-PROJET-2026-11-05.md`](../ETAT-REEL-PROJET-2026-11-05.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# Chantier B — Proche de confiance

## Livraison de cette itération

Le flux est implémenté derrière `ECARNET_TRUSTED_CONTACTS_ENABLED` (désactivé par défaut). Le patient saisit l’e-mail du proche comme repère, génère un mot de rattachement temporaire et le remet directement au proche. Le proche utilise son propre compte et son propre profil patient, saisit ce mot, puis le lien est créé. Aucun SMS, e-mail OTP ou service externe n’est requis.

Le mot est conservé uniquement sous forme d’empreinte SHA-256, expire après 72 heures et est consommable une seule fois. La réponse de génération l’affiche une seule fois au patient ; elle n’est ni envoyée ni recopiée dans l’audit. Le modèle `TrustedContactDelegation` reste séparé de `PatientRepresentation`.

Le flux comprend également le choix d’une durée de 30, 90 ou 365 jours, une limite de trois délégations actives par patient, la sélection d’un carnet délégué en session, et une révocation/expiration relue en base à chaque requête.

Le refus par défaut est appliqué dans `profile_for` pour toutes les lectures et écritures hors portée. Seule la lecture GET de la fiche d’urgence (`emergency_card`) est autorisée. Le QR, les réglages de carte, déclarations, consultations, documents, exports et autres écritures ne sont pas exposés au proche. Chaque accès est audité sans contenu médical et une notification patient est coalescée à la première lecture quotidienne.

L’interface est disponible dans Paramètres et sur `/patient/proches`, avec génération du mot, saisie du mot reçu, retrait d’accès et ouverture du carnet en lecture seule.

## Vérifications

- `apps.patients.test_delegations` : 3 tests réussis.
- `makemigrations --check --dry-run` et `manage.py check` : réussis.
- lint frontend : 0 erreur, avertissements `<img>` préexistants.
- build Next.js : réussi.

La suite historique `apps.patients` conserve un échec préexistant sur `test_record_views_requires_authentication` (attendu 401, DRF renvoie 403) ; il ne concerne pas le chantier B.

## B3 — garde-fous d’accès

La sélection ne change pas globalement les droits du compte. `profile_for` reconnaît `active_delegation_id`, vérifie le statut et l’expiration en base, refuse les méthodes d’écriture et exige explicitement la portée `emergency_card`. La révocation du patient bloque donc la requête suivante du proche. Le proche n’est jamais présenté comme représentant légal et ne reçoit pas d’accès clinique professionnel.

## Activation

Conserver `ECARNET_TRUSTED_CONTACTS_ENABLED=false` jusqu’à validation juridique du consentement, du périmètre fiche d’urgence et du parcours de secours en cas de perte de téléphone ou d’accident. Utiliser uniquement des comptes et mots fictifs pendant la recette.
