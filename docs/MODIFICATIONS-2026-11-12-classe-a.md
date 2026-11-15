# Modifications du 12/11/2026 — Classe A du plan (PAT-19, PRO-15, PAT-09, PRO-16, PAT-20)

Archive complète : e-carnet_V1_11.zip (V1.10 + ces changements). Version `1.7.0` (racine et `@ecarnet/web`).

**Non touché, comme demandé : B4 (PRO-21).** Non démarrés, car le plan exige une décision écrite avant tout code : ACS-13, PAT-24 et PRO-20 (avis juridique, comité éditorial, pilote pharmacie). Données fictives uniquement (`REAL_HEALTH_DATA_ALLOWED=false` inchangé).

Règles du plan respectées : toute lecture clinique passe par `require_scope()` (aucune nouvelle lecture clinique n'a été ajoutée) ; aucun identifiant patient dans les listes du professionnel hors accès actif ; aucune recherche globale de patients ; les nouveaux réglages sont désactivés par défaut.

## PAT-19 — Récapitulatif des accès (patient)

- **Paramètres › Récapitulatif des accès** : Désactivé (par défaut), Chaque semaine, Chaque mois. Le choix s'enregistre au clic ; le dernier envoi s'affiche.
- Le résumé arrive dans les **notifications** de l'application (et sur l'appareil si le patient a activé les notifications), avec le nombre d'accès **par type de structure**. Il ne contient ni nom de professionnel ni information médicale.
- **Correction d'un défaut trouvé par les nouveaux tests** : une fréquence envoyée sous forme de liste (`["weekly"]`) provoquait une erreur 500 ; elle répond maintenant 400.
- **À planifier** : `python manage.py send_access_summaries`, une fois par jour (ajouté à `docs/DEPLOYMENT.md`). Sans cette tâche, l'option s'affiche mais rien n'est envoyé.
- Fichiers : `lib/access-summary.ts`, `components/PatientAccessSummarySettings.tsx` (+ `.css`), `AccountSettingsClient.tsx`, `care/views.py`. API : +5 tests (`patients/test_access_summaries.py`).

## PRO-15 — Patients reçus récemment (professionnel)

- Nouveau bloc **« Patients reçus récemment »** en haut de **Patients** (derrière la porte clinique) : 20 patients au plus, des 30 derniers jours, prénom + nom + date du dernier accès + date de sortie de la liste. Recherche locale au-delà de 5 lignes.
- **Aucun accès au carnet** : pas d'identifiant, pas d'état, pas de donnée médicale. L'unique action est **« Nouvelle demande par QR »** (#scanner) ; un accès terminé ne se rouvre jamais, le patient doit autoriser de nouveau.
- Côté API, la réponse n'est plus mise en cache par le navigateur (`private, no-store`, auparavant 24 h). +8 tests (professionnel sans établissement actif, sans rattachement, sans contexte, compte patient, accès révoqué ou en attente, consultation de plus de 30 jours, tri, absence de cache). 13 tests au total dans `care/test_recent_patients.py`.
- Fichiers : `lib/recent-patients.ts`, `components/ProfessionalRecentPatients.tsx` (+ `recent-patients.css`), `app/professionnel/patients/page.tsx`.

## PAT-09 — Export du carnet par période et par rubrique (patient)

