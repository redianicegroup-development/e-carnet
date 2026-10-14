# ADR-003 — L'équipe crée l'accès (nom + e‑mail), l'établissement complète sa fiche

- **Date :** 2026-10-13
- **Statut :** accepté (proposition du porteur, précisée à la revue de la V1.7)
- **Complète :** [ADR-002](ADR-002-etablissement-invitation-et-rattachement.md) · **Spécification :** [Flow établissement](../FLOW-ETABLISSEMENT.md)

## Contexte

La console équipe demandait dix champs (nom, type, ville, adresse, téléphone, e‑mail, nom du responsable en double, e‑mail, prénom et nom du responsable). L'équipe saisissait donc à la place de l'établissement des informations qu'elle ne vérifie pas (adresse, téléphone), avec un risque de fautes et sans moyen de correction : l'API n'exposait la fiche qu'en lecture. La structure était créée « active » aussitôt, donc visible dans le catalogue des médecins avec une fiche vide ou fausse.

## Décision

1. **L'équipe E‑Carnet saisit seulement ce qu'elle a vérifié hors application :** le **nom** de l'établissement et l'**e‑mail** de son responsable (prénom et nom facultatifs), après avoir confirmé que les pièces ont été vérifiées. Un code interne `ETB-XXXXXX` est attribué automatiquement pour distinguer deux structures homonymes.
2. **Le lien d'activation reste envoyé par e‑mail uniquement** (jeton jamais renvoyé par l'API ni affiché). Il est lié à l'adresse vérifiée : c'est la preuve que la bonne personne le reçoit. Un lien transmis par un autre canal serait un jeton « au porteur » : le premier qui l'ouvre deviendrait administrateur.
3. **L'établissement complète sa fiche dans son onboarding** (type, ville, adresse, téléphone, e‑mail de contact), sur `/etablissement/fiche`. Le serveur considère la fiche complète quand ces cinq champs sont renseignés.
4. **Tant que la fiche est incomplète :** la structure n'apparaît pas dans le catalogue des médecins, aucun code de rattachement ne peut être créé (refus serveur, pas seulement masqué) et l'espace redirige vers la fiche.
5. **Champs verrouillés :** le nom et le responsable, vérifiés par l'équipe, ne sont pas modifiables par l'établissement (refus serveur). Toute correction passe par l'équipe.
6. **Un lien d'invitation ne modifie jamais un compte existant.** Si l'adresse invitée a déjà un compte, la personne se connecte avec ce compte puis active l'accès : ni mot de passe écrasé, ni identité modifiée.
7. **Suivi côté équipe :** liste des établissements avec l'état (invitation envoyée, échec d'envoi, expirée, révoquée, fiche à compléter, prête), renvoi et révocation de l'invitation. Un échec d'envoi du courriel ne fait plus échouer la requête : il est journalisé, visible et corrigeable par un renvoi, sans doublon.
8. **Garde‑fous de création :** doublon de nom refusé sauf confirmation explicite, remplacement d'un administrateur actif soumis à confirmation, chaque action confirmée dans l'interface et tracée dans l'audit.

## Conséquences

- Migration `0007` : champs de fiche optionnels à la création, `profile_completed_at`, suivi d'envoi de l'invitation. Les structures déjà complètes sont marquées complètes ; les invitations existantes sont réputées envoyées.
- L'ancien parcours « file d'attente pending → approbation » reste inchangé (hors périmètre V1).
- Les comptes déjà invités avec une adresse ayant un compte doivent désormais se connecter avant d'activer.
- Deux niveaux de droits restent en place : `is_staff` (équipe : vérification des structures) et `is_superuser` (tableau de bord admin).
