# PWA hors connexion

Mis à jour le 02/11/2026 (décision produit : rester dans l'application sans réseau et y lire ses déclarations).

## Ce qui reste disponible sans réseau

Deux copies locales, et seulement deux. Tout le reste (historique, consultations, documents, agenda, vaccins, réponses d'API) exige le réseau et n'est jamais conservé sur l'appareil.

### 1. Les déclarations du carnet, en lecture seule (espace patient)

- **Contenu** : les déclarations (groupe sanguin, allergies, antécédents, traitements, contact d'urgence, taille, poids, ville) du profil actif, avec leur provenance telle que l'API la renvoie. Les noms des profils servent uniquement à les choisir. Rien d'autre : ni identifiant de compte affiché, ni date de naissance, ni historique.
- **Profils enfants** : on change de profil hors connexion, sans appeler le serveur (le choix est local à la page, il ne change **jamais le profil actif** côté serveur). Un profil enfant n'est lisible que s'il a été ouvert en ligne au moins une fois sur cet appareil ; sinon la page le dit. L'application ne bascule jamais d'elle-même sur un profil pour le copier : ce changement est journalisé côté serveur et appartient à la personne.
- **Navigation** : la page `/hors-connexion.html` est servie par le service worker pour toute page privée quand le réseau manque. Elle reprend les onglets de l'espace patient : *Accueil* (résumé) et *Mon carnet* (déclarations) ; *Consultations* et *Historique* indiquent qu'ils ont besoin de la connexion.
- **Stockage** : IndexedDB `ecarnet-offline-v1`, un seul enregistrement `current` (profils + déclarations par profil) et un enregistrement `prefs` (réglage). Écrit uniquement par l'application, en ligne (`lib/offline-sync.ts`) ; lu par `public/hors-connexion.js`, qui ne fait jamais d'écriture ni de requête réseau (seule suppression : « Effacer de cet appareil »).
- **Fraîcheur** : la page affiche la date d'enregistrement de chaque profil et rappelle que la copie peut ne pas refléter les dernières modifications.
- **Mise à jour** : à l'ouverture de l'espace patient, au changement de profil, après une déclaration ajoutée ou retirée, au retour de la connexion. Le profil actif étant choisi côté serveur, la synchronisation le relit après les déclarations : s'il a changé entre-temps, elle n'enregistre rien (jamais les déclarations d'un profil sous le nom d'un autre).
- **Durée et effacement** : 7 jours par profil (constante `SNAPSHOT_MAX_AGE_MS`) ; supprimée à la déconnexion (tous les écrans), quand le serveur répond « session absente » en ligne, au démarrage de l'espace patient pour tout ce qui est périmé, depuis *Paramètres › Hors connexion* (effacement, ou désactivation qui efface), et par « Effacer de cet appareil » sur la page hors connexion.
- **Réglage** : actif par défaut ; `OFFLINE_DECLARATIONS_DEFAULT_ENABLED` (`lib/offline-policy.ts`) à `false` pour exiger un accord préalable.
- **Limite connue** : toute personne qui peut ouvrir le navigateur de l'appareil peut lire cette copie (aucun chiffrement : une clé stockée sur le même appareil n'apporterait pas de protection réelle). Sur un appareil partagé, la désactiver. Les textes d'information (politique de confidentialité, Aide) le disent.
- **Confirmation professionnelle** : le modèle ne possède pas encore de circuit de confirmation pour `ClinicalDeclaration` ; l'API renvoie toujours « Déclaré par le patient ». La page affiche ce que l'API renvoie : le statut « confirmé » apparaîtra tel quel quand l'API le renverra.

### 2. La carte d'urgence publique ouverte par QR

- **Contenu** : la réponse de `/api/v1/patient/emergency-card/qr/<token>/` (identité minimale et déclarations choisies par le titulaire), sur l'appareil de **celui qui la consulte**.
- **Stockage** : IndexedDB `ecarnet-public-emergency-v1`, **24 heures**. Passé ce délai la copie est **supprimée** (à la lecture, et pour toutes les copies périmées à chaque ouverture d'une carte), pas seulement masquée.
- **QR désactivé ou renouvelé** : une réponse 404 ou 410 supprime la copie et n'affiche rien, même si l'appareil est en ligne. La copie n'est montrée que si le serveur ne répond pas (réseau, délai, 429, 5xx), avec l'avertissement « Connexion indisponible : dernière synchronisation le … ».
- **Rechargement sans réseau** : le service worker garde la coquille de la page `/urgence/<token>` (HTML sans donnée de santé) et les fichiers `/_next/static/` qu'elle a chargés ; la page lui envoie leur liste (message `CACHE_EMERGENCY_PAGE`) car la toute première visite n'est pas encore interceptée. Au plus 20 coquilles et 160 fichiers statiques sont gardés.

## Ce que le service worker ne garde jamais

Le HTML des pages privées, les réponses d'API, les documents. Il garde les pages publiques (accueil, aide, à propos, sécurité), `manifest.webmanifest`, `/hors-connexion.html` et son script, l'icône, et les fichiers `/_next/static/` (noms à empreinte, sans donnée personnelle). Pour une requête qui n'est pas une page, l'échec réseau reste un échec réseau (pas de repli sur l'accueil).

## Notifications push

L'abonnement est retiré du navigateur et du serveur à chaque déconnexion (patient, médecin, établissement, administration), avant la fin de la session : `lib/logout.ts`.

## Aucune écriture hors connexion

Modifier une déclaration, confirmer, révoquer, consulter l'historique ou ajouter un document exige le réseau. Il n'existe ni file d'écriture ni synchronisation montante.

## Tests

`tests/hors-connexion-2026-11-02.test.mjs` (règles, IndexedDB sur faux navigateur, synchro, déconnexion, page hors connexion, textes) et `tests/service-worker-2026-11-02.test.mjs` (service worker dans un bac à sable). À faire sur appareils réels : rechargement de `/urgence/<token>` en mode avion, bascule de profil enfant hors connexion, iOS (PWA installée) et Android.
