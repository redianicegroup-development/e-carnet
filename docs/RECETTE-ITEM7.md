# Recette — point 7 et PWA établissement privé

Date : 2026-10-05 — compte rendu historique du test ciblé.

> Le test concurrent SQLite ignoré dans cette exécution a depuis été couvert sur PostgreSQL 16 local. Ne pas interpréter ce résultat isolé comme l’état actuel ; voir la [recette V1](RECETTE-V1.md) et le [rapport PostgreSQL du 08/10](../reports/postgres-tests-20261008.txt).

## Résultat local

Commande exécutée :

```bash
python3 manage.py check
python3 manage.py makemigrations --check --dry-run
python3 manage.py test apps.establishments.test_item7 apps.establishments.test_join_codes apps.establishments.test_private_admin -v 1
```

Résultat : **11 tests exécutés, 10 réussis, 1 ignoré explicitement**.

Le test ignoré est la course inter-connexions de deux consommations simultanées. Le backend local est SQLite en mémoire : chaque thread reçoit une connexion isolée et ne voit pas la même base de test. Le test est activé automatiquement sous PostgreSQL, qui est le backend cible de production et permet de valider `select_for_update()`.

## Couverture

- expiration d’un code après 48 heures ;
- rejeu d’un code consommé ;
- consommation concurrente : une seule réussite sous PostgreSQL ;
- refus d’une demande et conservation de son état ;
- remplacement d’administrateur avec historique ;
- isolation des administrateurs entre établissements ;
- isolation clinique par établissement actif ;
- conservation des événements de création, consommation, demande et décision ;
- absence de secret brut dans l’audit ;
- activation d’une demande uniquement après approbation établissement.

## PWA

Le dépôt possède déjà un PWA global :

- `apps/web/public/manifest.webmanifest` ;
- `apps/web/public/sw.js` ;
- enregistrement dans `PwaRegister` ;
- scope `/`.

L’espace établissement privé est donc correctement servi par le même PWA à la route :

```text
/etablissement/gestion
```

Une seconde application PWA n’est **pas nécessaire** : elle dupliquerait le manifest, le service worker, la navigation et le cycle de déploiement sans apporter de séparation de sécurité. La sécurité est déjà portée par les permissions API et la relation administrateur–établissement. Un second PWA ne serait pertinent que pour un déploiement, un domaine, une équipe ou un cycle de mise à jour réellement distinct.
