# Mise à jour du 25/11/2026 — console d'administration + fusion de vos deux ZIP

Base : `e-carnet-4` + `e-carnet-5-updated-files.zip` + `e-carnet_patch.zip`. Ce ZIP ne contient que les fichiers créés ou modifiés (chemins d'origine).

## À faire pour appliquer
1. Copier les fichiers du ZIP dans le projet, en gardant les chemins.
2. **Supprimer 5 fichiers** devenus inutiles (récupération de compte dans la console, ancienne gestion des demandes) :
   - `apps/api/apps/identity/admin_recovery_assist.py`
   - `apps/api/apps/identity/test_admin_recovery.py`
   - `apps/web/src/components/AdminRecoveryClient.tsx`
   - `apps/web/src/components/admin-recovery.css`
   - `apps/web/src/components/AdminAccountActionRequestsClient.tsx`
3. Base de données : `python manage.py migrate` (nouvelle migration `identity/0022`).
4. Variables d'environnement du serveur (portail de surveillance, fermé tant qu'elles ne sont pas posées) :
   `ECARNET_OPS_PORTAL_ID` contient une ou plusieurs adresses e-mail séparées par des virgules ; `ECARNET_OPS_PORTAL_SECRET` doit contenir au moins 24 caractères. Optionnel : `ECARNET_OPS_PORTAL_SESSION_SECONDS` (1800 par défaut), `ECARNET_RATE_OPS_LOGIN` (6/hour par IP).
   `ECARNET_OPERATIONS_ADMIN_EMAILS` n'existe plus : à retirer de vos `.env` et de l'hébergeur.
5. `apps/api/.env.production.example` n'est pas dans le ZIP (les fichiers `.env.*` sont exclus par sécurité). Remplacer la ligne `ECARNET_OPERATIONS_ADMIN_EMAILS=` par :
   ```
   ECARNET_OPS_PORTAL_ID=ops@votre-domaine.ci,ops2@votre-domaine.ci
   ECARNET_OPS_PORTAL_SECRET=
   ```
6. Planifier la nouvelle commande `cleanup_login_events` (chaque jour, supprime le journal des connexions de plus de 90 jours). Elle s'ajoute aux 9 autres commandes encore non planifiées.

## Console d'administration (8 onglets au lieu de 13)
Accueil · Utilisateurs · Établissements · Facturation · Bannières · Audit · Retours · Moi.
- **Barre du bas** : une seule ligne, et le bas des pages n'est plus masqué.
- **Profil grid** : établissements créés, facturation et utilisateurs. Un toucher ouvre la fiche, les actions sont dans la fiche.
- **Utilisateurs** (nouveau) : total, actifs/inactifs/fermés, recherche, filtres par rôle et état, fiche (patient, professionnel, administrateur d'établissement, laboratoire, équipe), désactiver/réactiver (avec confirmation, journal d'audit, sessions fermées), fermer les sessions. Les comptes de l'équipe et son propre compte sont protégés.
- **Accueil** : utilisateurs, établissements, abonnements, transactions, revenus, alertes, évolution sur 30 jours, activités récentes (type seulement, jamais le contenu).
- **Journal des connexions** (nouveau, 90 jours, sans adresse IP ni appareil) et **journal des suspensions et suppressions** (lecture seule : pour une suspension, durée et motif ; pour une suppression, la date).
- **Bannières** : plus de texte alternatif ni de lien, zone de dépôt (glisser-déposer, aperçu, contrôle du format et du poids). GIF accepté ; seule la première image est gardée.
- **Récupérations de compte** : onglet et routes retirés pour de bon. La confirmation par e-mail viendra avec `monecarnetci.com`.
- **Journal d'audit** : réservé aux superadministrateurs (il dépendait de la liste d'e-mails de surveillance, qui disparaît).
- Anciennes adresses (`/admin#activity`, `#survey`, `#account-requests`…) : elles mènent au bon onglet.

