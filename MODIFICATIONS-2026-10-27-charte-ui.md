# Modifications du 27/10/2026 — charte graphique, accueils, onglets, KPI établissement, onboarding, admin

Base : e-carnet-4.zip. Tests : 199 réussis, 6 en échec déjà présents avant les modifications (aide, rattachement médecin, QR visite, schémas, stockage local, cache de thème), sans lien avec ces changements. Le projet n'a pas pu être compilé ici (pas de node_modules) : la syntaxe de chaque .tsx modifié a été vérifiée, pas le typage complet ; les graphiques Recharts n'ont pas été affichés.

Non modifiés volontairement : landing, logo, SVG d'inscription et connexion, goo.css, soft-skin.css, barre de navigation gooey.

## Fichiers

- MODIFIÉ   apps/web/src/app/admin/page.tsx
- MODIFIÉ   apps/web/src/app/layout.tsx
- MODIFIÉ   apps/web/src/components/AdminActivityCharts.tsx
- MODIFIÉ   apps/web/src/components/EstablishmentConsole.tsx
- MODIFIÉ   apps/web/src/components/PatientHome.tsx
- MODIFIÉ   apps/web/src/components/ProfessionalHome.tsx
- MODIFIÉ   apps/web/src/components/RoleDashboards.tsx
- MODIFIÉ   apps/web/src/components/admin-recovery.css
- MODIFIÉ   apps/web/src/components/onboarding/OnboardingChrome.tsx
- MODIFIÉ   docs/prototypes/tokens.css
- MODIFIÉ   packages/ui/src/styles/tokens.css
- NOUVEAU  apps/web/src/app/admin-skin.css
- NOUVEAU  apps/web/src/app/mobile-skin.css
- NOUVEAU  apps/web/src/app/pages-skin.css
- NOUVEAU  apps/web/src/components/EstablishmentKpis.tsx
- NOUVEAU  apps/web/src/components/onboarding/OnboardingProgress.tsx
- NOUVEAU  apps/web/src/components/ui/TileGrid.tsx
- NOUVEAU  docs/prototypes/CHARTE-APERCU.html
- NOUVEAU  docs/prototypes/CHARTE-GRAPHIQUE.md

Détail et usage : docs/prototypes/CHARTE-GRAPHIQUE.md (aperçu : docs/prototypes/CHARTE-APERCU.html).

## Web Push (ecarnet-webpush-corrige.zip)

Fusionné par-dessus ce projet : aucun fichier en commun avec les modifications ci-dessus (23 fichiers de l'overlay, dont 2 lignes dans `AccountSettingsClient.tsx`). Tests web inchangés (199 réussis, mêmes 6 échecs). Python compilé sans erreur ; la migration 0021 dépend bien de la 0020 existante. Non exécutés ici : tests Django, `makemigrations --check`, build Next, k6, test sur un vrai appareil. `pywebpush` n'est pas encore dans `apps/api/requirements.txt` : lancer `make lock`. Sans clés VAPID, le push reste désactivé.
