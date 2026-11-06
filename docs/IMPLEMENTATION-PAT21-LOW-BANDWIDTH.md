# PAT-21 — faible débit et langage simple

État du lot local : **implémentation et contrôles CI ajoutés le 06/11/2026**. Cela ne vaut ni recette sur téléphone réel, ni validation utilisateur.

## Changements

- Les visuels WebP de la page d’accueil ont été recompressés à dimensions inchangées (941×1672 et 1672×941). Le mobile passe de 154 566 à 122 034 octets (−21,0 %) et le desktop de 149 334 à 117 518 octets (−21,3 %). Contrôle visuel fait : pas de différence évidente à l’affichage.
- Le logo de la carte d’urgence est maintenant servi depuis `/brand/project-logo.webp`. L’octet-à-octet a été comparé au fichier versionné Cloudinary : ce sont les mêmes 18 528 octets. Cela supprime une origine externe et son aller-retour réseau sur les écrans concernés.
- La pré-consultation affiche maintenant un état de chargement, une erreur explicite et un bouton de reprise pour le chargement initial. Son texte d’introduction et quelques confirmations ont été raccourcis.
- Après un échec ambigu d’envoi, les réponses restent visibles dans le formulaire et un bouton permet une reprise explicite. Avant tout nouvel envoi, le navigateur relit le brouillon côté serveur : s’il existe, il le met à jour au lieu de créer un doublon. Aucun envoi automatique, stockage persistant ou file d’écriture hors connexion n’est ajouté. Si le réseau est absent, la lecture de vérification échoue et aucune écriture n’est envoyée.
- Le formulaire de connexion affiche désormais le nom des fournisseurs près de leurs pictogrammes. L’intitulé de connexion a été simplifié.
- Le test e2e CI mesure les octets transférés, le nombre d’images et le délai jusqu’à un contenu utile visible, avec Pixel 5 émulé, Chromium, débit descendant 1,6 Mbit/s, montant 0,75 Mbit/s, latence 150 ms et CPU ralenti ×4. Les e2e CI démarrent le build de production après `next build`.

## Mesure de référence avant changement

Mesure locale, avant les changements, sur le build de l’archive, sous Chromium/Pixel 5 émulé et réseau/CPU simulés comme ci-dessus. Elle porte sur le premier rendu du site sans session ni API de staging ; la page d’urgence mesurée était donc son état serveur/API de référence, pas un parcours de soin réel.

| Route | Octets transférés | Images DOM | LCP |
|---|---:|---:|---:|
| `/` | 704 533 | 3 | 756 ms |
| `/connexion` | 336 969 | 1 | 2 916 ms |
| `/urgence/benchmark` | 242 588 | 0 | 748 ms |
| `/patient/consultations` | 315 823 | 1 | 636 ms |
| `/patient/acces` | 297 182 | 1 | 656 ms |
| `/patient/historique` | 438 089 | 1 | 636 ms |

Le nombre d’images est le nombre de sources distinctes présentes dans `document.images`. `/urgence/benchmark` était l’état de chargement/erreur sans réponse API ; le test CI fournit une carte fictive pour contrôler aussi le rendu réel de la carte. `/patient/consultations` a également été mesurée sans données patient réelles. Pour les écrans authentifiés, le test CI fournit des réponses fictives via interception réseau et attend le formulaire ou le QR correspondant.

## Budgets verrouillés en CI

| Parcours | Poids reçu max. | Images DOM max. | Délai contenu utile max. |
|---|---:|---:|---:|
| Accueil | 820 000 octets | 4 | 4,5 s |
| Connexion | 460 000 octets | 4 | 5 s |
| Carte d’urgence publique | 360 000 octets | 4 | 5 s |
| Pré-consultation | 450 000 octets | 4 | 6,5 s |
| QR temporaire | 470 000 octets | 4 | 3 s après la demande de génération |

Les seuils sont issus des mesures de référence avec une marge d’évolution ; ils seront à recalibrer si la CI ou les parcours changent sensiblement. Le test est un garde-fou reproductible, pas une mesure d’Android physique. Les budgets ne prouvent pas que les parcours sont lisibles ou compris par une personne donnée.

## Vérifications exécutées

- Build de production : réussi.
- TypeScript : réussi.
- Lint ciblé sur les fichiers de ce lot : réussi.
- Tests unitaires liés à l’interface de pré-consultation : 13/13 réussis.
- E2E PAT-21 sur le build standalone, Pixel 5 émulé : 4/4 réussis.
- Suite web complète : un échec restant hors PAT-21 dans `tests/boutons-gooey-aide.test.mjs:82` (assertion du centre d’aide).
- Lint global du dépôt : non vert ; 6 erreurs et 16 avertissements dans des fichiers hors du présent patch. Les fichiers modifiés ici passent le lint ciblé.

## À faire avant validation PAT-21

Exécuter cinq essais avec de vraies personnes sur mobile et réseau 4G, dont au moins une personne âgée. Observer sans guider : compréhension du consentement, distinction entre QR de carte d’urgence et QR temporaire de consultation, reprise après échec réseau, textes et libellés des pictogrammes. Consigner l’appareil, le réseau, les temps observés et les incompréhensions. Aucun essai utilisateur n’est déclaré réalisé par ce lot.

## ETA-13 — prérequis non levés

ETA-13 n’est **pas implémenté** dans ce lot, conformément à la consigne de séquencement : attendre la fin des vagues A et B et une décision sur le rôle autorisé à ouvrir un dossier. La lecture clinique reste derrière `ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ=false`. Aucun modèle, rôle, endpoint, migration, interface ou permission d’administrateur n’a été changé.