## Suspension et suppression
- **Suspension** : immédiate, 1 à 90 jours, avec un motif. Plus de validation par l'équipe. Elle se lève toute seule à l'échéance (à la première connexion qui suit). À la connexion, le bon mot de passe affiche « suspendu jusqu'au… » ; un mauvais mot de passe reste neutre.
- **Suppression** : immédiate et sans motif (un ancien client qui en envoie un est ignoré, rien n'est conservé).
- Désactivation par l'équipe : ne se lève jamais à une échéance, seule la réactivation par l'équipe rouvre le compte.
- Plus de notification « demande de suspension » pour l'équipe.

## Portail de surveillance : `/surveillance`
Page à part, sans lien depuis le site ni la console, sans compte E-Carnet. On saisit une adresse e-mail autorisée et le secret posé dans les variables d'environnement. `ECARNET_OPS_PORTAL_ID` accepte plusieurs adresses séparées par des virgules. Comparaison à temps constant, 6 essais par heure et par IP, verrou général après 20 échecs en 15 min, session signée de 30 min (cookie HttpOnly limité au chemin du portail), jeton `X-Ops-Csrf` obligatoire pour toute modification, connexions et échecs inscrits à l'audit. Changer le secret ferme toutes les sessions ouvertes.
La page « Votre compte n'est pas autorisé pour la surveillance technique » de la capture venait de l'ancienne règle (superadmin + e-mail dans une liste).

## Fusion de vos deux ZIP
Fichiers sans conflit : copiés tels quels. Trois fichiers modifiés par les deux ZIP et deux modifiés aussi par moi ont été fusionnés à la main :
- `ProfessionalConsultations.tsx` : historique déplacé vers sa page (ZIP 5) + bouton RDV et fenêtre (patch).
- `ui/CollapsibleSection.tsx` : `id` (ZIP 5) + `data-has-info` (patch).
- **Contradiction entre les deux ZIP** : la tuile (TileLink) du ZIP 5 écrit la description sous le titre, le test du patch exige un « i ». J'ai gardé le « i » (voisin de la tuile, jamais dans le lien).
- `AccountActionRequestsSettingsClient.tsx` : mon écran réécrit + votre habillage InfoTip/SectionIntro.
- `config/settings.py` : `appointment_give` (patch) + `ops_login` (moi).

## Vérifications faites
- API : 963 tests écrits ; tout passe sauf **3 échecs déjà présents dans e-carnet-4** (`test_patient_records…active_establishment`, et deux tests de `test_lab_results`). J'ai corrigé 2 tests d'effacement de `care/test_documents_v2.py` qui visaient le mauvais module à simuler.
- Site : `tsc` propre. 640 tests exécutés, **36 échecs identiques à e-carnet-4**, aucun nouveau. `next build` n'a pas pu tourner ici (polices Google et `@zxing/library` non disponibles).
- Tests mis à jour pour le nouveau design : 6 fichiers de tests web + `console-admin-2026-11-25.test.mjs` (nouveau) ; côté API `test_admin_users.py` (nouveau), `test_admin_operations.py` (réécrit), `test_account_action_requests.py`, `test_role_notifications.py`.

## À savoir
- **`package-lock.json` n'est pas à jour** : `npm ci` échoue (il manque `leaflet`, `@types/leaflet`, `@types/geojson`). Lancer `npm install` et garder le nouveau fichier. À faire avant le prochain déploiement.
- La diffusion des bannières aux patients est activée par défaut. Le réglage serveur `ADS_ENABLED` peut être mis à `false` pour la désactiver.
- Vos fichiers `.env` (racine et `apps/api`) sont dans les archives que vous m'envoyez : ne les partagez pas, et changez la clé `RESEND_API_KEY` si l'archive a circulé.

## Reporté en V4 (de votre liste 5)
Détection d'activités suspectes (demande d'enregistrer IP et appareil : avis du juriste), rôles et permissions fins de l'équipe, bannissement définitif (la désactivation existe), exports des listes et journaux, confirmation par e-mail de la récupération de compte.
