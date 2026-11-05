> **Référence d’état auditée le 05/11/2026.** L’état courant du code, des tests et de l’exploitation est centralisé dans [`docs/ETAT-REEL-PROJET-2026-11-05.md`](docs/ETAT-REEL-PROJET-2026-11-05.md). Les documents datés conservent leur valeur historique ; leurs affirmations ne remplacent pas le code ni cette référence. Une fonctionnalité présente dans le dépôt n’est pas pour autant déployée, validée en staging ou autorisée pour des données réelles.

# v1.4 finale — écrans des maquettes et décisions du 31/10

Appliqué sur la fusion v1.1 corrigée + v1.2 + v1.3 + v1.4 (voir `MODIFICATIONS-2026-10-31-v1.4-final.md`).

## Décisions appliquées
- **Accueil patient** (maquette) : « Bonjour, … », titre « Votre carnet, toujours avec vous », boutons *Mon carnet* et *Partager en QR*, prochaine consultation (rendez-vous à venir) et « Aujourd'hui » (prises et rendez-vous du jour) seulement quand quelque chose est prévu. **Retirés** : la grille « Mon carnet » (Allergies, Diagnostics…), la ligne « Préparez votre prochaine consultation » (comprendre le mal est le travail du médecin ou de l'infirmier). Les autres éléments de « À faire » (demandes d'accès, profil, notifications) restent quand ils existent.
- **Accueil professionnel** (maquette) : « Votre journée, en un coup d'œil », boutons *Un patient* et *Scanner un QR* (ouvre directement la caméra), « Aujourd'hui » avec lien *Agenda*. **Retirée** : la grille « Mon activité ».
- **Plus de bouton jaune central** dans les navigations mobile et PC (patient et professionnel).
- **Dossier patient et dossier médecin** toujours ouverts : rubriques l'une sous l'autre (`DossierCard`, prop `sections`), plus de tuiles pliables ni de grille. La tuile « Ma carte virtuelle » est **carrée** (une tuile seule dans sa grille ne s'étire plus).
- **Consultations / Historique** : l'onglet Consultations ne garde que le parcours (étape 1 pré-consultation, étape 2 accès temporaire). Tout l'historique est dans **Historique → Mes consultations** : cartes à bandeau avec filtres *Toutes, À venir, Passées, Pré-consult.*, kv (Type, Médecin, Statut), bouton **Ouvrir le sceau** (qui a validé, où, quand, référence), compte rendu complet sous « Voir le compte rendu ».
- **Connexion / création de compte** : les boutons Google, Facebook et Apple se partagent la largeur ; Google seul occupe toute la ligne, à trois ils restent sur la même ligne.
- **Hors connexion** : l'écran vu sur le téléphone n'était pas celui de l'application mais celui de Chrome (l'app ne mettait volontairement aucune page privée en cache). Désormais l'app affiche sa propre page (`public/hors-connexion.html`) qui explique la situation et propose « Réessayer », sans mettre aucune page privée en cache. **La navigation hors connexion complète n'est pas implémentée** : elle demanderait de garder des données de santé sur l'appareil (chiffrées, effacées à la déconnexion). Décision à prendre.

## Nouveaux écrans
- Agenda patient `/patient/agenda` (7 ou 30 jours : prises selon les jours choisis, rendez-vous) et agenda professionnel `/professionnel/agenda` (14 derniers jours de consultations validées). Les rendez-vous pris par les patients ne figurent pas encore chez le professionnel (non rattachés).
- Logique de l'agenda dans `src/lib/agenda.ts`, testée (`tests/agenda-2026-10-31.test.mjs`).

## Vérification
Tests web : 229 tests, 223 réussis, 6 en échec : les mêmes 6 qu'avant (aide, rattachement médecin, QR visite, schémas, stockage local, cache de thème). Les tests qui encodaient les décisions remplacées (bouton central, tuiles pliables du dossier, préparation de consultation) ont été réécrits ; nouveaux tests dans `tests/maquettes-2026-10-31.test.mjs`. Syntaxe de tous les fichiers TypeScript, `sw.js` et Python vérifiés. **Non vérifiés ici** : rendu à l'écran sur téléphone, `next build`, ESLint, tests Django, essai hors connexion réel du service worker.