- **Paramètres communs au PDF et à Excel** : période (du / au) et 7 rubriques (allergies et déclarations, vaccinations, mesures, consultations, ordonnances, examens, documents). Le serveur filtre les deux formats par la même fonction.
- Correction : le bouton PDF **ignorait la période** ; il la reçoit maintenant. La case « J'ai compris » (fichier non chiffré) bloque les deux boutons ; une période invalide ou aucune rubrique cochée désactive le téléchargement.
- Toutes les rubriques cochées = export complet (le classeur y ajoute rappels, prises et rendez-vous). La rubrique « Allergies et déclarations » reprend toutes les déclarations du patient (antécédents compris), car il n'existe pas de modèle « allergie » séparé.
- Journal d'audit : format, période, rubriques — jamais le contenu. Réponse `private, no-store`.
- Fichiers : `lib/carnet-export.ts`, `components/PatientCarnetExport.tsx` (+ `carnet-export.css`) ; API : `care/export_filters.py`, `export_pdf.py`, `export_xlsx.py`, `test_carnet_export_filters.py` (40 tests d'export).

## PRO-16 — Recherche et filtres dans les listes autorisées (professionnel)

- Barre commune `ListSearchBar` : recherche insensible aux accents et à la casse (« Hélène » = « helene »), tous les mots dans n'importe quel ordre, raccourci **/** sur grand écran (jamais pendant une saisie), **Échap** pour effacer, nombre de résultats annoncé aux lecteurs d'écran, bouton « Effacer les filtres ».
- Appliquée à : **Mes consultations** (période, établissement), **Rendez-vous à venir** (état, établissement), **adressages reçus** (état, établissement), **patients récents**.
- **Aucun appel réseau** : on ne filtre que des lignes déjà chargées. Il n'existe toujours pas de recherche globale de patients (un test le vérifie).
- Fichiers : `lib/list-filter.ts`, `components/list/ListSearchBar.tsx`, `useListFilter.ts`, `list-search.css`.

## PAT-20 — Économie de données et pictogrammes (patient)

- **Paramètres › Économie de données** : Automatique / Toujours / Jamais. Le choix reste dans le navigateur (déclaré dans la politique de confidentialité).
- **Décision retenue (à confirmer)** : en Automatique, le mode s'active si le navigateur demande d'économiser les données (Save-Data) ou annonce un réseau 3G ou plus lent. Safari et Firefox n'annoncent rien : le mode ne s'y active pas tout seul.
- Quand il est actif : bandeau « Mode économie de données activé » avec la raison ; photos des documents et des vaccinations réduites à 1 024 px / qualité 0,7 (mode normal inchangé : 1 800 px / 0,8) ; **courbes de constantes chargées à la demande** (la bibliothèque de graphiques n'est téléchargée qu'à l'affichage) ; polices du téléphone au lieu des polices web ; animations coupées.
- **Aucune fonction de sécurité touchée** : consentement, connexion, QR, accès et audit ne lisent pas le mode (un test le vérifie).
- **13 pictogrammes** en SVG intégré avec texte alternatif (fièvre, toux, respiration, tête, ventre, cœur, médicament, vaccin, glycémie, tension, poids, rendez-vous, urgence) : sur les symptômes de la pré-consultation (patient et médecin) et sur le choix de la mesure. Ils accompagnent le texte sans le remplacer ; un symptôme sans dessin adapté n'en a pas.
- Fichiers : `lib/data-saver.ts`, `lib/pictograms.ts`, `components/data-saver/*`, `components/ui/Pictogram.tsx`, `HealthMeasurements.tsx`, `MedicalDocuments.tsx`, `Vaccinations.tsx`, `app/patient/layout.tsx`.

## Tests et vérifications

- Web : **458 tests, 451 verts**. Nouveau fichier `tests/classe-a-2026-11-12.test.mjs` (23 tests). Mis à jour : `legal.test.mjs` (stockage navigateur déclaré), `historique-acces-2026-11-08.test.mjs` (nouveau filtre de recherche).
- Les 7 échecs restants ne viennent pas de ces changements : « un seul centre d'aide » et 2 tests de la page hors connexion (déjà présents en V1.9) ; 4 tests « copie chiffrée » qui échouent depuis le 12/11 parce que leur jeu d'essai est daté du 05/11/2026 (7 jours de validité de la copie) — ils repassent tous si l'horloge est figée au 05/11. À corriger en leur faisant passer la date de référence.
- API : `apps.care`, `apps.patients`, `apps.professionals`, `apps.identity` et `tests` : **571 tests verts** (3 ignorés). `apps.establishments` non relancée (non modifiée ; échec connu d'un test sur 102, voir la note du 11/11).
- `tsc --noEmit` propre ; lint : aucune erreur dans les fichiers modifiés. `next build` non lancé ici : à lancer avant déploiement. Aucun essai sur appareil réel ni réseau lent réel (PAT-21 reste à faire).

## Décisions encore ouvertes (plan, partie D)

1. **PAT-19** : le plan proposait « hebdomadaire » par défaut ; j'ai gardé **désactivé** (opt-in). Canal : notification dans l'application, pas d'e-mail.
2. **PAT-20** : seuil (3G, Save-Data) et public concerné à valider ; essais faible débit à faire sur appareils réels.
3. **Textes légaux** : la ligne « Économie de données (localStorage) » de la politique de confidentialité est à faire relire.
4. **ACS-13, PAT-24, PRO-20** : en attente des décisions écrites ; **PRO-21** laissé de côté.
