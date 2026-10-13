# Flow établissement et rattachement médecin

**Décision du porteur : 05/10/2026 — version 3, amendée le 08/10/2026 (conditions, résiliation, données médicales et cloisonnement).** Cette note est la référence métier pour l’accès établissement en V1. Le rôle « Root » global n’est pas retenu; on parle d’**administrateur établissement**.

## Résumé

L’établissement ne se crée pas son compte et ne téléverse pas ses justificatifs sur la landing page. Il contacte l’équipe E‑Carnet par e-mail et envoie les preuves demandées. L’équipe vérifie manuellement la structure, puis un administrateur E‑Carnet utilise une route interne protégée pour créer l’établissement et son accès nominatif. Le responsable reçoit un lien d’invitation à usage unique valable 48 heures et choisit lui-même son mot de passe. Depuis son espace privé, l’administrateur génère un code médecin temporaire (48 heures, usage unique). Le code initie une demande de rattachement; l’établissement doit ensuite accepter cette demande. Ni invitation ni code ne confèrent seuls un accès clinique.

## Parcours 1 — demande, vérification et accès de l’établissement

1. **Contact hors application :** l’hôpital/la clinique est invité à écrire à l’adresse officielle E‑Carnet et à envoyer les documents de la structure, son identité et celle de son responsable. La landing page ne propose ni création libre de compte établissement ni upload public de justificatifs.
2. **Contrôle interne :** l’équipe E‑Carnet examine l’existence de la structure, ses preuves légales, son identité et son responsable. Les preuves restent traitées dans le canal interne de l’équipe; la V1 ne les stocke pas dans l’espace web public. La règle de rétention et de sécurité de la boîte e-mail reste à formaliser.
3. **Action interne :** un administrateur E‑Carnet, authentifié et autorisé, ouvre la console privée, inscrit la décision (validation/refus) et, après validation seulement, lance **Créer l’accès**. Chaque action est attribuée à l’employé et horodatée.
4. **Compte nominatif :** l’établissement est une entité stable, séparée de la personne qui l’administre. En V1, un seul administrateur principal nominatif est activé par structure; aucun identifiant/mot de passe commun. L’association de l’administrateur peut être remplacée ultérieurement sans recréer l’établissement. Le modèle pourra accueillir d’autres administrateurs dans une version future, mais leur activation multiple est hors périmètre V1.
5. **Invitation :** le backend envoie un lien sécurisé lié à l’établissement et à l’adresse professionnelle nominative validée. Il est à usage unique et expire après **48 heures**. Le destinataire définit son mot de passe sur la page d’activation. Le mot de passe n’est jamais envoyé par e-mail; dès consommation ou expiration, le lien est inutilisable. Une invitation expirée exige une nouvelle émission par l’administration E‑Carnet.
6. **Espace privé :** après activation, l’administrateur se connecte à une route établissement authentifiée. Il peut gérer les codes et demandes d’affiliation, les informations de sa structure et les rattachements autorisés; il ne peut ni demander ni consulter les dossiers médicaux au titre de cette fonction.

## Parcours 2 — code et affiliation médecin

1. Le médecin possède déjà son compte **Professionnel** E‑Carnet et n’a pas besoin d’une identité séparée pour l’établissement. Il déclare son rôle/spécialité dans une liste de sélection; l’option « Autre » peut ajouter une spécialité à la liste partagée. Ces valeurs sont déclaratives, non certifiées par E‑Carnet.
2. L’administrateur établissement vérifie le médecin **en interne, entre la structure et le médecin**. E‑Carnet ne demande pas et ne collecte pas les justificatifs personnels/professionnels du médecin dans ce flow.
3. L’établissement génère un code aléatoire associé à sa structure : durée **48 heures**, usage unique. Le code est un moyen d’initier une demande, pas une preuve d’accès direct; il ne révèle aucune donnée clinique. Stocker sa valeur sous forme de hash, permettre son expiration/révocation et ne pas l’écrire dans les logs.
4. Le médecin lit et accepte explicitement les conditions de rattachement versionnées, puis saisit le code dans son espace Professionnel. Sans acceptation de la version courante, le code n’est pas consommé. Le backend enregistre la version, l’horodatage UTC, le médecin et le rattachement dans la base et l’audit; il consomme ensuite le code une seule fois et crée une **demande de rattachement `pending`** liée au médecin et à la structure. Il n’active pas le rattachement automatiquement. Si la demande est refusée ou si le code expire, l’établissement doit générer un autre code.
5. L’établissement vérifie le médecin et ses justificatifs en interne, selon ses propres procédures. Son administrateur nominatif accepte ou refuse ensuite la demande. L’application journalise cette décision de rattachement; elle ne valide pas elle-même le diplôme, l’identité médicale ou la spécialité.
6. Une fois rattaché, le médecin peut choisir cette structure comme établissement actif. Les demandes/lectures de dossiers demeurent soumises aux contrôles professionnels, au périmètre AccessGrant et au consentement du patient. Le compte établissement ne voit pas les dossiers.

