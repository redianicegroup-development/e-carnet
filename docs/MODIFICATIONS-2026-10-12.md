# Mise à jour E‑Carnet — 12 octobre 2026

## Base utilisée et précautions

Le travail repart de l’archive `e-carnetv1.4.zip` jointe lors du dernier échange. Les changements de l’archive imbriquée « version à mettre proprement dans existant sans casser » ont été appliqués sélectivement, sans remplacement global du dépôt. Le layout conserve ses providers et ses composants actuels ; la feuille de styles des pages d’information a été ajoutée sans remplacer le layout.

Les dépendances déclarées, `apps/web/src/app/page.tsx`, `LandingMotion.tsx`, `useSmoothScroll.ts` et `gsap.ts` sont conservés. Les dépendances GSAP et Lenis ont été comparées à l’archive source et n’ont pas changé.

## Changements

Le thème par défaut reste **Lagon turquoise + Unbounded** et reste modifiable dans les paramètres. Un aperçu s’applique immédiatement, sans rechargement. Après « Enregistrer sur mon compte », la préférence est enregistrée dans la base via l’API et copiée dans `localStorage` sous une clé propre au compte actif. Au démarrage, le cache local affiche rapidement le thème ; l’API resynchronise ensuite la préférence du compte. La base reste la source de vérité et fournit le thème choisi lorsque la personne se connecte depuis un autre appareil. La notice de confidentialité décrit maintenant cette copie locale, qui ne contient ni donnée de santé ni secret d’authentification.

Le footer public comprend le watermark E‑CARNET, des liens d’aide et légaux, un retour en haut et un bouton d’installation PWA avec aide de secours. La sidebar desktop est repliable/dépliable avec icônes visibles en mode réduit ; les paramètres et leur fenêtre modale sont adaptés au mobile. La rubrique « Votre avis » est disponible dans les paramètres patient, professionnel et établissement. Le déclencheur flottant reste réservé au public et est masqué dans les espaces connectés et l’administration ; le formulaire et son API sont conservés. Les icônes de rubrique et la marque des entêtes utilisent le jeu SVG commun.

Les crédits précisent que **Redianice est une startup qui a contacté AKATech Studio pour proposer une collaboration**. Le thème et les autres réglages par défaut ne sont pas remplacés. Les salutations restent en mémoire de l’application uniquement.

Les paramètres patient proposent une **demande de suspension temporaire** (durée au choix : 1, 7, 14, 30, 60 ou 90 jours) et une **suppression immédiate du compte** (motif dans une liste ; « Autre » demande une précision). Après confirmation explicite, la suppression ne dépend d’aucun agrément admin : session et accès sont désactivés immédiatement, les identifiants et données de profil sont anonymisés, les autorisations d’accès sont révoquées, et les données déclaratives/préconsultations sont supprimées. Une trace anonymisée du motif apparaît dans l’administration. Les consultations validées et journaux d’audit immuables peuvent rester protégés afin de préserver l’intégrité de l’historique médical et les obligations applicables.

La console possède une sidebar de navigation, dont le bouton « Gestion des comptes » mène à la suppression immédiate des demandes anciennes encore en attente. L’endpoint refuse systématiquement les comptes staff/superadmins ; aucune fonction d’inscription publique ne peut créer un compte admin ou superadmin. Le lien « Administration » a été déplacé hors des paramètres vers la sidebar desktop et la barre de navigation mobile de l’espace patient ; il apparaît uniquement lorsque l’API signale `is_admin=true` et ouvre l’URL admin habituelle sans modifier son formulaire d’accès email/mot de passe. La gestion (suspension/suppression) du compte se trouve dans la modale « Sécurité et connexion » des espaces patient, professionnel et établissement. Les endpoints de consultation et de revue restent réservés au superadministrateur.

## Vérifications

- Tests web, légaux et site : **32 réussis, 0 échec**.
- Tests API Django : **141 réussis, 0 échec, 3 ignorés** (incluant la suppression immédiate, l’anonymisation et les garde-fous admin).
- Build de production Next.js : réussi.
- ESLint : aucune erreur ; quatre avertissements d’images d’avatar préexistants.
- Contrôle des dépendances : les versions déclarées de GSAP et Lenis sont inchangées.

Aucun déploiement n’a été effectué. L’archive de livraison exclut les fichiers d’environnement, dépendances installées, caches de build et archives ZIP imbriquées.
