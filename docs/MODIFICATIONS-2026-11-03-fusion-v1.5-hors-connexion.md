> **Référence d’état auditée le 06/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`docs/ETAT-REEL-PROJET-2026-11-06.md`](ETAT-REEL-PROJET-2026-11-06.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# Fusion du 03/11/2026 — v1.5 (captures d'écran) + hors connexion (02/11/2026)

Base commune : `e-carnet_v1_4-final.zip`. Cette archive contient **tous les fichiers modifiés ou ajoutés par rapport à v1.4-final** (51 fichiers de code + 2 notes). Décompresser par-dessus la racine du projet.

## Ce qui est fusionné
- **v1.5** (`MODIFICATIONS-2026-11-03-v1.5.md`, jointe telle quelle) : bandeau « Carte virtuelle » retiré, « Partager en QR » vers Consultations, texte de la visite guidée, navigation admin sur deux lignes, aide à la récupération de compte sans exposer le secret, débordements corrigés.
- **Hors connexion** (02/11/2026, `docs/PWA-HORS-CONNEXION.md`) : copie des déclarations en lecture seule, copies de carte d'urgence qui expirent vraiment, service worker v4, désabonnement push à la déconnexion, textes d'information.

## Fichiers modifiés des deux côtés (fusion à trois voies, 0 conflit)
| Fichier | Apport v1.5 | Apport hors connexion |
|---|---|---|
| `apps/web/src/app/admin/page.tsx` | icônes « Journal » (horloge) et « Transferts » (partage) | `cleanUpBeforeLogout()` avant la déconnexion |
| `apps/web/src/components/AccountSettingsClient.tsx` | bandeau « Carte virtuelle » retiré | rubrique « Hors connexion » + `cleanUpBeforeLogout()` |
| `apps/web/src/components/ProfessionalSettingsClient.tsx` | bandeau « Carte virtuelle » retiré | `cleanUpBeforeLogout()` |

Tous les autres fichiers ne viennent que d'un côté (copiés tels quels).

## Vérifications sur l'arbre fusionné
- Web : `tsc --noEmit` sans erreur ; ESLint 0 erreur ; 270 tests, 266 réussis. Les 4 échecs (aide `/faq`, médecin sans rattachement, QR de visite, schémas) existaient déjà dans v1.4-final ; aucun nouvel échec. (Le test « seul stockage local » échouait dans v1.4-final : corrigé par le travail hors connexion.)
- API : `manage.py test apps.identity` → 182 tests OK (dont les 7 de l'aide à la récupération), avec les variables de la CI (`DJANGO_DEBUG=true`, etc.).
- Non vérifié : `next build` (polices Google inaccessibles dans l'environnement de test), essais sur téléphones réels.

## À savoir (constats, pas modifiés ici)
1. **`.gitignore` ligne 62 : `globals.css`.** Ce fichier est la feuille de style principale (modifié en v1.5). Tant que la ligne est là, un `git add .` ne l'ajoute pas et un déploiement depuis Git peut partir sans elle. À supprimer de `.gitignore` (`Footer.tsx`, ligne 61, est dans le même cas).
2. **`makemigrations --check` échoue déjà sur v1.4-final** (la CI le lance, `ci.yml` ligne 43) : le champ `objective` de `FollowUpPlan` (`apps/care`) est modifié sans migration (proposée : `0025_alter_followupplan_objective`). Aucune des deux séries de changements n'y touche.
3. L'archive v1.4-final contient `apps/api/.env` et `db.sqlite3` : à retirer du dépôt (déjà signalé au CDC, § 1 écart 7). Ils ne sont pas dans cette archive.
4. Le CDC v13 et le reste-à-faire (archives du 02/11) ne décrivent pas encore les changements v1.5 (aide à la récupération, nouvelles routes `admin/recovery/...`).