## Résiliation et conservation du rattachement — décision du 08/10/2026

- L’établissement peut mettre fin à un rattachement actif depuis son espace privé (fin de contrat/rattachement). Le médecin peut aussi y mettre fin depuis son espace professionnel, conformément au processus interne de la structure.
- Dans les deux cas, l’accès clinique futur lié à ce rattachement est immédiatement bloqué et l’établissement actif est désélectionné. L’action est horodatée et attribuée à son auteur dans l’audit.
- La fin du rattachement ne supprime ni le médecin, ni l’établissement, ni le rattachement historique, ni les consultations/dossiers déjà créés. Elle n’autorise pas pour autant un accès rétrospectif automatique : les consultations et dossiers restent soumis à leurs propres règles d’accès.
- Le texte proposé au médecin est versionné dans [CONDITIONS-RATTACHEMENT-MEDECIN.md](CONDITIONS-RATTACHEMENT-MEDECIN.md). Il est accepté au moment de la validation du code dans l’espace médecin. **Il s’agit d’un projet fonctionnel, à faire valider juridiquement avant un usage contractuel réel.**

## Identité, autorisations et historique

- **Pas de rôle Root global.** L’accès privé établissement est porté par une relation nominative `administrateur ↔ établissement`; le compte de la personne et l’entité établissement sont distincts. Réutiliser `AccountContext(role="establishment")` est envisageable pour l’UX, mais la relation à la structure doit être explicite et vérifiée côté serveur.
- **Un administrateur principal en V1.** L’association doit être remplaçable en gardant le même enregistrement d’établissement; prévoir une relation/adhésion plutôt qu’un `created_by` immuable comme seule autorité. Les anciennes associations restent historisées.
- **Pas de justificatif médecin sur E‑Carnet.** L’approbation de la demande par l’établissement est la vérification institutionnelle et l’autorisation d’affiliation pour cette structure. Le prérequis global `ProfessionalProfile.verification_status == "verified"` et sa file startup sont retirés du parcours actif. L’accès clinique dépend d’une affiliation active à la structure sélectionnée, sans qu’un document personnel ni numéro professionnel soit demandé par E‑Carnet. Le consentement patient reste une condition distincte et obligatoire.
- **Historique non destructif.** Ne pas supprimer une structure, un admin, un code consommé/expiré, une demande ou un rattachement pour effacer une trace. Une fin d’accès passe par révocation/suspension horodatée, et les événements métier restent consultables aux personnes autorisées. Le compte d’un ancien administrateur peut être désactivé pour cette structure sans récréer celle-ci.
- **Événements à tracer :** décision de vérification de structure et son auteur; création/refus de l’accès; invitation créée, renvoyée, révoquée, consommée ou expirée; activation du compte; code généré/expiré/révoqué/consommé; demande médecin; acceptation/refus; changement d’administrateur; suspension/réactivation d’affiliation. Ne pas mettre dans l’audit les secrets d’invitation/codes, mots de passe, justificatifs ou données cliniques inutiles.

## Données cliniques et concurrence — ajout du 08/10/2026

- Chaque pré-consultation nouvellement créée est liée par clé étrangère à un établissement actif sélectionné par le patient; le libellé est repris du registre serveur, jamais du texte libre soumis par le navigateur.
- Avec un consentement actif pour l’établissement B, un professionnel de B ne peut lire que les pré-consultations clôturées rattachées à B. La même règle est appliquée au moment de valider une consultation. Les anciennes lignes sans établissement restent visibles au patient mais ne sont jamais retournées au professionnel (fail closed); elles doivent être recréées/qualifiées par le patient avant partage.
- Toute lecture clinique autorisée produit un événement d’audit minimisé et visible dans l’historique patient; aucun motif, observation ou conclusion n’est copié dans les métadonnées d’audit.
- Acceptation, refus, prolongation et révocation d’un AccessGrant sont sérialisés par verrou de ligne PostgreSQL (`select_for_update`). Une révocation gagnante est terminale face à une prolongation concurrente.
- Les numéros professionnels ne sont plus acceptés ni retournés par les API/web. La colonne historique `professional_identifier` reste présente par prudence de migration, n’est plus accessible par le parcours courant; une purge de données déjà existantes doit suivre une décision de conservation et une sauvegarde préalables.

## Sécurité de la route privée

