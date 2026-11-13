# Modifications du 08/11/2026 — tuiles en cartes + tableau de bord établissement

## Tuiles (patient, professionnel, établissement)
- `patient-sections.css` : la tuile fermée devient une carte (bordure fine, titre centré, icône dans un cercle, description centrée). Tuile ouverte inchangée. Couleurs tirées du thème actif.
- Espace établissement : « Demandes », « Médecins » et les blocs de l'accueil (Ouvertures récentes, Rendez-vous, Codes médecin) passent en tuiles (`section-grid` + `CollapsibleSection`).

## Tableau de bord de l'accueil établissement
- `EstablishmentDashboard.tsx` + `establishment-dashboard.css` : 4 indicateurs, rendez-vous de la semaine, « À faire », demandes récentes, équipe, progression des rattachements (demi-cercle), carte des codes médecin.
- Données : uniquement celles déjà chargées par `EstablishmentConsole` (rattachements, codes, rendez-vous non annulés, ouvertures). Aucun dossier patient.
- `EstablishmentKpis.tsx` : prop `showCards` (défaut `true`) ; l'accueil garde les graphiques détaillés sans doublon, la console staff est inchangée.
- Test : `tests/dashboard-etablissement-2026-11-08.test.mjs`.

## À appliquer
Dézipper par-dessus le projet (chemins relatifs à la racine). Aucune migration ni dépendance ajoutée.
