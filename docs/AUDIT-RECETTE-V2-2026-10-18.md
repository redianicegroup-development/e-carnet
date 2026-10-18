# Audit et recette V2 — 18 octobre 2026

## Périmètre vérifié

La dernière version a été relue sur les parcours patient, professionnel et établissement. L’audit a porté sur la navigation regroupée, les états vides, les actions principales, les indicateurs, la progression de mise en route, les notifications, les permissions, les documents, les QR codes, les consultations et les exports.

## Améliorations livrées

### Tableaux de bord

Recharts était déjà présent dans le frontend. Trois visualisations ont été ajoutées ou reliées aux accueils existants :

- patient : répartition des déclarations, documents, vaccinations et visites ;
- professionnel : demandes, accès actifs et consultations ;
- établissement : professionnels actifs et rattachements en attente.

Les graphiques ne contiennent pas de détail médical. Ils affichent uniquement des compteurs administratifs ou des catégories générales. Ils sont responsives et possèdent un texte de remplacement lorsque les données sont vides.

### Actions principales et rappels

Les accueils possèdent maintenant des rappels contextuels lorsque :

- le patient a une demande d’accès ou une notification non lue ;
- le carnet essentiel n’a pas encore commencé ;
- le professionnel n’est pas rattaché ou n’a pas encore ouvert son accès clinique ;
- l’établissement n’est pas activé ou possède des demandes en attente.

Les états vides existants conservent leur formulaire ou leur action principale. Les plans de suivi vides proposent maintenant de préparer une consultation. Les notifications possèdent une ancre et une action de retour vers le parcours de consultation.

### Progression par rôle

- patient : progression des trois premières rubriques utiles — déclarations, documents et vaccinations ;
- professionnel : checklist existante renforcée par un rappel de rattachement ;
- établissement : progression de mise en route lorsque la structure n’est pas active.

### Notifications

Les notifications in-app existantes restent reliées aux événements d’accès et de carte d’urgence. L’accueil patient affiche le nombre de notifications non lues et renvoie vers leur emplacement. Les actions de lecture continuent d’utiliser l’endpoint protégé du patient.

## Tests réussis

- Django `check` : OK ;
- `makemigrations --check --dry-run` : aucune migration manquante ;
- suite backend ciblée : **250 tests réussis, 3 ignorés** ;
- lint frontend : OK ;
- TypeScript : OK ;
- tests frontend : **94 réussis** ;
- build Next.js : OK ;
- Playwright : **5 tests réussis, 1 scénario desktop ignoré volontairement car réservé au viewport mobile** ;
- recette mobile Playwright : pages publiques Accueil, Aide, Sécurité et FAQ sans débordement horizontal ;
- route privée : aucun retour serveur 5xx dans le smoke test local ;
- audit npm production : **0 vulnérabilité** signalée par `npm audit --omit=dev` ;
- syntaxe shell : OK pour les scripts vérifiés.

## Sécurité vérifiée par les tests existants

Les tests couvrent notamment :

- permissions patient et professionnel ;
- isolement entre patients ;
- autorisations et scopes ;
- expiration, révocation et prolongation ;
- QR opaque, durée de vie, usage unique et concurrence ;
- absence d’identifiant patient dans les payloads professionnels ;
- accès privé aux documents ;
- téléchargement protégé ;
- notifications rattachées au bon patient ;
- récupération de compte ;
- CSRF, sessions et réponses 401/403 ;
- journal d’accès et événements d’audit ;
- sauvegarde/restauration dans les tests locaux déjà présents.

## Limites constatées

La recette d’un vrai téléphone Android/iOS avec réseau mobile n’a pas été exécutée dans le sandbox. Playwright vérifie le viewport mobile et les pages publiques, mais ne remplace pas un test sur appareil réel.

La recette PostgreSQL isolée, le backup/restore destructif et le staging complet n’ont pas pu être exécutés ici, car Docker Compose n’est pas disponible dans cet environnement. Le script de garde a correctement produit un verdict `NO-GO` explicite pour cette partie, sans modifier de base réelle.

Les parcours authentifiés complets — création de compte, import Cloudinary réel, demande d’accès avec deux comptes, consultation professionnelle et export sur téléphone — doivent encore être rejoués sur un staging configuré avec les secrets et services réels. Les tests backend et les tests locaux couvrent leurs contrats, mais cette étape nécessite un environnement de recette connecté.

## Verdict

La version passe la validation locale frontend et backend. Les améliorations d’ergonomie demandées sont intégrées sans ajouter de branche de navigation inutile. Le projet est prêt pour une recette staging contrôlée, mais il ne faut pas déclarer une validation production tant que PostgreSQL managé, Cloudinary réel, SMTP, sauvegarde/restauration, appareils mobiles et validation juridique/médicale n’ont pas été signés.