Une URL non devinable ne suffit pas. La console E‑Carnet doit exiger une session authentifiée, un contrôle serveur de permission staff dédiée, des vérifications CSRF, une séparation entre actions startup et actions établissement, et des journaux d’audit. Chaque requête doit autoriser la ressource sur la structure associée au compte, sans confiance dans un identifiant transmis par le navigateur. Les écrans et API établissement ne sont jamais ouverts à une inscription publique.

## Cible V3 — continuité du dossier entre établissements (A → B)

Ce parcours est une **évolution proposée pour V3**. Il ne change pas la règle V1 : l’établissement n’a pas d’accès clinique direct et la lecture par un professionnel exige un rattachement actif, un établissement sélectionné et le consentement requis.

1. Lorsqu’un patient se présente à l’établissement B, un professionnel authentifié et activement rattaché à B peut initier une demande ciblée de continuité de soins. La recherche ne doit pas exposer un annuaire permettant d’énumérer les patients; le patient est identifié par une preuve à concevoir (session patient ou code/QR à durée limitée), pas par une simple recherche de nom.
2. Le patient voit le professionnel, l’établissement B, les catégories demandées, la finalité et la durée. Il peut accorder ou refuser; le périmètre est minimal et distinct du consentement déjà donné à l’établissement A. Si le patient ne peut pas consentir, aucun contournement implicite : une procédure d’urgence/légale distincte doit être décidée et validée avant toute implémentation.
3. Les informations médicales restent d’abord dans le dossier maître du patient. Après la pré-consultation et la consultation, B peut, si le patient l’a autorisé, conserver une **copie/trace de suivi en lecture seule** limitée au séjour. Elle est liée à son origine A, à l’auteur professionnel, à B, à la version consultée et à l’autorisation.
4. Ni l’administrateur de B ni ses utilisateurs ne peuvent modifier ou effacer l’original du patient ou la copie horodatée. Une rectification se fait par ajout d’un nouvel addendum signé/attribué et audité; le contenu antérieur et sa provenance restent visibles. Le dossier patient reste la source de vérité, et une copie locale n’est jamais réimportée comme si elle était l’original.
5. L’expiration/révocation bloque les lectures futures du dossier distant. Les obligations de conservation, rectification et effacement d’une copie déjà versée au dossier de B doivent être définies par contrat et validées juridiquement; ne pas promettre sa suppression à distance. Journaliser la demande, le choix du patient, les lectures, la création/export de copie et les addenda, sans dupliquer inutilement du contenu clinique dans les logs.

Avant d’engager le développement : concevoir le modèle de consentement inter-établissements, le format du résumé/copieur, l’authentification du patient, les contrôles d’accès par professionnel (pas seulement par établissement), la durée/périmètre, l’audit immuable, les règles de conservation, et la réponse aux situations d’urgence. Voir aussi [la roadmap produit V1–V5](ROADMAP-V1-V5.md#v3--services-cliniques-et-intégrations-conditionnels).

## État historique au 05/10/2026

À cette date, le dépôt avait implémenté le flow principal : la création publique historique est neutralisée (`403`), les routes staff sont protégées par `IsAdminUser`, l’entité établissement est séparée de `EstablishmentAdministrator`, les invitations sont hashées et valables 48 h, les codes médecin sont hashés et à usage unique pendant 48 h, et l’administrateur établissement décide du rattachement. Les pages web correspondantes sont présentes. Les mises à jour suivantes ci-dessous et les rapports du 08/10 font foi pour l’état plus récent.

État au 08/10/2026 : API staff ne renvoyant jamais le jeton d’invitation, envoi par e-mail via SMTP configurable, conditions d’accès versionnées et acceptation enregistrée au serveur, résiliation possible par l’établissement ou le médecin sans suppression d’historique. La suite complète passe sur PostgreSQL 16 local (voir preuve de recette). Restent SMTP réel/staging, politique de rétention, validation juridique, tests/staging, protection PostgreSQL de TRUNCATE pour l’audit et preuve opérationnelle d’absence d’accès clinique établissement.

## État de livraison et gates restants — 08/10/2026

Le flow API/UI décrit dans cette note est livré, y compris invitations e-mail SMTP configurables, conditions de rattachement versionnées, résiliation par les deux côtés et conservation des traces. La preuve PostgreSQL 16 locale du 08/10 couvre 77 tests ; voir [rapport de tests](../reports/postgres-tests-20261008.txt).

Restent à valider sur l’instance de staging : SMTP et délivrabilité, permissions staff/établissement et preuve d’absence d’accès clinique pour le compte établissement, sécurité PostgreSQL `TRUNCATE`/privilèges runtime, rétention juridique des preuves reçues par e-mail et scénarios réels de renouvellement/révocation. La preuve locale ne vaut pas recette de déploiement.

**Gate de validation :** aucune donnée clinique réelle avant la recette staging, la validation des permissions et de l’audit, l’approbation des règles de conservation et le Go/No-Go formel.
