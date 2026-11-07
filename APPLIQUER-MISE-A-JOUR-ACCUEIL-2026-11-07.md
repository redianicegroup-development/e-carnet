# Mise à jour accueils — v1.6.4 (07/11/2026)

- **Accueil patient / professionnel** : un seul bloc par espace (`DossierCard` avec `unified`). Patient : identité → couverture → déclarations. Professionnel : profil → cachet et signature → établissement actif. Photo de profil agrandie (72 px) en tête.
- **Cartes virtuelles** retirées des deux accueils. Le **QR public de la carte d'urgence** se gère désormais dans *Moi › Carte d'urgence* (`PatientEmergencyCardSettingsClient`).
- **Sidebar PC** : seuls les premiers libellés (Accueil, Mon carnet, Consultations, Historique) ; le sous-titre n'est plus affiché ni lu (`aria-label` = libellé visible).
- **Accueil établissement** : le logo téléversé (`EstablishmentLogo`, repli initiales) remplace la photo de l'administrateur.
- **Tests** adaptés (6 tests décrivant l'ancien design). Suite : 318 verts, 4 rouges déjà présents avant (centre d'aide, hors-connexion, navigation-2026-11-03, thème).

Fichiers touchés : `DossierCard.tsx`, `dossier-card.css`, `PatientHomeIdentity.tsx`, `PatientHome.tsx`, `ProfessionalDossier.tsx`, `ProfessionalHome.tsx`, `PatientEmergencyCardSettingsClient.tsx`, `EstablishmentConsole.tsx`, `shell/AppSidebar.tsx`, `shell/sidebar.css`, et 5 fichiers de tests.
