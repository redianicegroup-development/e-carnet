# Référence actuelle du projet

Dernière revue documentaire : **08/10/2026**. Ce fichier est un repère pour les prochaines interventions, pas une spécification métier.

## Ordre de référence

1. Le code et les tests présents définissent ce qui est implémenté.
2. [État réel V1](docs/ETAT-REEL-V1.md) résume les faits vérifiés et leurs limites.
3. [Roadmap V1–V5](docs/ROADMAP-V1-V5.md) porte les décisions produit actives.
4. [Matrice de recette](docs/RECETTE-V1.md) et [preuves PostgreSQL](reports/postgres-tests-20261008.txt) décrivent les tests exécutés.
5. Les audits, plans et recettes datés antérieurs sont historiques. Ne pas reprendre leurs tâches « à faire » ou décisions remplacées sans les comparer à l’état réel.

## État succinct

- V1 toujours en construction : **pas de données de santé réelles** et verdict **NO-GO pour staging/production**.
- PostgreSQL 16 local : 77 tests réussis le 08/10. Sauvegarde/restauration isolée locale vérifiée ; RPO/RTO opérationnel et sauvegardes managées non prouvés.
- Les décisions A9 (QR 5 min et scopes) sont appliquées. Le QR professionnel requiert encore l’UUID patient manuellement.
- Invitation établissement SMTP configurable ; jeton brut absent des réponses API.
- Les éléments staging, domaines, fournisseurs OAuth, mobile réel, validations juridiques/médicales et politiques de conservation restent à vérifier.

Avant tout changement fonctionnel, vérifier d’abord les décisions actives et les tests récents ; ne pas réintroduire des comportements d’anciens livrables.