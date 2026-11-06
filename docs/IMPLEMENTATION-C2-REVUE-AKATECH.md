> **Référence d’état auditée le 06/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`../ETAT-REEL-PROJET-2026-11-06.md`](ETAT-REEL-PROJET-2026-11-06.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# C2 — Accès à l’historique par QR

## Livraison

C2 réutilise le QR patient et les `AccessGrant` existants avec une portée dédiée `care_history`, distincte de `consultations`.

Le QR patient retourne les structures actives qui possèdent des soins validés partageables. Une demande professionnelle peut demander `care_history` et transmettre une liste de structures sources. Le patient confirme ensuite un sous-ensemble de ces sources lors de l’acceptation. Le serveur refuse toute structure qui ne possède pas un soin validé du patient ou qui n’a pas été proposée.

Après acceptation du grant par le patient, le professionnel rattaché à l’établissement B peut lire :

```text
GET /api/v1/patient/care/professional/access-grants/{grant_id}/care-history/
```

La lecture est filtrée par :

- grant actif et non expiré ;
- professionnel et établissement actif correspondant au grant ;
- portée `care_history` accordée ;
- établissement source sélectionné par le patient ;
- établissement source différent de B ;
- soins validés uniquement.

Aucune copie n’est conservée côté B. La réponse est `Cache-Control: no-store`. Chaque lecture produit un audit `clinical_data.read` avec `counterparty_establishment_id` et sans contenu clinique dans les métadonnées.

## Revue AKATECH

### Backend

- séparation explicite de la portée C2 ;
- validation serveur des établissements sources ;
- contrôle d’accès centralisé par `require_scope` ;
- révocation et expiration relues sur chaque requête ;
- aucune recherche libre de patient ;
- migration dédiée `0020_accessgrant_source_establishments` ;
- tests de non-régression care, referrals et délégation.

### Frontend

- contrat TypeScript enrichi avec `source_establishments` ;
- fonction applicative dédiée `listCareHistory` ;
- aucun stockage local de données cliniques ;
- build par route Next.js vérifié ;
- lint sans erreur bloquante ;
- avertissements restants limités aux usages `<img>` historiques du projet.

## Activation

Le parcours reste soumis aux flags de sécurité existants et à la validation juridique avant activation production. La durée du grant reste celle du mécanisme QR : 2 heures, avec au maximum deux prolongations d’une heure.
