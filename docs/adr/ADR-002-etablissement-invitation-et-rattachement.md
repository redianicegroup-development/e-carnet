# ADR-002 — Accès privé établissement par invitation nominative et rattachement médecin

- **Date :** 2026-10-05
- **Statut :** accepté selon les réponses du porteur
- **Remplace :** les propositions de Root global, d’inscription publique établissement, de justificatifs professionnels téléversés sur E‑Carnet et de code permanent
- **Spécification :** [Flow établissement et rattachement médecin](../FLOW-ETABLISSEMENT.md)

## Contexte

La V1 actuelle laisse un établissement soumettre une fiche via l’application, crée un contexte établissement au demandeur et génère un code durable côté startup. Le créateur du compte devient de fait administrateur et l’approbation d’un médecin vérifie en plus un statut professionnel global. Ce mécanisme ne représente pas le processus opérationnel voulu et met des décisions de structure/médecin dans un flow public.

## Décision

1. L’établissement transmet les justificatifs de la structure à l’équipe E‑Carnet par l’adresse e-mail officielle. Il n’y a pas d’inscription publique ni de dépôt de justificatifs sur la landing page.
2. Un administrateur E‑Carnet authentifié vérifie les pièces hors application et, seulement après validation, crée l’entité établissement et un accès nominatif à son responsable principal.
3. L’entité établissement est distincte de son administrateur. Un seul administrateur principal actif par établissement en V1; l’administrateur peut être remplacé sans recréer l’établissement. Aucun identifiant partagé. Plusieurs administrateurs peuvent être envisagés plus tard, pas activés en V1.
4. L’activation du compte passe par une invitation unique valable 48 heures. Le responsable définit son mot de passe; aucun mot de passe temporaire n’est envoyé. L’invitation est invalidée après consommation/expiration.
5. L’établissement vérifie le médecin en interne. E‑Carnet ne collecte pas ses justificatifs personnels. L’administrateur génère un code médecin aléatoire, à usage unique, valable 48 heures; le code permet seulement au compte Professionnel existant de créer une demande `pending`.
6. L’administrateur établissement accepte ou refuse cette demande. Une acceptation crée le rattachement actif; elle ne donne pas accès à un dossier patient. La validation du rattachement devient la preuve institutionnelle au niveau de cette structure; l’AccessGrant et le consentement du patient restent des contrôles séparés.
7. Les structures, invitations, codes, décisions et affiliations conservent une trace append-only. Une fin d’accès se fait par révocation/suspension et non par suppression de l’historique.
8. L’espace établissement est privé. L’administrateur actif consulte les dossiers associés à sa structure; le professionnel ne consulte que le dossier de son cas attribué, avec l’autorisation patient active. Aucun accès automatique aux données d’un autre établissement.

## Alternatives écartées

- **Compte établissement auto-créé depuis la landing :** rejeté, car il permettrait à un acteur non vérifié d’ouvrir un espace privilégié.
- **Compte/mot de passe partagé par clinique :** rejeté, car l’identité et la responsabilité de l’administrateur deviendraient indémontrables.
- **Mot de passe temporaire envoyé par e-mail :** rejeté; lien à usage unique et définition du secret par son destinataire sont préférés.
- **Code médecin permanent ou rattachement activé à sa saisie :** rejetés; un code de 48 h ouvre une demande, ensuite approuvée par l’établissement.
- **Dépôt de pièces professionnelles du médecin dans E‑Carnet :** rejeté pour le flow V1; cette vérification reste interne à l’établissement.
- **Accès aux dossiers pour administrateur établissement :** rejeté; le périmètre établissement est administratif, le périmètre clinique est individuel/professionnel avec consentement patient.
- **Rôle global nommé `root` :** non retenu; l’appellation produit est « administrateur établissement ».

## État livré le 08/10/2026

- Le profil médecin ne demande plus d’identifiant professionnel et l’API ne le retourne plus; les champs legacy de base ne sont pas supprimés automatiquement afin d’éviter une perte silencieuse de données en production. La spécialité est déclarative et sélectionnable; une option « Autre » ajoutée devient réutilisable.
- Les endpoints et l’interface de revue individuelle E‑Carnet sont retirés. L’établissement effectue le contrôle interne; l’application journalise la décision d’adhésion/rattachement.
- `CareEncounter` est lié à l’établissement destinataire. L’API clinique filtre sur le même établissement que le grant et la validation d’une consultation recontrôle la même provenance. Les données historiques sans site restent inaccessibles au médecin.
- Les transitions patient du grant utilisent transaction + verrou `select_for_update`; le test de concurrence PostgreSQL vérifie que la révocation n’est jamais perdue.
- Les lectures cliniques sont tracées dans l’audit patient, sans stocker de texte médical dans les métadonnées. La protection contre `TRUNCATE` reste à réaliser.

## Conséquences et impact sur le code

> **Plan initial du 05/10 — supersédé.** Les actions de modélisation et de développement listées ci-dessous ont été réalisées pour le flow V1 ; se reporter à « État livré le 08/10 » pour le code présent et aux gates de recette actuels.

- Modèle actuel à corriger : `Establishment.created_by` ne peut plus constituer l’unique relation d’autorité; ajouter une association administrateur nominative, historisée, et permettre un remplacement sans recréer la structure.
- Remplacer le code d’établissement stable par une entité `EstablishmentJoinCode` avec hash, expiration, état et consommation atomique; une saisie crée une demande en attente.
- Ajouter invitation d’activation `EstablishmentAdminInvitation`, token hashé, date d’expiration 48 h, consommation/révocation et e-mail d’envoi.
- Séparer console startup et espace établissement, avec permissions côté API et audit de toutes les transitions.
- Formulaire API public de demande établissement neutralisé; l’onboarding médecin n’exige pas de justificatif personnel. Vérifier la recette staging et la rétention des éventuelles données historiques.
- Garde global de vérification E‑Carnet retiré du parcours : l’établissement vérifie le médecin en interne et sa décision de rattachement est journalisée. Conserver contexte professionnel, membership actif, établissement actif, AccessGrant et consentement patient.
- Conserver les états refusés/suspendus, les anciens administrateurs, codes et invitations consommés/expirés dans l’historique; ne pas écrire tokens ni mots de passe dans les événements.
- Définir le transport d’e-mail, la politique de conservation des justificatifs envoyés à la boîte officielle, l’expiration des liens et la gestion du changement d’administrateur avant recette réelle.

## Critères d’acceptation

- Un utilisateur anonyme ne peut ni créer ni obtenir un compte établissement.
- Seul un staff autorisé peut valider une structure et déclencher la création/invitation.
- Invitation invalidée après un usage; refusée après 48 h; le mot de passe est défini par le destinataire et n’apparaît dans aucun e-mail.
- Le code médecin expire après 48 h, est consommé atomiquement une seule fois et ne crée qu’une demande `pending`.
- Un médecin n’accède pas à la structure tant que son rattachement est refusé ou en attente; un rattachement accepté reste attribué à cette structure.
- Changer l’administrateur ne change ni ne supprime l’entité établissement ou son historique.
- L’espace établissement ne peut jamais appeler ou contourner les routes de lecture clinique; ces routes exigent toujours le professionnel et le consentement patient.
