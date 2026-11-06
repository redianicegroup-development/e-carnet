> **Référence d’état auditée le 05/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`../ETAT-REEL-PROJET-2026-11-05.md`](../ETAT-REEL-PROJET-2026-11-05.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# Comprendre C3, C4 et C5

## C3 — contre-référence B vers A

C3 serait le retour d’un établissement B vers l’établissement A après la prise en charge du patient. Exemple : B ajoute un compte rendu ou une recommandation à destination de A.

Ce parcours implique une copie clinique conservée chez B, des corrections par addenda, une provenance, des droits d’effacement et de rectification, ainsi qu’une téléexpertise éventuelle. C’est donc un chantier futur, pas une simple route supplémentaire. Il ne faut pas le coder avant de connaître la durée de conservation, le responsable de la copie, la procédure de correction, le traitement d’une demande d’effacement et le contrat entre établissements.

## C4 — ce qui est interdit

C4 n’est pas une décision à choisir : ce sont les limites du produit. Il ne faut pas coder un accès d’urgence « bris de glace » sans décision médicale, juridique et sécurité distincte. Il ne faut pas permettre à B de rechercher librement des patients. Il ne faut pas donner à l’administrateur de B le contenu clinique provenant d’une autre structure.

## C5 — les cinq décisions

| Question | Choix recommandé / état actuel |
|---|---|
| B lit-il un dossier vivant ou une preuve figée ? | Pour C1, snapshot figé. B lit exactement ce que le patient a autorisé au moment du partage. |
| B peut-il conserver une copie après expiration ? | Non en V1. Après expiration ou révocation, les lectures futures sont bloquées. |
| L’administrateur B lit-il le contenu reçu ? | Non par défaut. Il peut voir l’inbox sans contenu ; la lecture clinique reste réservée au professionnel actif. |
| Qui peut adresser depuis A ? | Un professionnel actif de A qui possède réellement un soin avec ce patient. Pas l’administrateur. |
| Et si le patient ne peut pas consentir ? | Pour un enfant, le représentant utilise le mécanisme de représentation légale. Pour un adulte inconscient, aucun accès inter-établissements implicite : seule la carte d’urgence reste dans son périmètre propre. |

C2 applique déjà le choix « pas de copie conservée » : le professionnel lit pendant la durée du grant les soins des structures sources choisies, sans verser une copie dans son établissement. Avant C3, il faudra décider si le produit reste en lecture directe ou s’il crée un snapshot versionné ; le choix recommandé est le snapshot versionné pour préserver une preuve claire du consentement.

## Ce qui doit être validé avant C3

La validation doit couvrir la base légale, les rôles de responsable de traitement, la durée de conservation, les addenda, l’effacement, les exports, la révocation, la notification au patient et le traitement des urgences. Sans ces réponses, le bon choix est de laisser C3 désactivé et de ne pas élargir C4.
