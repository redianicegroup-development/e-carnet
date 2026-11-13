# 13/11/2026 — PRO-21 fusionné dans la V1_12, espace laboratoire à 3 onglets → V1_13

**Statut : écrit, relu, partiellement vérifié.** Aucun Django ni `node_modules` dans l'environnement de rédaction.
- **Vérifié** : syntaxe Python (`py_compile`) et TypeScript (transpilation), 448 imports Python résolus, chaîne de migrations lue, suite de tests web lancée sur la V1_12 d'origine et sur la V1_13 : **les 10 mêmes échecs, aucun nouveau** (424 tests passent, dont les 10 nouveaux de `tests/laboratoire-espace-2026-11-13.test.mjs`).
- **À exécuter avant tout déploiement** : `python manage.py makemigrations --check`, `python manage.py test apps.care.test_lab_results` (3 nouveaux tests d'historique + 1 d'identité), la suite API complète, `npm run typecheck`, `npm run build`.

Tout reste derrière `ECARNET_LAB_ENABLED` (défaut `false`).

## 1. Fusion de PRO-21 dans ta V1_12
Base : ta V1_12 (classe A, bris de glace). Le zip pro21 reposait sur une base **antérieure au sceau de consultation** : une copie directe l'aurait supprimé. Fusion à trois voies (ancêtre commun v1.11), 4 conflits résolus à la main (`care/models.py`, `care/urls.py`, `config/settings.py`, `ProfessionalConsultations.tsx`) ; le sceau, le bris de glace (ACS-13), les filtres de liste (PRO-16) et le labo coexistent.
- Migration labo renumérotée **`care/0031_pending_consultation_lab_results`**, elle dépend de `0030_emergency_access` (ACS-13). `establishments/0017_establishment_laboratory` inchangée.
- Dans `ProfessionalConsultations.tsx`, « Terminer et signer » garde sa condition d'origine (`!sealReady`) ; tant que la consultation attend des résultats, le bouton n'est simplement pas proposé.

## 2. Espace laboratoire à 3 onglets
- `lib/spaces.ts` : nouvel espace `laboratory` (Scanner `/laboratoire`, Dépôts `/laboratoire/depots`, Moi `/laboratoire/parametres`). Le compte reste un contexte `establishment` côté serveur.
- API : `contexts[].is_laboratory` dans `/identity/me/` (vrai seulement si **tous** les rôles d'administrateur actifs sont des laboratoires).
- `SpaceShell` choisit l'espace : un laboratoire arrivant sur `/etablissement` est envoyé sur `/laboratoire` (sans afficher l'espace établissement entre-temps) ; un compte qui n'est pas un laboratoire n'a pas `/laboratoire`. La fiche à compléter (onboarding) passe avant.
- Visite guidée, routes hors connexion, thème, suivi des visiteurs : espace ajouté partout où les trois autres espaces sont listés.
- `LaboratoryWorkspace.tsx` remplacé par `LaboratoryScanner.tsx` (scan + dépôt + compteur du jour) et `LaboratoryDeposits.tsx` ; « Moi » réutilise `EstablishmentSettingsClient` (nouvelle option `laboratory`, sans ordonnance ni copie hors connexion).

## 3. Onglet Dépôts
- `GET /api/v1/patient/care/laboratory/deposits/` renvoie maintenant `{ items, counts, truncated }`. Filtres facultatifs : `status` (`deposited`, `replaced`, `abandoned`), `from`, `to` (AAAA-MM-JJ). 400 si valeur invalide.
- Statut **abandonné** : examen dont le médecin a renoncé, pour les QR que CE laboratoire avait lus (retrouvés via l'audit `lab_exam_qr.resolved`). Le motif écrit du médecin n'est jamais renvoyé.
- Lignes : examen, type, statut, initiales + année de naissance, heure ; jamais le nom complet ni le contenu du fichier.
- Interface : `ListSearchBar` (PRO-16) pour recherche, statut et période ; regroupement par jour (`lib/lab-history.ts`).

## Décisions du 13/11
- **Pas de techniciens** : un seul compte administrateur par laboratoire.
- **Notification du médecin (push)** : plus tard (il faut des clés VAPID ; aujourd'hui seul le patient est notifié, dans l'application).
- **Valeurs structurées** au lieu du PDF seul : plus tard.
Voir `docs/PLAN-IMPLEMENTATION-A-ET-FUTURS.md` (B4.0 et B4.5).

## Limite connue
- Un laboratoire qui n'a lu aucun QR ne voit pas les examens abandonnés (rien ne le relie à eux) : c'est voulu, par minimisation.
