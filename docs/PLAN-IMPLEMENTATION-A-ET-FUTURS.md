# Mon E-Carnet — Plan d'implémentation : écrans manquants (classe A) et futurs

> Date du plan : 11 novembre 2026 · Base d'origine : code `e-carnet_V1_9` (le code fait foi)
> **Mis à jour le 13 novembre 2026** · Base : `e-carnet_V1_11_1` + lot 1.8 (`e-carnet_V1_12.zip`, version `1.8.0`), puis PRO-21 fusionné et amélioré le même jour (`e-carnet_V1_13.zip`)
> Portée : PAT-19, PRO-15, PAT-09, PRO-16, PAT-20 (classe A), puis ACS-13, PAT-24, PRO-20, PRO-21 (futurs).
> Les statuts ci-dessous viennent de la lecture du code et des notes de livraison. Tests web : exécutés sur la fusion (mêmes 8 échecs d'environnement que la V1_11_1, aucun nouveau). **Tests de l'API du lot 1.8 (ACS-13) : écrits mais non exécutés** (pas de Django dans l'environnement de préparation).

## 0. Règles qui s'appliquent à tout (non négociables)

1. **Toute lecture clinique par un professionnel passe par `require_scope()`** (porte unique). Aucun nouvel endpoint ne contourne cette porte.
2. **Audit en écriture seule** : chaque nouvel endpoint qui lit ou exporte des données appelle `record_event(...)`.
3. **Drapeaux par défaut à `false`** pour tout ce qui est nouveau côté clinique ou inter-établissements. `REAL_HEALTH_DATA_ALLOWED=false` reste vrai (verdict NO-GO, 8 verrous) : on développe et on teste avec des données fictives.
4. **Aucun identifiant patient dans une liste côté professionnel** hors accès actif (principe déjà appliqué par `ProfessionalRecentPatientsView`).
5. **Un test d'API par endpoint modifié**, un test de composant par écran, et le test de non-régression « sans consentement actif → 403 ».
6. Chaque lot se livre derrière une PR séparée, petite, avec son entrée dans le registre `features.js` passée de *Partiel* à *Fait* seulement après revue.

---

## État d'avancement au 13/11/2026

Légende : **Fait** = code livré et testé ; **À moitié** = code livré mais quelque chose empêche de s'en servir ou manque ; **Pas fait** = rien de codé.

| Point | État | Ce qui reste |
|---|---|---|
| A1 PAT-19 — récapitulatif des accès | **À moitié** | Code fait, mais **rien n'est envoyé** tant que `send_access_summaries` n'est pas planifié chaque jour. |
| A2 PRO-15 — patients récents | **Fait** | Rien. |
| A3 PAT-09 — export par période et rubrique | **Fait** | Relecture visuelle d'un PDF réel (accents). |
| A4 PRO-16 — recherche et filtres | **À moitié** | Adressages **envoyés** non couverts ; tests de logique et de structure, pas de rendu. |
| A5 PAT-20 — économie de données et pictogrammes | **À moitié** | Rafraîchissements automatiques non espacés ; préchargement des documents non vérifié ; essais sur appareils réels ; seuil 3g et public à valider. |
| B1 ACS-13 — bris de glace | **À moitié** | Code fait et **désactivé** ; non activable sans les 3 décisions écrites ; tests API à exécuter ; 2 écarts de périmètre à trancher (voir B1). |
| B2 PAT-24 — contenus éducatifs, grossesse, enfant | **Pas fait** | Attend le comité éditorial médical. |
| B3 PRO-20 — ordonnance à QR | **Pas fait** | Attend la pharmacie pilote et le cadre réglementaire. |
| B4 PRO-21 — résultats de laboratoire | **À moitié** | Code livré et **désactivé** (`ECARNET_LAB_ENABLED=false`) ; espace laboratoire à 3 onglets (Scanner, Dépôts, Moi) ; tests API **écrits mais non exécutés** ; laboratoire pilote sous convention à trouver ; notification du médecin et valeurs structurées **plus tard** ; techniciens **écartés** (voir B4.5). |
| Textes légaux (confidentialité) | **À moitié** | Ligne « Économie de données (localStorage) » à faire relire ; décrire le bris de glace avant activation. |

**Hors plan, demandé le 12/11 (fait, lot 1.8)** : Paramètres › Langue : la note « Traduction automatique par Google Translate… » est retirée (la politique de confidentialité et la confirmation avant le premier envoi à Google restent). Paramètres › Partager l'application : le champ du lien et la section « Partager sur » (WhatsApp, Facebook, Telegram, X, LinkedIn, SMS, e-mail) sont retirés ; restent « Partager… » et « Copier le lien ».

**Prochaines étapes recommandées**
0. (PRO-21) Exécuter `python manage.py makemigrations --check` (migrations écrites à la main : `care/0031`, qui suit la `0030` d'ACS-13, et `establishments/0017`) puis `python manage.py test apps.care.test_lab_results` ; trouver un laboratoire pilote sous convention **avant** toute activation du drapeau.
1. Planifier `send_access_summaries` (quotidien) et `review_break_glass_overdue` (horaire, seulement si ACS-13 est un jour activé).
2. Exécuter les tests de l'API : `python manage.py makemigrations --check` (la migration `0030` est écrite à la main) puis `python manage.py test apps.care.test_break_glass`.
3. Trancher le seuil 3g (PAT-20) et faire les essais sur téléphones réels.
4. Lancer la relecture des textes légaux.
5. Désigner les référents ACS-13 (juridique), PAT-24 (éditorial) et PRO-20 (pharmacie pilote) : sans eux, rien n'avance sur ces trois points.

---

## A. Écran ou fonction manquants, API prête

### A1. PAT-19 — Réglage de la fréquence du récapitulatif d'accès (V1)

> **Statut : À moitié** — code fait ; **rien n'est envoyé tant que la tâche quotidienne n'est pas planifiée**.
> **Fait** : Paramètres › Récapitulatif des accès (désactivé par défaut, chaque semaine, chaque mois), enregistrement au clic, dernier envoi affiché ; une fréquence mal formée répond 400 au lieu de 500 ; +5 tests API ; le résumé arrive dans les notifications, par type de structure, sans nom de professionnel ni donnée médicale.
> **Décidé dans le code** : désactivé par défaut (opt-in) ; canal = notification dans l'application, pas d'e-mail.
> **Reste** : planifier `python manage.py send_access_summaries` une fois par jour (`docs/DEPLOYMENT.md`).
> **Recommandation** : garder l'opt-in et **proposer l'activation une seule fois**, après le premier accès d'un professionnel. Pas d'e-mail : un message « quelqu'un a consulté votre carnet » dans une boîte partagée révèle un suivi de santé. Revoir le défaut hebdomadaire le jour où les notifications push (clés VAPID) seront configurées.

**État du code** : modèle `PatientAccessSummaryPreference` (frequency, last_sent_at), vue `PatientAccessSummaryPreferenceView` (GET/PATCH, valeurs `disabled | weekly | monthly`), commande `send_access_summaries`, tests `test_access_summaries.py`. Il manque uniquement l'écran.

**À faire**
- `apps/web/src/app/patient/parametres/page.tsx` : ajouter une section « Récapitulatif des accès ».
- Nouveau composant `components/PatientAccessSummarySettings.tsx` :
  - `GET /api/v1/patient/care/access-summary-preference/` au montage ;
  - 3 choix en boutons radio (Désactivé / Chaque semaine / Chaque mois) ;
  - `PATCH` à la sélection, message de confirmation `aria-live="polite"` ;
  - afficher « Dernier envoi : … » à partir de `last_sent_at` (ou « Jamais »).
- Texte d'aide : le récapitulatif liste *qui a consulté quoi*, sans contenu clinique (à confirmer dans la commande `send_access_summaries`).
- Réutiliser le client API et le style des autres réglages (`PatientNotifications.tsx`).

**Tests** : composant (rendu, changement, erreur réseau) ; API déjà couverte, ajouter le cas « valeur invalide → 400 » s'il manque.

**Risques / décisions** : le canal d'envoi (e-mail seulement, ou aussi notification push). Aujourd'hui push est sans clés VAPID → e-mail uniquement. **Décision à prendre** : la fréquence par défaut pour un nouveau patient (proposition : hebdomadaire).

**Effort** : petit (≈ 0,5 j).

---

### A2. PRO-15 — Patients récents du professionnel (V1)

> **Statut : Fait.**
> **Fait** : bloc « Patients reçus récemment » en haut de Patients (20 au plus, 30 jours), sans identifiant ni donnée médicale ; une seule action, « Nouvelle demande par QR » ; réponse API en `no-store` (elle était mise en cache 24 h) ; 13 tests dans `care/test_recent_patients.py`.
> **Écarts voulus par rapport au plan** : prénom et nom (pas d'initiales) ; pas d'état « actif / terminé », car seuls les accès terminés apparaissent ; recherche locale seulement au-delà de 5 lignes.
> **Recommandation** : ne rien ajouter. Refuser toute demande de lien vers le dossier ou de recherche de patient depuis cette liste.

**État du code** : `ProfessionalRecentPatientsView` — rétention 30 jours, limite 20, **sans identifiant patient**, derrière `professional_clinical_access_error`. La page `app/professionnel/patients/page.tsx` n'affiche que `ProfessionalAccessGrants`.

**À faire**
- Nouveau composant `components/ProfessionalRecentPatients.tsx`, inséré au-dessus de `ProfessionalAccessGrants` dans `app/professionnel/patients/page.tsx`.
- Appel `GET /api/v1/professional/care/recent-patients/` (chemin exact à reprendre de `urls.py` : `professional/recent-patients/`).
- Affichage : initiales ou libellé fourni par l'API, date de dernier accès, état (« accès terminé » / « accès actif »).
- **Action unique** : « Nouvelle demande par QR » → ouvre le parcours de scan existant. Le clic **ne rouvre jamais** un dossier : un accès expiré exige un nouveau QR, donc un nouveau consentement.
- État vide soigné (« Aucun patient reçu ces 30 derniers jours »).

**Tests** : composant (liste, vide, erreur 403) ; API : professionnel sans accès clinique → refus ; rétention (un accès de 31 jours n'apparaît pas).

**Risques** : la liste ne doit pas devenir un « annuaire de patients » détourné. D'où : pas d'identifiant, pas de lien vers le dossier, pas de recherche dessus (voir PRO-16).

**Effort** : petit (≈ 1 j).

---

### A3. PAT-09 — Export du carnet en PDF par période et catégorie (V1)

> **Statut : Fait.**
> **Fait** : période et 7 rubriques (allergies et déclarations, vaccinations, mesures, consultations, ordonnances, examens, documents), mêmes paramètres pour le PDF et l'Excel via `care/export_filters.py` ; le PDF **ignorait la période**, il la reçoit maintenant ; PDF en mise en page `platypus` (en-tête, pagination, pied « Document personnel non chiffré ») ; la case « J'ai compris » bloque les deux boutons ; audit (format, période, rubriques, jamais le contenu) ; réponse `no-store` ; 40 tests d'export.
> **Limites connues** : la période est bornée par les années 1900 à 2100 (pas de durée maximale) ; la rubrique « Allergies et déclarations » reprend toutes les déclarations, antécédents compris, faute de modèle « allergie » séparé.
> **Reste** : relire visuellement un PDF réel (caractères accentués).
> **Recommandation** : garder les 7 rubriques ; ne pas ajouter de durée maximale tant qu'aucun abus n'est constaté.

**État du code** : l'interface d'export Excel a déjà les sélecteurs de période (`from` / `to`), l'avertissement « fichier non chiffré » et la case « J'ai compris ». Le tableur sait filtrer (`export_xlsx.carnet_xlsx_response`). **Le trou est côté PDF** : la branche PDF de `PatientCarnetExportView` est un canvas reportlab basique, sans filtre de période ni de catégorie.

**À faire**
- **API** (`apps/api/apps/care/views.py`) :
  - appliquer `from` / `to` à la branche PDF, en réutilisant la même fonction de filtrage que l'Excel (l'extraire dans un helper commun, ex. `care/export_filters.py`) ;
  - ajouter un paramètre `sections=` (liste : `consultations,prescriptions,examens,mesures,vaccins,allergies,documents`) ; défaut = tout ;
  - valider : `from <= to`, sections connues, plage max raisonnable ;
  - conserver `record_event("patient.carnet.exported")` en ajoutant le format, la période et les sections dans les métadonnées (jamais le contenu).
- **PDF** : remplacer le canvas brut par une mise en page (platypus) : en-tête (nom, date de génération, période), un bloc par section, pagination, pied de page « Document personnel non chiffré ».
- **Web** (`components/PatientCarnetExport.tsx`) : ajouter des cases à cocher par catégorie, transmettre `sections` aux deux liens (Excel et PDF), garder l'avertissement et la case de compréhension comme **préalable bloquant** aux deux boutons.

**Tests** : PDF avec période étroite → seules les entrées de la période ; sections inconnues → 400 ; accessibilité des cases ; l'audit est écrit.

**Risques** : fuite de contenu sensible dans un fichier non chiffré → l'avertissement doit rester impossible à contourner ; police avec accents (vérifier les caractères français dans le PDF).

**Effort** : moyen (≈ 2 j).

---

### A4. PRO-16 — Recherche et filtres dans les listes autorisées (V1)

> **Statut : À moitié.**
> **Fait** : barre commune `ListSearchBar` + `useListFilter` (recherche sans accents ni casse, mots dans n'importe quel ordre, « / » sur grand écran sans voler la saisie, « Échap » pour effacer, nombre de résultats annoncé aux lecteurs d'écran) ; appliquée à Mes consultations (période, établissement), Rendez-vous à venir (état, établissement), adressages **reçus** (état, établissement) et patients récents ; **aucun appel réseau** et aucune recherche globale de patients (un test le vérifie).
> **Pas fait** : les adressages **envoyés** (le composant ne filtre que les reçus) ; filtrage par paramètres d'API (prévu seulement si les listes grossissent). Les tests vérifient la logique et la structure du code, pas le rendu des composants.
> **Recommandation** : étendre aux adressages envoyés quand leur écran sera retouché ; rester en filtrage côté navigateur tant que les listes tiennent en quelques centaines de lignes ; refuser explicitement « chercher un patient par nom ».

**État du code** : une recherche par nom existe dans `ProfessionalConsultations.tsx` (raccourci « / »). Rien d'harmonisé sur les autres listes.

**Principe de conception** : **pas de recherche globale de patients**. On filtre uniquement des listes déjà autorisées par un accès actif ou les propres données du professionnel.

**À faire**
- Extraire un petit hook `useListFilter` et un composant `ListSearchBar` à partir de `ProfessionalConsultations.tsx` (champ de recherche, raccourci « / », annonce du nombre de résultats pour lecteur d'écran).
- L'appliquer à : consultations du professionnel, agenda/rendez-vous, adressages reçus/envoyés, accès récents (PRO-15, filtre local sur les 20 lignes).
- Filtres utiles : état (en cours / terminé), période, établissement.
- **Filtrage côté client** tant que les listes restent petites ; si elles grossissent, paramètres de requête (`?q=`, `?status=`, `?from=`) côté API avec pagination — le filtrage reste *à l'intérieur* du périmètre autorisé par `require_scope()`.

**Tests** : filtre vide, aucune correspondance, accents (« Hélène » trouvé par « helene »), raccourci clavier.

**Risques** : la tentation d'élargir à « chercher un patient par nom » — à refuser explicitement (cela contournerait le principe « le scan du QR est le consentement »).

**Effort** : petit-moyen (≈ 1,5 j).

---

### A5. PAT-20 — Mode faible débit dédié et pictogrammes (V3, après décision écrite)

> **Statut : À moitié.**
> **Fait** : Paramètres › Économie de données (Automatique / Toujours / Jamais), choix gardé dans le navigateur et déclaré dans la politique de confidentialité ; détection Save-Data ou réseau 3g et moins ; photos réduites à 1 024 px, qualité 0,7 (mode normal inchangé : 1 800 px, 0,8) ; courbes chargées à la demande ; polices du téléphone ; animations coupées ; bandeau avec la raison ; 13 pictogrammes SVG avec texte alternatif ; aucune fonction de sécurité ne lit le mode (un test le vérifie). **Portée : espace patient seulement.**
> **Pas fait** : rafraîchissements automatiques espacés (la cloche de notifications interroge toutes les 5 s, avec recul jusqu'à 60 s, sans tenir compte du mode) ; le non-préchargement des documents n'est pas vérifié ; essais sur appareils réels.
> **Décision encore ouverte** : seuil d'activation automatique et public (voir partie D).
> **Recommandation** : automatique pour Save-Data, slow-2g et 2g ; **en 3g, proposer** le mode par un bandeau au lieu de l'imposer (« 3g » couvre une très large part des connexions mobiles réelles) ; Safari et Firefox n'annoncent rien, le choix manuel reste indispensable. Espacer l'interrogation de la cloche (par exemple ×3) quand le mode est actif. Essais sur 2 ou 3 téléphones d'entrée de gamme, connexion bridée. Le changement de seuil tient en une constante.

**État du code** : l'hors-ligne (`lib/offline-*.ts`, `network-status.ts`) et la compression d'image (`image-compress.ts`, côté max 1600 px, qualité 0,82) existent. Aucun usage de `navigator.connection` / `saveData` : **pas de mode dédié**.

**Décision écrite requise avant de coder** : quel est le public visé (zones à faible couverture, forfaits limités) et qu'est-ce qu'on désactive ? Proposition ci-dessous.

**À faire**
- `lib/data-saver.ts` : détecte `navigator.connection.saveData`, `effectiveType` ≤ `3g`, ou le choix manuel de l'utilisateur (stocké localement, avec try/catch).
- Réglage « Économie de données » dans `app/patient/parametres` : Automatique / Toujours / Jamais.
- En mode actif :
  - compression d'image plus forte (côté 1024 px, qualité 0,7) avant envoi ;
  - pas de préchargement des documents ni des graphiques de tendances (`MeasurementTrends.tsx` chargé à la demande) ;
  - polices système uniquement, pas d'animations ;
  - rafraîchissements automatiques espacés.
- **Pictogrammes** : jeu d'icônes SVG inline (≈ 12 : rendez-vous, médicament, examen, vaccin, mesure, QR, alerte, urgence…) accompagnant chaque libellé, pour les personnes peu à l'aise avec la lecture. Toujours un texte alternatif.
- Bandeau discret « Mode économie de données activé ».

**Tests** : simulation de `saveData` et `effectiveType` ; l'image envoyée est bien plus légère ; aucune fonction de sécurité (CSRF, session, consentement) n'est dégradée.

**Risques** : navigateurs sans `navigator.connection` (Safari) → le choix manuel est indispensable ; ne pas confondre « faible débit » et « hors ligne » (déjà traité ailleurs).

**Effort** : moyen (≈ 3 j), plus la phase de décision.

---

## B. Futurs (conception, **pas de code avant décision**)

### B1. ACS-13 — Échange entre établissements au-delà de l'adressage, « bris de glace » (V6)

> **Statut : À moitié — code fait, testé en source, désactivé ; non activable sans les trois décisions écrites.** Livré dans le lot 1.8 (`ECARNET_BREAK_GLASS_ENABLED=false` : toutes les routes répondent 404 et l'interface n'affiche rien). Détail : `docs/IMPLEMENTATION-ACS-13-BRIS-DE-GLACE.md`.
>
> **Fait, point par point par rapport à la conception ci-dessous**
> - `EmergencyAccessRequest` (professionnel, établissement, motif de la liste fermée + texte libre obligatoire de 10 à 280 caractères, horodatage, fenêtre de 1 h au plus, non renouvelable), immuable ; revue dans une table à part, `EmergencyAccessReview`. Migration `0030_emergency_access`.
> - Accès limité à : identité, groupe sanguin, allergies, traitements, antécédents déclarés. Aucune autorisation d'accès au carnet n'est créée.
> - Visibilité : notification immédiate au patient ; personnes de confiance actives **si** `ECARNET_TRUSTED_CONTACTS_ENABLED` ; ligne dans l'historique d'accès ; audit de sévérité critique ; administrateurs de l'établissement prévenus.
> - Revue sous 72 h par un administrateur **autre que le professionnel**, une fois la fenêtre terminée ; décision unique et définitive ; abus = incident de sécurité + patient prévenu ; commande `review_break_glass_overdue` pour les retards.
> - Écrans : formulaire du professionnel avec compte à rebours (`/professionnel/urgence`), page de revue (`/etablissement/urgences`), libellés dans l'historique du patient.
> - Tests : les quatre exigés (sans motif → refus ; au-delà d'1 h → refus ; patient notifié ; périmètre jamais dépassé) dans `care/test_break_glass.py` (31 tests, non exécutés) et `tests/bris-de-glace-acs13-2026-11-12.test.mjs` (11 tests, verts).
>
> **Pas fait / à faire** : les trois décisions écrites ; exécuter les tests de l'API ; planifier `review_break_glass_overdue` ; mettre à jour la politique de confidentialité, les CGU et la déclaration ARTCI ; essai à blanc en préproduction avec données fictives ; la **sanction** d'un abus reste une décision humaine (suspendre le rattachement par les écrans existants).
>
> **Points à trancher par le comité** (choix faits dans le code, le plan ne les précisait pas)
> 1. **Identification du patient** : par identité exacte (nom, prénom, date de naissance ; téléphone seulement pour départager des homonymes), sans recherche libre, réponse identique si le dossier n'existe pas ou est ambigu. *Recommandation : garder.*
> 2. **Fiche non activée** : le bris de glace lit les déclarations **même si le patient n'a pas activé sa carte d'urgence** (`qr_enabled=false`). *Recommandation : garder, car c'est l'objet même du bris de glace, mais le dire en clair dans l'information donnée au patient ; sinon, le limiter aux cartes activées.*
> 3. **Antécédents** : inclus alors que la carte actuelle ne les montre pas ; le modèle n'a pas de drapeau « majeur », donc tous les antécédents déclarés (20 au plus). *Recommandation : ajouter un choix « à montrer en urgence » côté patient.*
> 4. **Contact d'urgence** exclu, conformément à la liste du plan. *Recommandation : laisser exclu, la notification au patient et à ses proches de confiance remplit ce rôle.*
> 5. **Qui l'invoque** : tout professionnel vérifié avec rattachement actif. *Recommandation : resserrer à médecins, infirmiers et sages-femmes d'établissements désignés (une condition à ajouter).*
> 6. **Non renouvelable** = refus pendant 24 h pour le même professionnel et le même patient. *Recommandation : garder.*
>
> **Recommandation générale** : ne pas activer avant les trois signatures ci-dessous. (1) Avis juridique d'un juriste en droit de la santé et protection des données, ARTCI incluse : base légale (intérêt vital), traces à conserver, information du patient après coup. (2) Définition écrite de l'urgence : perte de conscience, danger vital immédiat ou impossibilité de consentir. (3) Comité : un médecin, un juriste ou DPO, un représentant des patients, AKATech et REDIANICE, avec revue trimestrielle des accès et des incidents et pouvoir de couper le drapeau.

**Pourquoi c'est à part** : c'est la fonction la plus sensible du produit. Elle contredit potentiellement le principe central (consentement = scan du QR, un professionnel à la fois).

**Pré-requis (décisions écrites)**
1. Avis juridique : base légale du « bris de glace » dans le pays visé, rôle de l'autorité de protection des données.
2. Définition stricte de l'urgence (patient inconscient, danger vital) et **qui** peut l'invoquer.
3. Validation par le conseil d'éthique / comité du projet.

**Conception proposée**
- Modèle `EmergencyAccessRequest` : professionnel, établissement, motif (liste fermée + texte libre obligatoire), horodatage, durée (≤ 1 h, non renouvelable).
- Accès **limité à un sous-ensemble** (fiche d'urgence : allergies, traitements, groupe sanguin, antécédents majeurs) — pas au dossier complet. S'appuie sur la fiche d'urgence existante (`PatientEmergencyCardSettingsClient`).
- Accès **toujours visible** : notification immédiate au patient et à ses personnes de confiance (si activées), mention dans l'historique d'accès, entrée d'audit renforcée.
- **Revue a posteriori obligatoire** par l'administrateur d'établissement sous 72 h ; abus → sanction et signalement.
- Drapeau `ECARNET_BREAK_GLASS_ENABLED=false`. Aucune activation en production sans les trois décisions ci-dessus.

**Tests** : sans motif → refus ; au-delà de 1 h → refus ; le patient est bien notifié ; l'accès ne dépasse jamais le périmètre d'urgence.

**Effort** : grand (≈ 3 à 4 semaines, hors volet juridique).

---

### B2. PAT-24 — Contenus éducatifs, suivis de grossesse et d'enfant (V3)

> **Statut : Pas fait** (attend le comité éditorial médical).
> **Recommandation** : ne rien développer sans comité éditorial ni relecteur nommé. Références de croissance : celles de l'OMS. À écrire d'abord : modèle parent ou tuteur et âge de passage à un compte propre (données de mineurs = régime renforcé). Si le projet démarre : calendrier vaccinal et courbes de croissance de l'enfant d'abord (les mesures et courbes existent), suivi de grossesse ensuite. Le jeu de 13 pictogrammes de PAT-20 est réutilisable.

**Pré-requis** : un **comité éditorial médical** (sources validées, relecture, date de révision) ; sans lui, on ne publie rien.

**Conception**
- Deux volets séparés :
  1. **Contenus éducatifs** : articles courts, statiques, validés, versionnés (modèle `EducationalContent` : titre, corps, langue, auteur-relecteur, date de validation, date d'expiration). Aucune personnalisation « intelligente » ni conseil individuel.
  2. **Suivis** :
     - *Grossesse* : consultations prénatales, échographies, mesures (poids, tension), vaccins maternels ; calendrier théorique **indicatif** à partir de la date des dernières règles saisie par la patiente.
     - *Enfant* : courbes de croissance (poids/taille/périmètre crânien) comparées à des références publiées, calendrier vaccinal, jalons de développement. Réutiliser `HealthMeasurements` / `MeasurementTrends`.
- Un compte patient peut avoir des **profils d'enfants** : nouvelle entité `DependentProfile` rattachée au parent. **Décision à prendre** : modèle de représentation (parent/tuteur), âge de transition vers un compte propre.
- Tout affichage de courbes : mention « indicatif, ne remplace pas l'avis d'un professionnel ».

**Risques** : responsabilité médicale des contenus, données de mineurs (régime renforcé), références de croissance à choisir (OMS).

**Effort** : grand (≈ 4 à 6 semaines, dont le contenu éditorial).

---

### B3. PRO-20 — Ordonnance électronique à QR pour la pharmacie (V3)

> **Statut : Pas fait** (attend une pharmacie pilote et le cadre réglementaire local).
> **Recommandation** : attendre la convention avec la pharmacie pilote et l'avis sur l'ordonnance électronique. Le principe de conception est le bon : un jeton d'ordonnance **distinct** du QR d'accès, la pharmacie ne voit que les lignes de l'ordonnance signée. Un jeton à usage unique et la délivrance ligne par ligne sont à tester dès la première version.

**État du code** : `PrescriptionLine` (lignes d'ordonnance) existe ; le patient voit déjà ses ordonnances.

**Pré-requis** : accord avec au moins une pharmacie pilote et cadre réglementaire local sur l'ordonnance électronique.

**Conception**
- Un **jeton d'ordonnance** distinct du QR d'accès au carnet (principe : on ne donne jamais accès au dossier à la pharmacie).
- Modèle `PrescriptionToken` : ordonnance, jeton aléatoire, expiration, nombre de délivrances autorisées, état (émis / délivré / annulé).
- Le patient affiche le QR ; la pharmacie le scanne via une page dédiée et **ne voit que** les lignes de l'ordonnance (médicament, dose, durée, quantité) et le nom du prescripteur — ni antécédents ni autres ordonnances.
- Délivrance enregistrée (qui, quand, quoi) ; un jeton déjà délivré ne peut plus servir (anti-réutilisation). Délivrance partielle gérée ligne par ligne.
- Signature du prescripteur : la consultation signée (scellé existant, `ConsultationSeal`) garantit l'intégrité ; le jeton référence l'ordonnance **signée** seulement.
- Drapeau `ECARNET_E_PRESCRIPTION_ENABLED=false` ; rôle « pharmacie » à créer (nouveau type d'établissement et d'acteur).

**Tests** : jeton expiré, réutilisé, ordonnance non signée → refus ; la pharmacie n'accède à rien d'autre.

**Effort** : grand (≈ 4 semaines + pilote).

---

### B4. PRO-21 — Résultats de laboratoire dans le carnet (V3) — workflow corrigé

> **Statut : À moitié (13/11/2026)** — code livré derrière `ECARNET_LAB_ENABLED` (défaut `false`), non exécuté côté API (voir B4.0).
> **Recommandations de départ, reprises dans le code** : **oui** à « Abandonner l'examen » avec motif écrit et audité (sans cette sortie, une consultation peut rester bloquée indéfiniment) ; **14 jours renouvelables** pour le QR d'examen ; un laboratoire pilote sous convention avant tout code ; commencer par la persistance de la consultation en attente, qui est le plus gros risque de régression sur les listes existantes.

#### B4.0 Ce qui est livré (13/11/2026, `e-carnet_V1_13.zip`)

- **Parcours** : consultation « en attente de résultats », QR d'examen (14 jours, renouvelable, masquable par le patient), dépôt d'un PDF par examen, correction (l'ancien fichier reste, marqué « remplacé »), abandon d'un examen avec motif écrit et audité, reprise avec un nouveau QR d'accès.
- **Espace laboratoire à part entière** (`/laboratoire`) avec **trois onglets : Scanner, Dépôts, Moi**. Le compte reste un compte « établissement » côté serveur ; l'API indique `is_laboratory` sur ce contexte, et le shell de l'interface choisit l'espace : un laboratoire n'a plus les onglets Dossiers, Équipe, Demandes de l'espace établissement, et un compte qui n'est pas un laboratoire n'a pas l'espace laboratoire. « Moi » reprend les réglages de l'établissement, sans modèle d'ordonnance ni copie hors connexion.
- **Onglet Dépôts** : chaque ligne dit l'examen, son type, son **statut (déposé, remplacé, abandonné)**, les initiales et l'année de naissance du patient, l'heure ; regroupement par jour (Aujourd'hui, Hier…) ; filtres par statut, par période (7, 30, 90 jours, toute la période) et recherche. Le nom complet et le contenu des fichiers ne sont jamais montrés ; le motif d'abandon écrit par le médecin non plus. Un examen abandonné n'apparaît que chez un laboratoire qui avait lu son QR.
- **Migrations** : `care/0031_pending_consultation_lab_results` (suit `0030_emergency_access`) et `establishments/0017_establishment_laboratory`.
- **Vérifié** : syntaxe et imports Python, chaîne de migrations lue, 424 tests web passent (10 échecs déjà présents dans la V1_12 d'origine, aucun nouveau). **Non vérifié** : tests de l'API (aucun Django ici), `makemigrations --check`, typecheck complet et build web, essai sur appareil réel.

**Idée directrice (validée avec vous)** : le laboratoire a son propre espace, rattaché par l'établissement, et ne fait que *recevoir le nom du patient et déposer un PDF*. Le résultat revient dans **la même consultation** que celle qui a demandé l'examen. La consultation reste **en attente** tant que le résultat n'est pas arrivé.

#### B4.1 Parcours complet

1. **Rattachement du labo (une fois).** L'administrateur de l'établissement saisit l'e-mail de l'administrateur du labo (même mécanisme que `EstablishmentAdminInvitation`). Le labo active son compte, se connecte et arrive directement dans l'espace **Laboratoire** (`/laboratoire`). Il n'a aucun accès clinique.
2. **Consultation.** Le médecin, avec son accès actif, demande un examen (`ExamRequest`, statut `requested`).
3. **Bouton « Attendre les résultats ».** Avant de signer, le médecin clique dessus. La consultation passe en **« En attente de résultats »** :
   - les informations saisies sont enregistrées côté serveur ;
   - l'accès du médecin se ferme (même fonction `end_access_grant`, nouveau motif `waiting_results`), le patient est libre d'aller ailleurs ;
   - la consultation **ne peut pas être signée** tant que tous les examens de l'attente ne sont pas en `result_received`.
4. **QR d'examen.** Dans le carnet du patient, la consultation en attente affiche un QR **qu'il peut afficher ou masquer**, lié à *cette consultation*.
5. **Au laboratoire.** Le patient montre le QR. Le labo le scanne dans son espace et voit **uniquement** : nom du patient + **date de naissance** (ou initiales + année) + liste des examens demandés. Le labo confirme que c'est bien la bonne personne avant tout dépôt.
6. **Dépôt.** Les examens faits, le labo téléverse le(s) PDF dans l'espace Laboratoire, en choisissant l'examen concerné. Chaque PDF devient un `MedicalDocument` rattaché à l'`ExamRequest` et à la consultation, avec l'établissement émetteur et la marque « Émis par le laboratoire ». L'examen passe en `result_received`.
7. **Notification.** Le patient est notifié dans l'application. **Le médecin n'est pas encore notifié** : il retrouve la consultation « à reprendre » dans sa liste des consultations en attente (suite prévue en B4.5).
8. **Lecture dans l'app.** Le PDF se lit dans l'application, dans la consultation, pour le patient et — dans l'espace professionnel — pour le médecin.
9. **Reprise.** Quand tous les examens sont reçus, la consultation devient **« À reprendre »**. Le patient montre un **nouveau QR d'accès** (le consentement ne se transmet pas tout seul), le système propose au médecin de *reprendre la consultation en attente*, il lit les résultats, complète sa conclusion et signe. L'accès se ferme alors comme d'habitude.

#### B4.2 Données et code à toucher

- **Fait vérifié dans le code** : aujourd'hui `Consultation` n'est écrite en base qu'à la validation (`validated_at` obligatoire) et `ExamRequest` y est rattaché ; il n'existe pas d'état « en cours » côté serveur. C'est donc le **principal chantier** : ajouter une consultation persistée avant signature.
- `Consultation` : nouveau champ `status` (`waiting_results` / `to_resume` / `signed`), `validated_at` rendu nullable pour les consultations non signées (migration + revue de toutes les listes qui supposent qu'une consultation est signée : agenda, historique patient, exports).
- `ExamRequest` : champ `lab_establishment` (optionnel, laboratoire visé).
- `MedicalDocument` : champs `issued_by_lab` (booléen), `superseded_by` (correction : l'ancien reste visible, marqué « remplacé »).
- Nouveau `ExamQrToken` : consultation, hash du jeton, expiration, révocation, même principe que `PatientAccessQrToken` (jeton opaque, jamais d'identifiant dans le QR).
- Établissement : type **« Laboratoire »** reconnu (aujourd'hui `establishment_type` est un champ libre) ; rôle `lab_admin` seul : **pas de techniciens** (décision du 13/11, voir B4.5).
- Vues labo (écriture seule) : `POST /laboratory/qr/resolve/` (renvoie nom + date de naissance + examens demandés), `POST /laboratory/results/` (dépôt PDF, mêmes contrôles de type et taille que `MedicalDocument`).
- Vue patient : afficher/masquer/révoquer le QR d'examen.
- Vue professionnelle : bouton « Attendre les résultats », liste « Consultations en attente / à reprendre ».
- Web : `/laboratoire` (connexion directe) avec trois onglets : **Scanner** (QR et dépôt), **Dépôts** (historique filtrable), **Moi** (compte et laboratoire).
- Drapeau `ECARNET_LAB_ENABLED=false`.

#### B4.3 Règles de sécurité

- Le labo **ne lit jamais** un carnet : aucun scope de lecture, aucune recherche de patient, aucun accès hors du QR présenté.
- Un résultat déposé **ne se modifie pas** : correction = nouveau dépôt, l'ancien reste « remplacé ». Le patient peut contester, pas modifier.
- Chaque résolution de QR et chaque dépôt sont audités (qui, quand, quel examen).
- Pas d'interprétation automatique par l'application : on affiche le PDF.
- Données réelles interdites tant que `REAL_HEALTH_DATA_ALLOWED=false` (développement et pilote en données fictives).

#### B4.4 Points ouverts

1. **Blocage sans issue.** Vous voulez que la consultation reste bloquée tant que le résultat n'arrive pas. Risque : si le patient ne fait jamais l'examen, la consultation reste bloquée indéfiniment. Proposition : garder le blocage, mais prévoir une **sortie explicite** — le médecin peut « Abandonner l'examen » avec un motif écrit (audité), ce qui libère la signature. **Livré** (motif de 5 caractères minimum, audité) ; à confirmer par le médecin référent.
2. **Plusieurs examens.** La consultation reprend quand *tous* les examens de l'attente sont reçus ; sinon le médecin abandonne ceux qui manquent (point 1).
3. **Un seul professionnel à la fois.** La consultation en attente ne retient pas d'accès : le patient peut voir un autre médecin entre-temps. La reprise exige un nouveau QR d'accès (consentement).
4. **Durée de vie du QR d'examen** : 14 jours, renouvelable par le patient. **Livré** ; durée réglable (`ECARNET_EXAM_QR_TTL_DAYS`).
5. **Techniciens du labo** : **écartés** (décision du 13/11). Un seul compte administrateur par laboratoire ; à rouvrir seulement si un laboratoire pilote en fait la demande.
6. **Résultats sensibles** : le médecin voit tout dans l'espace professionnel ; décision confirmée avec vous, pas de retardement de l'alerte médecin.

#### B4.5 Suites : faites, reportées, écartées (13/11/2026)

| Sujet | Décision | Détail |
|---|---|---|
| Espace laboratoire à 3 onglets (Scanner, Dépôts, Moi) | **Fait** | Voir B4.0. |
| Dépôts : statuts, période, historique plus lisible | **Fait** | Voir B4.0. |
| Techniciens du laboratoire | **Écarté** | Décision du 13/11. Un seul compte administrateur par laboratoire. |
| Notification du médecin quand un résultat arrive | **Plus tard** | Aujourd'hui seul le patient est notifié (dans l'application). Pour le médecin il faut : une notification dans l'application d'abord (le médecin retrouve pour l'instant la consultation dans sa liste « en attente »), puis le push, qui exige des **clés VAPID** (absentes aujourd'hui : le push est inactif). Recommandation : un texte sans donnée de santé (« Un résultat est arrivé »), sans nom de patient ni d'examen. |
| Valeurs structurées (analyte, valeur, unité) au lieu du PDF seul | **Plus tard** | À envisager après un pilote : choix d'une nomenclature, validation médicale, aucune interprétation automatique. Le PDF reste la référence. |

**Effort** : grand (≈ 4 à 5 semaines : persistance de la consultation en attente, espace labo, QR d'examen, tests de non-régression des listes).

---

## C. Ordre de réalisation proposé

| Lot | Contenu | Effort | Dépendances |
|---|---|---|---|
| 1 | PAT-19 + PRO-15 | ≈ 1,5 j | aucune |
| 2 | PAT-09 (PDF période/catégorie) | ≈ 2 j | helper de filtrage commun |
| 3 | PRO-16 (recherche/filtres) | ≈ 1,5 j | PRO-15 |
| 4 | PAT-20 (faible débit) | ≈ 3 j | décision écrite |
| 5 | PRO-20, PAT-24 | 4–6 sem. | pilote pharmacie / comité éditorial |
| 5 bis | PRO-21 (espace labo, consultation en attente) | 4–5 sem. | labo pilote sous convention |
| 6 | ACS-13 | 3–4 sem. | avis juridique + comité |

Les lots 1 à 3 peuvent partir immédiatement : ils ne touchent ni au consentement, ni au périmètre d'accès.

**Avancement des lots (13/11/2026)** : lot 1 — PAT-19 à moitié (tâche à planifier), PRO-15 fait ; lot 2 — fait ; lot 3 — à moitié ; lot 4 — à moitié ; lot 5 — pas fait ; lot 5 bis (PRO-21) — à moitié (code livré et désactivé, tests API à exécuter, pilote à trouver) ; lot 6 — à moitié (code livré, désactivé, la partie juridique et le comité n'ont pas commencé).

## D. Décisions à me donner — état et recommandations (13/11/2026)

Une recommandation n'est pas une décision, et rien ci-dessous n'est un avis juridique : les points juridiques sont à faire valider par un juriste.

| # | Décision demandée | État | Ma recommandation |
|---|---|---|---|
| 1 | **PAT-19** : fréquence par défaut ; e-mail seul ? | Tranchée dans le code : **désactivé** (opt-in), notification dans l'application, pas d'e-mail | Garder l'opt-in ; proposer l'activation une fois après le premier accès ; pas d'e-mail ; revoir quand le push sera configuré. **Planifier `send_access_summaries`.** |
| 2 | **PAT-09** : rubriques exportables | **Fermée** : les 7 rubriques du plan ont été livrées | Rien. |
| 3 | **PAT-20** : public cible et seuil d'activation automatique | **Ouverte** : le code active le mode en Save-Data ou en 3g et moins (« à confirmer » dans la note de livraison) ; espace patient seulement | Automatique pour Save-Data, slow-2g et 2g ; **3g en proposition** ; patients d'abord, professionnels ensuite ; essais sur appareils réels ; espacer l'interrogation de la cloche en mode actif. |
| 4 | **Textes légaux** : relecture de la ligne « Économie de données (localStorage) » | **Ouverte** | Faire relire. Garder vrai : le réglage reste sur l'appareil, ne contient aucune information de santé, n'est jamais envoyé au serveur. Décrire le bris de glace (qui, quoi, durée, information du patient) **avant** son activation. Le retrait de la note de la fenêtre Langue ne crée pas de trou : la politique garde sa ligne Google Translate. |
| 5 | **PRO-21** : « Abandonner l'examen » ; durée du QR d'examen ; techniciens | **Tranchée dans le code** (à confirmer par le médecin référent) ; techniciens **écartés** le 13/11 | Garder la sortie de secours avec motif audité et les 14 jours renouvelables. Notification du médecin et valeurs structurées : plus tard (B4.5). |
| 6 | **ACS-13** : avis juridique, définition de l'urgence et de qui l'invoque, validation du comité | **Ouverte** : code livré et désactivé en attendant | Voir B1 : juriste (ARTCI incluse) ; urgence = perte de conscience, danger vital immédiat ou impossibilité de consentir ; qui = médecins, infirmiers, sages-femmes d'établissements désignés ; comité médecin + juriste ou DPO + représentant des patients + AKATech + REDIANICE. Ne pas activer avant les trois signatures. |
| 7 | **PAT-24** : désignation d'un référent éditorial | **Ouverte** | Nommer un référent médical avant tout développement ; sources OMS ; modèle parent ou tuteur à écrire. |
| 8 | **PRO-20** : désignation d'une pharmacie pilote | **Ouverte** | Attendre la convention et la clarification réglementaire. |

**L'ordre que je recommande** : (1) planifier la tâche de PAT-19, (2) exécuter les tests de l'API d'ACS-13, (3) trancher le seuil 3g, (4) lancer la relecture légale, (5) nommer les trois référents. Tant que ces trois référents ne sont pas nommés, ACS-13, PAT-24 et PRO-20 ne peuvent pas avancer.
