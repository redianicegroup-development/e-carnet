# Mon Carnet Numérique — dossier de revue juridique V3

**Version de travail remise au conseil juridique — 10 octobre 2026**  
**Statut : document préparatoire, non validé juridiquement et non publiable tel quel.**  
**Périmètre : Côte d’Ivoire, version de test V1/V2 et préparation d’une éventuelle V3.**

> Ce dossier n’est ni un avis juridique, ni une déclaration de conformité, ni un contrat. Les textes proposés plus bas sont des bases de rédaction à compléter et à valider par un juriste ivoirien avant affichage ou acceptation. Aucun nom d’entreprise, adresse, numéro d’immatriculation, base juridique, durée de conservation ou adresse de contact n’a été inventé.

## 1. Réponse courte sur la stratégie

**Oui, le découpage envisagé est raisonnable**, à condition de le décrire comme un dispositif de test, pas comme une géolocalisation ivoirienne déjà acquise ni comme une validation juridique. Les documents du projet disent que V1/V2 servent aux tests sur Vercel, Render et Neon, avec des données fictives, sans ouverture au grand public. Le NO-GO de recette demeure : le dépôt ne contient pas de preuve d’un staging réel accepté, ni d’une validation juridique ou médicale.[^p1]

Pour ces essais, garder uniquement des données synthétiques, limiter les accès aux personnes autorisées, ne pas saisir de vrai dossier de santé et ne pas utiliser de vrais justificatifs d’établissement. Des identifiants de test doivent eux aussi être fictifs lorsque cela est possible : une adresse personnelle, une adresse IP ou des journaux de connexion peuvent rester des données personnelles, même si le contenu médical est inventé.

Pour V3, **Hodi peut être une bonne piste pour rapprocher l’hébergement principal de la Côte d’Ivoire**, mais la page fournie pointe vers « Site Pro », pas vers un VPS. Hodi indique pour Site Pro un datacenter à Grand-Bassam, et indique aussi que la sauvegarde de cette offre part vers un autre datacenter en Europe.[^h1] Les conditions générales de Hodi décrivent également une sauvegarde quotidienne de 30 jours vers l’Allemagne pour les offres d’hébergement web et e-mail concernées.[^h2] Donc, **avec l’offre Pro du lien, on ne peut pas promettre que toutes les copies de données restent en Côte d’Ivoire**.

Hodi publie séparément des offres VPS en Côte d’Ivoire. Sa page VPS non managé indique un datacenter à Grand-Bassam et des sauvegardes dans un autre datacenter local ; sa page VPS managé annonce une sauvegarde quotidienne de sept jours, sans préciser publiquement sur cette page le lieu de la copie.[^h3] Cela rend le VPS local **plus cohérent à étudier** si la règle produit est « données et sauvegardes en Côte d’Ivoire », mais ce n’est pas encore une preuve suffisante. Il faut obtenir une confirmation écrite de Hodi sur le produit précis, les sauvegardes, les journaux, les accès d’assistance, les sous-traitants, les lieux de traitement et la suppression en fin de contrat. La DPA publiée par Hodi décrit un rôle de sous-traitant pour le contenu hébergé et s’appuie notamment sur des références RGPD ; elle ne tranche pas à elle seule les formalités ivoiriennes ni la conformité du projet.[^h4]

Enfin, l’offre Hodi Site Pro annoncée dans le lien est un hébergement web avec ressources multi-clients. Même si la page mentionne Node.js, Python et PostgreSQL, il faut vérifier avant de choisir qu’elle permet réellement d’exécuter l’architecture du dépôt : Next.js, Django/ASGI, processus persistants, PostgreSQL de production, tâches et sauvegardes isolées, réseau privé, restauration testée et déploiement sécurisé. Un VPS managé peut diminuer la charge d’administration ; un VPS non managé donne davantage de contrôle, mais transfère à l’équipe l’exploitation et une part importante de la sécurité.

## 2. Ce qui est décidé, ce qui est en cours et ce qui reste ouvert

### Décisions produit déjà inscrites dans le dépôt

- **V1/V2 :** essais privés, données fictives uniquement, pas de lancement au grand public. La pile retenue pour les tests est Vercel (web), Render (API) et Neon (PostgreSQL). Les régions effectives, copies, contrats et sous-traitants de ces services restent à vérifier ; cette pile ne doit donc pas être présentée comme une conservation en Côte d’Ivoire.[^p1] [^p2]
- **Rôles et onboarding :** l’inscription publique propose Patient ou Professionnel ; l’espace Établissement est privé et nécessite un administrateur nominatif ; aucune inscription publique d’établissement ni de rôle Root global en V1. Le parcours recueille d’abord l’identité, puis le rôle et un formulaire adapté. Pour le profil patient, les champs décidés incluent date de naissance et téléphone facultatif ; l’avatar est modifiable par URL, sans téléversement de fichier. Ces données et le chargement d’une image externe doivent figurer dans l’analyse de confidentialité.[^p2]
- **V3 :** l’hébergement ivoirien est une orientation à étudier, pas un choix arrêté. Le journal produit demande encore une décision formelle sur la localisation et les transferts.[^p2]
- **Accès clinique :** l’espace établissement ne consulte pas les dossiers. Un professionnel doit avoir un rattachement actif, un établissement actif et une autorisation patient active. Le médecin est rattaché par décision de l’établissement ; E-Carnet n’est pas censé vérifier ses justificatifs personnels.[^p2] [^p3]
- **Accès patient :** l’accord est limité dans le temps ; durée initiale de deux heures, deux prolongations d’une heure au plus, avec révocation. Le QR est opaque, à usage unique et valable cinq minutes. Les périmètres V1 sont décidés : pré-consultation et déclarations par défaut, consultations sélectionnables, documents hors V1.[^p2] [^p3]
- **Compte et fournisseurs d’identité :** e-mail/mot de passe, Google, Facebook et Apple ; un seul compte peut lier plusieurs fournisseurs uniquement après authentification explicite. Pas de fusion silencieuse sur la seule base d’une adresse e-mail. Les identifiants et essais réels de ces fournisseurs restent à faire.[^p2]
- **MFA/TOTP et SMS :** reportés à V3 selon les décisions produit. Ne pas afficher ces fonctions comme disponibles en V1/V2.[^p2]
- **Rattachement médecin :** les conditions versionnées `2026-10-08-v1` sont acceptées explicitement et horodatées, mais le document avertit qu’il ne constitue pas à lui seul un contrat complet.[^p3]

### Registre complet des décisions A1–A16 (journal du 8 octobre 2026)

Le journal A1–A16 contient des **décisions produit et architecture**, pas une validation juridique ou médicale. Voici chacune, avec ce qui est décidé et ce qui reste à faire :

1. **A1 — OTP WhatsApp : décidé, exclu.** Ne pas ajouter de connexion ou de validation WhatsApp.
2. **A2 — Authentification : décidé.** E-mail/mot de passe, Google, Facebook, Apple ; compte unique, liaison/déliaison explicite après connexion, sans fusion automatique par e-mail. Les callbacks et l’interface sont présents ; identifiants réels, URL de rappel et essais chez les fournisseurs restent à configurer et tester. Le SMS est reporté à V3.
3. **A3 — MFA et récupération :** MFA/TOTP reporté à V3 et ne bloque pas V1. Les règles détaillées de récupération du compte restent ouvertes ; aucun contournement ad hoc ne doit être ajouté.
4. **A4 — Création d’un espace établissement : décidé.** La structure envoie ses justificatifs par e-mail à l’adresse officielle d’E-Carnet ; un membre du staff examine les pièces sur une route privée puis crée un administrateur principal nominatif après validation. Pas de dépôt public des justificatifs. Invitation unique valable 48 h ; le destinataire choisit son mot de passe. La sécurité, les personnes ayant accès et la rétention des pièces reçues par e-mail restent à décider.
5. **A5 — Administrateur d’établissement : décidé.** Aucun accès clinique en V1 depuis son espace. Il gère l’établissement et les rattachements ; les demandes et lectures cliniques restent dans le contexte professionnel, avec l’autorisation du patient.
6. **A6 — Médecin et rattachement : décidé.** E-Carnet ne collecte pas les justificatifs personnels du médecin. L’administrateur de l’établissement émet un code à usage unique valable 48 h ; la saisie crée une demande `pending` ; l’établissement accepte ou refuse. Cette acceptation est une validation institutionnelle du rattachement **à cette structure**, pas une certification générale du médecin par E-Carnet. Le texte des conditions d’accès reste à faire valider par le juriste.
7. **A7 — Aide à la pré-consultation : décidé pour V1.** Aucun compte infirmier. Une personne peut éventuellement aider dans le compte du patient sans authentification ou droit autonome prévu. La pratique de cette aide et les règles de l’établissement doivent être confirmées si le produit évolue ; ne pas laisser croire qu’un infirmier possède un rôle ou un accès dédié.
8. **A8 — Champs de pré-consultation : ouvert médicalement.** Champs, unités, bornes, caractère obligatoire/facultatif, antécédents et documents doivent être validés par un référent médical avant usage clinique.
9. **A9 — QR et périmètres d’accès : décidé et implémenté au niveau du contrat V1.** QR opaque, à usage unique, sans données médicales, valide 5 minutes. `preconsultation` et `declarations` par défaut ; `consultations` sélectionnable ; `documents` exclus de V1. L’UUID patient doit encore être saisi séparément après le scan ; l’utilité et la présentation de cette double étape restent à recetter.
10. **A10 — Champs de consultation : ouvert médicalement.** Définir les champs communs et facultatifs ainsi que la correction après signature/validation ; faire valider le résultat par le référent médical et le juriste.
11. **A11 — Justificatifs et documents : partiellement décidé.** Pas de justificatifs personnels du médecin transmis à E-Carnet ; ils restent entre médecin et établissement. Les justificatifs de la structure arrivent par e-mail à E-Carnet. Les documents médicaux ne sont pas accessibles via le scope V1 `documents`. La boîte de réception et les preuves de structure exigent encore des règles de sécurité et de conservation.
12. **A12 — Architecture d’essai V1/V2 : décidé.** Vercel pour le web, Render pour l’API et Neon pour PostgreSQL. La région réelle, les emplacements des copies et sauvegardes, les contrats, les coûts et la restauration managée restent à vérifier. Une restauration locale isolée a été testée ; ce n’est pas une preuve de restauration sur la base de staging.
13. **A13 — Hébergement ivoirien : non décidé.** Choisir et vérifier la cible avant toute donnée réelle. « Données fictives uniquement » reste la règle du pilote.
14. **A14 — Droit local : ouvert.** Obtenir un avis écrit d’un juriste ivoirien et traiter les formalités nécessaires. Aucune conclusion de conformité ne doit être déduite de la seule localisation de l’hébergement ou du présent dossier.
15. **A15 — Conservation, correction, export et suppression : ouverts.** Le juriste doit fixer les durées et règles. L’historique/audit ne doit pas être supprimé silencieusement ; distinguer correction du dossier, suppression demandée par la personne, fin de compte, sauvegardes et conservation légale.
16. **A16 — Incidents et notifications : ouverts.** Définir qui qualifie un incident, seuils, délais, confinement, personnes/autorité à contacter et répartition des responsabilités.

### Éléments en cours ou non prouvés

- La V1 est « en construction, non acceptée et non autorisée pour des données de santé réelles ». Le dernier état de recette rapporté est **77 tests réussis sur PostgreSQL 16 local** et une restauration locale isolée réussie le 8 octobre. Cela ne prouve ni le staging Neon/Render/Vercel, ni un RPO/RTO opérationnel, ni une recette signée.[^p1] [^p4]
- Le parcours QR côté professionnel demande encore l’identifiant patient séparément du jeton QR. La promesse marketing « en un scan » est donc à nuancer ou à corriger avant diffusion.[^p4]
- Les identifiants OAuth, la configuration e-mail/SMTP et les essais de bout en bout en staging ne sont pas démontrés.[^p1] [^p4]
- Le dernier rapport décrit un smoke Chromium local sur six routes, mais la recette Android/iOS/4G et l’audit WCAG 2.2 AA complet restent à faire. Le rapport de build et les audits de dépendances de début octobre ne sont pas rejoués dans la dernière mise à jour ; les anciennes mentions de vulnérabilités npm ou de dépréciation Authlib doivent être réévaluées, pas prises pour l’état actuel.[^p1]
- Les durées de conservation, la purge des pièces de structure envoyées par e-mail, les demandes de droits, l’incident, les mineurs/représentants, l’urgence et la portée de l’attestation SVG ne sont pas arrêtés.[^p2] [^p3]
- Le nom juridique de l’exploitant, ses coordonnées et les responsabilités exactes entre E-Carnet, patient, professionnel et établissement ne sont pas indiqués dans les textes publics du dépôt.

### Décisions attendues du porteur et du juriste

1. Identifier l’exploitant et les parties. Déterminer qui décide des finalités et des moyens de chaque traitement, et si les rôles diffèrent entre données de compte, dossier patient, établissement et journaux.
2. Vérifier auprès de l’Autorité de protection ivoirienne les formalités applicables avant traitement, notamment pour les informations de santé et les transferts hors du pays ou de l’espace CEDEAO. L’Autorité publie des formulaires distincts de déclaration préalable, d’autorisation préalable et de transfert hors CEDEAO ; le juriste doit dire lequel s’applique à chaque flux.[^j1] [^j2]
3. Définir les finalités, les catégories de données, les bases ou conditions juridiques, les destinataires, les droits et les délais de conservation, y compris après clôture du compte et pour l’audit.
4. Valider l’information présentée avant collecte, l’acceptation des conditions, les consentements d’accès clinique et leur preuve. Traiter explicitement mineurs, représentants légaux, personne aidant à la saisie et urgence.
5. Fixer les règles de rectification et de suppression sans promettre l’effacement intégral de dossiers ou de traces qui devraient être conservés. Établir un mécanisme d’exercice des droits et une adresse de contact.
6. Qualifier juridiquement le rôle de chaque fournisseur et documenter les contrats, sous-traitants ultérieurs, transferts, sauvegardes, journaux et conditions de réversibilité.
7. Définir la portée de « vérifié », « validé », « signé », « audit append-only », « aucune donnée réelle » et « révocable à tout moment » avant de conserver ces promesses à l’écran.
8. Approuver les durées et la procédure de réponse à incident, y compris qui décide et qui contacte les personnes et l’autorité compétente.

L’Autorité ivoirienne indique publiquement que le responsable doit accomplir une déclaration ou demander une autorisation préalable selon le cas, informer les personnes de l’identité du responsable, des données, des finalités, des destinataires, de la durée et des transferts, et organiser les droits d’accès, de rectification et d’opposition.[^j1] Sa page consacrée aux droits mentionne également, dans les cas prévus, la suppression et l’effacement.[^j3] **Le dossier ne conclut pas quelle formalité est exigée pour le produit : c’est précisément une question à faire trancher avant tout traitement réel.**

## 3. Cartographie des textes du frontend

L’inventaire du dépôt compte 32 routes de pages. Les liens publics et les formulations les plus importantes pour le juriste sont détaillés ci-dessous. Les écrans privés doivent également être relus, car ils affichent des promesses au moment où le patient ou le professionnel prend une décision.

### Pages publiques et parcours d’inscription

- **`/` — accueil :** « Votre santé, dans un carnet que vous seul décidez d’ouvrir » ; le site affirme qu’aucun professionnel ne voit le carnet sans accord, que chaque lecture et décision est enregistrée, et que la validation provient du médecin. Le parcours dit que le médecin scanne le QR « en un scan ». À vérifier : l’exhaustivité des journaux selon chaque lecture, la portée de « aucun » et « à tout moment », et le fait que l’interface pro demande toujours l’identifiant du patient en plus du QR. La page promet aussi deux heures d’accès, prolongeables deux fois une heure, et une absence de données de santé réelles pendant le pilote.[^p5]
- **`/a-propos` :** « Un carnet durable, sous le contrôle du patient » ; l’accès est annoncé comme conditionné à la vérification, au rattachement, à un établissement actif et au consentement explicite. Le MFA est annoncé comme reporté en V3. Définir qui « vérifie » le professionnel : l’établissement, et non E-Carnet, selon la décision A6.[^p2] [^p6]
- **`/faq` :** indique qu’un professionnel ne voit pas le carnet automatiquement, annonce deux heures d’accès avec au plus deux prolongations d’une heure et une révocation possible, précise qu’il n’existe pas de compte ou d’écran infirmier, et affirme qu’aucune donnée médicale ni réponse d’API n’est mise en cache hors ligne. La page ne répète pas elle-même que les données du pilote sont fictives. Faire préciser la place d’un proche ou d’un infirmier qui aide à saisir des informations sans compte.[^p6]
- **`/securite` :** affirme que chaque demande sensible est contrôlée côté serveur, que l’audit des transitions sensibles est « append-only », qu’il y a isolation entre établissements et aucun cache hors ligne de données médicales. La page reconnaît que l’hébergement ivoirien, la revue juridique, la restauration et les contrôles indépendants restent à faire avant les données réelles. Garder cette réserve visible ; faire correspondre les affirmations au contrôle réellement démontré en staging.[^p1] [^p7]
- **`/v1` :** contient « V1 stable et utilisable », « socle sûr », « prête à être présentée comme socle fiable et utilisable » et « toute lecture ou validation reste auditable ». Ces formulations contredisent le NO-GO de recette. **À retirer ou réécrire avant tout partage externe** pour dire clairement : version de test, recette incomplète, données fictives uniquement.[^p1] [^p8]
- **`/conditions-rattachement` :** six engagements de confidentialité, exactitude des données, sécurité des accès et fin de rattachement ; version `2026-10-08-v1`. L’acceptation ne donne pas à elle seule accès aux dossiers. La page indique que l’identité des parties, la responsabilité, la durée, la conservation et la signature restent à valider. Ce texte doit être relu comme un accord professionnel distinct des CGU générales.[^p3]
- **`/inscription` et `/connexion` :** prénom, nom, e-mail, mot de passe et options de connexion Google, Facebook et Apple. Au moment de l’inspection, le composant d’inscription ne présente pas de lien vers une politique de confidentialité/CGU ni de case d’acceptation. Le juriste et le produit doivent décider quel avis et quelle preuve d’acceptation sont nécessaires au bon moment.[^p9]
- **Pied de page public :** liens actuels : À propos, Sécurité, FAQ, Connexion. Il rappelle : « Pilote en cours : l’application ne contient aucune donnée de santé réelle. Ce site ne remplace pas un avis médical. » Il n’y a pas de lien visible vers des mentions légales, une politique de confidentialité, des CGU ou une page cookies.[^p10]

### Écrans authentifiés à relire avec les pages juridiques

- **Espace patient** (`/patient`, `/patient/carnet`, `/patient/acces`, `/patient/consultations`, `/patient/parametres`) : données déclarées par le patient, allergies, antécédents, traitements, pré-consultation, consentement/refus, durée, périmètre, prolongation, révocation et historique d’accès. Le texte doit distinguer une déclaration patient d’une information constatée par un professionnel.
- **Espace professionnel** (`/professionnel`, `/professionnel/acces`, `/professionnel/consultations`, `/professionnel/patients`, `/professionnel/etablissements`, onboarding et paramètres) : demande d’accès, périmètre, durée, établissement, conclusion et conduite à tenir, attestation SVG et horodatage. Faire valider la portée de « validation » et de « signature », les corrections et l’identité présentée au patient.
- **Espace établissement** (`/etablissement` et ses sous-pages) : gestion d’un administrateur nominatif et des rattachements, sans accès clinique selon la décision produit. La preuve de l’établissement est transmise hors application par e-mail à l’équipe ; la boîte, ses accès, sa sauvegarde et sa durée de purge restent à définir.[^p2]
- **Espace staff** (`/staff/etablissements`, `/staff/medecins`) : validation interne de l’établissement et traitement des rattachements. Examiner les libellés « vérification médecin » et « vérifié » afin qu’ils ne laissent pas penser qu’E-Carnet certifie l’identité ou la compétence médicale.
- **Onboarding** (`/onboarding`, `/onboarding/identite`, `/onboarding/patient`, `/professionnel/onboarding`) : identité, avatar par URL, profil patient ou professionnel. Une URL d’avatar peut transmettre l’adresse IP du visiteur à un hôte tiers lors du chargement ; décider si cette fonctionnalité doit être limitée, expliquée ou remplacée par un hébergement interne.[^p11]
- **`/etablissement/aide`** : expliquer clairement que l’administrateur gère les rattachements et n’accède pas aux dossiers ; éviter les promesses de conservation indéfinie lorsque les durées ne sont pas décidées.

### Index exhaustif des 32 routes frontend

Les six premières pages publiques sont citées textuellement plus haut. Cet index ajoute **toutes les routes de l’archive** pour que le juriste puisse contrôler le parcours complet. Dans les espaces privés, les textes affichés proviennent parfois d’un composant partagé plutôt que du fichier `page.tsx` ; le composant indiqué doit être inclus à la relecture. Les éléments décrits ci-dessous sont le sujet de la page et les questions à vérifier, pas une certification qu’une promesse particulière est déjà vraie.

#### Public, connexion et onboarding

- **`/`** — accueil/landing : promesses « sous votre contrôle », « en un scan », accès et historique ; texte exact résumé plus haut.
- **`/a-propos`** — principe du carnet, titulaire patient, rattachement et provenance ; texte exact résumé plus haut.
- **`/faq`** — accès automatique, durée, infirmier et hors-ligne ; réponses exactes résumées plus haut.
- **`/securite`** — sessions, contrôle serveur, audit, isolation et limites du pilote ; texte exact résumé plus haut.
- **`/v1`** — périmètre, statut « stable et utilisable », audits et promesses de disponibilité ; incohérence avec le NO-GO notée plus haut.
- **`/conditions-rattachement`** — engagements du médecin, version acceptée et portée de la validation ; texte exact résumé plus haut.
- **`/inscription`** — prénom, nom, e-mail, mot de passe et connexion par fournisseur ; liens d’information/acceptation à déterminer.
- **`/connexion`** — accès au compte patient/professionnel et fournisseurs d’identité ; expliquer clairement la connexion et éviter de confondre l’authentification d’un fournisseur avec une validation médicale.
- **`/onboarding`** — choix du rôle après identité ; expliquer la différence Patient/Professionnel et les conséquences de ce choix.
- **`/onboarding/identite`** — prénom, nom et avatar par URL ; préciser la finalité, le caractère modifiable et le chargement potentiel d’image depuis un tiers.
- **`/onboarding/patient`** — formulaire du profil patient, dont date de naissance et téléphone facultatif selon la décision produit ; faire valider chaque champ et afficher la consigne « données fictives uniquement » en test.
- **`/professionnel/onboarding`** — profil professionnel déclaratif ; préciser les informations réellement demandées et rappeler que l’acceptation par un établissement valide uniquement un rattachement.

#### Patient

- **`/patient`** — accueil du compte patient ; contrôler tous les libellés de statut, les données affichées et les indications de prochaine action.
- **`/patient/acces`** — demandes d’accès, consentement/refus, prolongation, expiration et révocation ; vérifier l’identité du demandeur, le périmètre, l’établissement et la durée présentés avant choix.
- **`/patient/carnet`** — déclarations et informations du carnet ; faire apparaître clairement l’origine (« déclaré par le patient » ou « saisi par un professionnel ») et les modalités de correction.
- **`/patient/consultations`** — historique et éléments de consultation ; préciser qui les a saisis, leur statut et les règles de correction/conservation.
- **`/patient/parametres`** — paramètres du compte patient ; ne pas promettre export, fermeture, effacement ou durée de conservation avant une décision juridique et un parcours technique réel.

#### Professionnel

- **`/professionnel`** — accueil du professionnel ; vérifier les statuts « vérifié », « établissement actif » et les actions cliniques annoncées.
- **`/professionnel/acces`** — recherche/QR et demande d’accès, périmètre et acceptation des conditions de rattachement ; le texte de la case et le double besoin QR + UUID doivent être clairs.
- **`/professionnel/consultations`** — données cliniques saisies, conclusion et attestation ; valider champs, portée d’une signature, correction et conservation.
- **`/professionnel/etablissements`** — rattachement et établissement actif ; distinguer demande en attente, acceptation institutionnelle et certification du professionnel.
- **`/professionnel/parametres`** — compte et profil professionnel ; faire correspondre les données modifiables et les déclarations à la politique de confidentialité.
- **`/professionnel/patients`** — patients connus par le professionnel ; confirmer qu’une liste n’accorde pas à elle seule un nouvel accès ni ne contourne le consentement du patient.

#### Établissement et équipe interne

- **`/etablissement`** — accueil de l’espace établissement et rôle de l’administrateur ; afficher clairement l’absence d’accès clinique.
- **`/etablissement/activation`** — activation d’une invitation nominative et création du mot de passe ; expliquer la durée de 48 h, l’usage unique et l’action en cas de lien expiré.
- **`/etablissement/aide`** — aide aux administrateurs et médecins ; texte d’aide à relire pour éviter une promesse de vérification ou d’accès non conforme au rôle.
- **`/etablissement/demandes`** — liste des rattachements à accepter/refuser ; préciser que la décision valide seulement le lien à l’établissement et peut être historisée.
- **`/etablissement/gestion`** — gestion de la structure et de ses responsabilités ; vérifier la séparation entre gestion administrative et consultation clinique.
- **`/etablissement/medecins`** — liste des médecins rattachés et changements de statut ; examiner les mots « médecin vérifié », « accepté », « actif » et le sens de la suspension/fin.
- **`/etablissement/parametres`** — paramètres du compte administrateur/structure ; contrôler les rôles, changements d’administrateur et traces conservées.
- **`/staff/etablissements`** — console privée de l’équipe pour les justificatifs et la création d’une structure ; décrire le traitement interne sans afficher publiquement les pièces ni donner de rôle global Root.
- **`/staff/medecins`** — traitement interne des demandes et statuts de rattachement ; ne pas laisser entendre qu’E-Carnet vérifie les diplômes ou certifie la compétence médicale.

**Consigne de remise au juriste :** parcourir les 32 routes sur les rôles Patient, Professionnel, Établissement et Staff, ainsi que les composants partagés et les états erreur/vide/expiré. La présente liste est une carte d’audit des écrans et des enjeux juridiques ; elle ne remplace pas cette relecture visuelle de l’application rendue.

## 4. Textes à proposer pour les pages juridiques

Les paragraphes ci-dessous sont **des formulations provisoires**. Les champs entre crochets sont obligatoires à compléter. Le conseil juridique doit confirmer les formulations et les formalités avant de les publier.

### A. Mentions légales — projet de structure

> **Éditeur du service**  
> Mon Carnet Numérique est édité et exploité par **[dénomination juridique complète]**, **[forme juridique]**, immatriculée sous le numéro **[RCCM / identifiant applicable]**, dont le siège est situé à **[adresse complète, Côte d’Ivoire]**.  
> Directeur ou directrice de publication : **[nom et qualité]**.  
> Contact : **[adresse e-mail dédiée]** — **[adresse postale ou autre contact requis]**.  
> Hébergement du service : **[nom de l’hébergeur et coordonnées exactes pour l’environnement concerné]**. Les environnements de test et de production peuvent avoir des hébergeurs différents.  
> Propriété intellectuelle : **[titulaire et conditions d’utilisation des contenus, du nom et des marques]**.  
> Le service est en phase de test fermé. Il ne doit pas recevoir de données de santé réelles tant que l’ouverture n’a pas été expressément autorisée par le responsable du projet et les validations juridique, médicale et technique.

**À compléter avant publication :** identité juridique, responsable de publication, adresse et contact, prestataire exact par environnement, éventuelles informations d’immatriculation et politique de propriété intellectuelle. Ne pas publier avec Hodi comme hébergeur tant que le contrat et le déploiement Hodi n’existent pas.

### B. Confidentialité et protection des données — projet de rédaction

> **Qui traite vos données ?**  
> Le service est exploité par **[dénomination et coordonnées]**. Pour chaque usage, nous préciserons si cet exploitant agit comme responsable du traitement, conjointement avec un établissement, ou selon un autre rôle défini par le droit applicable. Contact protection des données : **[adresse dédiée / correspondant désigné]**.
>
> **Quelles informations peuvent être concernées ?**  
> Selon votre rôle et les fonctions utilisées : informations de compte et de connexion ; informations de profil et coordonnées ; déclarations de santé saisies par le patient ; préparation de consultation ; décisions d’accès ; informations saisies lors d’une consultation par un professionnel ; rattachements à un établissement ; et traces techniques ou de sécurité nécessaires au fonctionnement du service. Les données réellement utilisées, leur origine et les champs facultatifs seront décrits précisément avant toute ouverture.
>
> **Pourquoi les utilisons-nous ?**  
> Les finalités envisagées sont **[à confirmer : créer et sécuriser les comptes, permettre la préparation d’une consultation, gérer une demande d’accès et son autorisation, conserver les informations créées dans le carnet, gérer les rattachements et assurer la sécurité]**. Les finalités et les conditions juridiques correspondantes seront précisées par le responsable du traitement et validées avant l’activation de données réelles.
>
> **Qui peut recevoir les informations ?**  
> Les destinataires dépendront de votre rôle et des autorisations que vous accordez. Un administrateur d’établissement gère les rattachements mais ne doit pas consulter les dossiers patients. Un professionnel ne peut accéder qu’aux informations autorisées, sous réserve des contrôles d’accès effectivement actifs. Des prestataires techniques peuvent traiter des données pour fournir l’hébergement, la base de données, l’e-mail ou l’authentification, selon les contrats et les lieux qui seront indiqués ici : **[liste, rôles, pays, sous-traitants ultérieurs]**.
>
> **Où les données sont-elles hébergées ?**  
> Pour les environnements de test, les fournisseurs actuellement envisagés sont Vercel, Render et Neon ; la région et les lieux de sauvegarde doivent être confirmés pour chaque compte. L’environnement de production envisagé à partir de V3 pourrait utiliser un VPS situé en Côte d’Ivoire, sous réserve de choix et de vérification contractuelle. Les sauvegardes, journaux, accès d’assistance et transferts hors de Côte d’Ivoire seront décrits séparément. **Une localisation du serveur principal ne signifie pas nécessairement que toutes les copies restent dans le même pays.**
>
> **Combien de temps ?**  
> Les durées de conservation ne sont pas encore approuvées. Avant l’ouverture, nous publierons une durée ou un critère précis pour chaque catégorie : compte, données de santé, consultations, consentements, journal d’accès, rattachement, invitation, e-mail et sauvegarde. Les durées actuelles ne doivent pas être inventées ou remplacées par « aussi longtemps que nécessaire » sans validation.
>
> **Vos droits et vos demandes**  
> Selon les conditions prévues par la loi applicable, vous pourrez adresser une demande d’accès, de rectification ou de mise à jour, d’opposition et, lorsque cela est applicable, de suppression ou d’effacement. Contactez **[adresse de contact]** en indiquant le compte concerné. La procédure de vérification d’identité, les délais et les cas où une donnée doit rester conservée seront expliqués par le responsable du traitement. Vous pouvez également saisir l’Autorité de protection compétente en Côte d’Ivoire selon les procédures qu’elle publie.
>
> **Données de santé et phase de test**  
> La version de test n’est pas ouverte aux dossiers de santé réels. Utilisez uniquement les données fictives fournies ou approuvées pour les essais. Avant toute ouverture à des données réelles, nous publierons la notice validée, les finalités, les conditions d’accès, les durées de conservation et les informations sur les formalités accomplies.

**Réserve importante :** ce texte ne fixe pas de base juridique, ne détermine pas qui est responsable pour chaque traitement et ne prétend pas obtenir un consentement valable par sa seule publication. Ces points doivent être instruits par le juriste. L’Autorité ivoirienne demande notamment l’information sur l’identité, les données, les finalités, les destinataires, les durées et les transferts.[^j1]

### C. Conditions générales d’utilisation — projet de trame

> **Objet et version de test.** Le service Mon Carnet Numérique permet à ses utilisateurs autorisés de créer un carnet, de préparer une consultation et de gérer des autorisations d’accès dans les limites décrites dans le service. La version actuellement disponible est une version de test fermée. Elle n’est pas destinée à recevoir des dossiers de santé réels ni à remplacer une consultation ou un dispositif d’urgence.
>
> **Comptes et informations.** Chaque utilisateur protège ses moyens de connexion et fournit des informations exactes dans la mesure requise par son rôle. Les comptes et les droits d’un patient, d’un professionnel, d’un administrateur d’établissement et du personnel exploitant sont distincts. Les conditions spécifiques de rattachement médecin ou d’établissement peuvent faire l’objet de documents distincts.
>
> **Accès aux informations.** Un rattachement ne donne pas à lui seul accès à un dossier patient. L’accès clinique dépend des contrôles de l’application, du rattachement et de l’établissement actifs ainsi que de l’autorisation du patient. L’utilisateur doit vérifier le professionnel, l’établissement, le périmètre et la durée avant d’autoriser. Le fonctionnement réel de chaque contrôle doit rester cohérent avec cette clause.
>
> **Rôle médical.** Le service est un outil de gestion d’informations et de préparation. Il ne pose pas de diagnostic, ne remplace pas l’avis d’un professionnel et ne doit pas être utilisé pour une urgence. Les professionnels restent responsables de leurs actes et des informations qu’ils saisissent, sous réserve du droit applicable et des contrats conclus avec leur établissement.
>
> **Disponibilité et sécurité.** Pendant les essais, des interruptions, changements ou suppressions d’environnement peuvent survenir. Les utilisateurs ne doivent pas dépendre de la version de test pour leur prise en charge. Les garanties exactes de sauvegarde, d’assistance, de disponibilité et de sécurité seront indiquées uniquement après définition du service et validation des conditions contractuelles.
>
> **Données personnelles.** Les règles relatives aux données, aux destinataires, aux lieux, aux durées et aux droits figurent dans la politique de confidentialité distincte : **[lien]**. En cas d’incohérence, faire préciser par le juriste l’articulation entre les présentes conditions et les contrats patient/établissement/professionnel.
>
> **Droit applicable et contact.** Droit applicable, règlement des différends, responsabilité, propriété intellectuelle, modification des conditions, suspension et résiliation : **[clauses à rédiger et valider par le juriste, avec identité des parties et juridiction compétente]**.

Cette trame **n’est pas un contrat complet**. Ne pas y ajouter une clause générale d’exclusion de responsabilité ou une promesse de disponibilité sans examen juridique local.

### D. Cookies et stockage dans le navigateur — projet de notice

> **Cookies techniques.** L’application utilise une session gérée par le serveur et un mécanisme technique de protection contre les requêtes non autorisées (CSRF). Ces éléments servent à la connexion et à la sécurité. La configuration des cookies, leur nom exact, leur durée, leur domaine et leurs attributs seront confirmés sur le domaine de production avant publication.
>
> **Mesure d’audience et publicité.** Au moment de l’inspection du code fourni, aucune intégration d’outil de mesure d’audience ou de publicité n’a été repérée. Si un outil tiers ou un cookie non indispensable est ajouté, la présente notice et le mécanisme de choix devront être réévalués avant son activation.
>
> **Vos choix.** Un lien « Cookies » restera accessible depuis le pied de page. Si des cookies non essentiels sont déployés, leur dépôt sera traité selon les règles applicables et les choix de l’utilisateur, après validation du juriste. Les cookies strictement nécessaires au service seront identifiés séparément.

**À confirmer avant d’afficher :** inventaire réel dans un navigateur sans connexion et après connexion ; noms et durée des cookies de session/CSRF ; éventuels cookies OAuth ou tiers ; service worker et stockage hors ligne ; composants de mesure d’audience. Le dépôt indique que les sessions sont gérées côté serveur et que les jetons de session ne sont pas stockés dans `localStorage`/`sessionStorage`, mais une inspection de code ne remplace pas une mesure du navigateur.[^p11]

## 5. Liste des pages et décisions à transmettre au juriste

Demander une réponse écrite pour chacun des sujets suivants, sous la forme **validé / à modifier / à supprimer / décision produit préalable** :

- identité de l’éditeur, opérateur, responsable(s) de traitement et coordonnées à publier ;
- formalités applicables auprès de l’Autorité ivoirienne, notamment données de santé, traitements et transferts internationaux ;
- distinction entre données déclarées par le patient et données écrites par un professionnel ;
- consentement d’accès : finalité, périmètre, durée, prolongations, révocation, preuve et cas de représentation ;
- mineurs, urgence, aidant non authentifié et éventuelles limites du service ;
- statut du professionnel : vérification effectuée par l’établissement, libellés dans l’interface, données historiques ;
- portée de l’attestation SVG, horodatage, intégrité, rectification et emploi du mot « signer » ;
- durées de conservation, correction, export, suppression, audit, clôture de compte et fin de rattachement ;
- preuves de structure transmises par e-mail : boîte, personnes ayant accès, sous-traitant e-mail, sauvegarde et purge ;
- contrats et transferts de Vercel, Render, Neon, OAuth, e-mail, hébergeur futur et fournisseurs d’avatars ;
- procédure de demandes de droits et de plaintes, incident de sécurité et communications ;
- acceptation versionnée des CGU et conditions de rattachement ;
- nécessité et contenu d’une notice/banner cookies au regard de l’inventaire réel ;
- promesses publiques exactes des routes `/`, `/a-propos`, `/faq`, `/securite`, `/v1` et du pied de page.

## 6. Contradictions et correction immédiate des textes

1. **NO-GO contre `/v1` :** ne pas afficher « V1 stable », « prête à être présentée comme fiable » ou « socle sécurisé » tant que les critères de recette ne sont pas signés. Proposition temporaire : « Version de test en cours. Données fictives uniquement. Fonctionnalités et sécurité encore en validation. »[^p1] [^p8]
2. **QR et scan :** remplacer « le médecin vous autorise en un scan » par « le QR permet d’initier une demande ; le patient décide ensuite », tant que le parcours demande encore l’identifiant patient séparément.[^p4] [^p5]
3. **Audit et accès :** éviter « chaque lecture est enregistrée » ou « tout est tracé » avant une vérification route par route et une preuve staging. Préférer une description étroite qui correspond aux événements effectivement testés.
4. **Vérification du médecin :** préférer « l’établissement confirme le rattachement du professionnel à sa structure » à une formulation laissant entendre une certification par E-Carnet. Aligner le statut de modèle « Vérifié » et les titres des écrans Staff sur la décision A6.[^p2] [^p6]
5. **Conservation :** ne pas écrire que les dossiers « restent conservés » sans durée ni règle approuvée. Ajouter une référence à la politique de conservation une fois celle-ci arrêtée.
6. **Données fictives :** afficher cette consigne aussi près des champs de santé et dans les environnements de recette, pas uniquement dans le pied de page.

## 7. Conditions de passage par étape

### Avant de poursuivre les tests V1/V2

- Exclure toutes données médicales réelles et limiter le staging à des testeurs autorisés.
- Verrouiller les environnements de prévisualisation, protéger les URL et secrets, documenter les régions effectives et les comptes de test.
- Garder les nouvelles notices en brouillon jusqu’à ce que les champs entre crochets soient renseignés et le juriste ait rendu son avis.
- Traiter les affirmations `/v1` et QR ci-dessus avant tout partage externe du lien.

### Avant toute ouverture à des utilisateurs externes, même sans dossier médical réel

- Valider le statut de l’éditeur, les CGU applicables, l’information de confidentialité, les contacts de droits et les fournisseurs qui reçoivent les données de compte et journaux.
- Vérifier si les formalités de l’Autorité s’appliquent au périmètre de test et les accomplir si nécessaire.
- Mettre en ligne les pages juridiquement approuvées et relier ces pages depuis le pied de page et l’inscription.

### Avant de recevoir des données de santé réelles

- Obtenir un avis juridique écrit et accomplir les formalités requises ; décider les rôles, finalités, conditions de traitement, droits, consentements, mineurs/urgence, conservation et incident.
- Confirmer par contrat les lieux de traitement, de sauvegarde et d’assistance, les sous-traitants ultérieurs et les transferts internationaux pour chaque fournisseur. Si la règle est « aucune copie hors Côte d’Ivoire », exiger une confirmation écrite pour le produit Hodi précis et vérifier les services auxiliaires tels que mail, supervision et sauvegardes.
- Lever tous les critères de recette staging/production : base managée, sauvegarde/restauration et RPO/RTO, domaines/cookies/CSRF, sécurité, contrôle d’accès, procédure d’incident, mobile et acceptation produit.[^p1]

## 8. Sources

### Projet fourni

- `docs/QUESTIONNAIRE-DECISIONS-A1-A16.md` : décisions produit et questions ouvertes.[^p2]
- `docs/ETAT-REEL-V1.md`, `docs/GO-NO-GO-2026-10-05.md` et `docs/DEPLOYMENT.md` : implémentation, preuves et limites de déploiement.[^p1] [^p4]
- `docs/CONDITIONS-RATTACHEMENT-MEDECIN.md` : texte versionné déjà présenté aux médecins.[^p3]
- `apps/web/src/app/page.tsx`, `a-propos/page.tsx`, `faq/page.tsx`, `securite/page.tsx`, `v1/page.tsx`, `conditions-rattachement/page.tsx`, `components/public/PublicShell.tsx` et `components/AuthForms.tsx` : textes du frontend.[^p5] [^p6] [^p7] [^p8] [^p9] [^p10]
- `apps/web/src/components/ProfessionalAccessFlow.tsx`, `PatientAccessGrants.tsx`, `PatientCarnet.tsx`, `ProfessionalConsultations.tsx`, `EstablishmentWorkspace.tsx`, `EstablishmentConsole.tsx`, `StaffProfessionalVerification.tsx` et `apps/api/apps/*/models.py` : écrans et données privées.[^p11]

### Sources publiques consultées le 10 octobre 2026

[^j1]: [https://www.autoritedeprotection.ci/obligation-du-responsable-du-traitement/](https://www.autoritedeprotection.ci/obligation-du-responsable-du-traitement/) « Obligations du responsable du traitement » — formalités, information, droits, sous-traitance et sécurité.
[^j2]: [https://www.autoritedeprotection.ci/documents/](https://www.autoritedeprotection.ci/documents/) « Formulaires » — déclaration préalable, autorisation préalable et transfert hors espace CEDEAO. Voir aussi [https://www.autoritedeprotection.ci/lois/](https://www.autoritedeprotection.ci/lois/) « Lois » — lois ivoiriennes n° 2013-450, n° 2013-451 et n° 2013-546.
[^j3]: [https://www.autoritedeprotection.ci/droits-des-personnes-concernees/](https://www.autoritedeprotection.ci/droits-des-personnes-concernees/) « Droits des personnes concernées » — information, accès, rectification, opposition, suppression et effacement dans les conditions prévues.
[^h1]: [https://hodi.host/ci/store/hebergement-web/pro](https://hodi.host/ci/store/hebergement-web/pro) « Site Pro hébergé en Côte d’Ivoire » — datacenter annoncé à Grand-Bassam ; la page annonce 30 jours de sauvegarde vers un second datacenter en Europe.
[^h2]: [https://hodi.host/ci/cgs/](https://hodi.host/ci/cgs/) « Conditions Générales de Service », article 21 — sauvegardes des offres web concernées vers un datacenter en Allemagne ; vérifier le produit et les options commandés.
[^h3]: [https://hodi.host/ci/store/serveur-virtuel](https://hodi.host/ci/store/serveur-virtuel) « VPS non managé en Côte d’Ivoire » ; [https://hodi.host/ci/store/serveur-virtuel-manage](https://hodi.host/ci/store/serveur-virtuel-manage) « VPS managé en Côte d’Ivoire » — offres séparées, sauvegardes et gestion annoncées différemment.
[^h4]: [https://hodi.host/ci/dpa/](https://hodi.host/ci/dpa/) « Accord de traitement des données » — rôles et conditions publiés par Hodi ; ne remplace pas l’analyse du cadre ivoirien.
[^p1]: Dépôt fourni, `docs/GO-NO-GO-2026-10-05.md` (état mis à jour au 8 octobre 2026) et `docs/ETAT-REEL-V1.md`.
[^p2]: Dépôt fourni, `docs/QUESTIONNAIRE-DECISIONS-A1-A16.md`, mise à jour du 8 octobre 2026.
[^p3]: Dépôt fourni, `docs/CONDITIONS-RATTACHEMENT-MEDECIN.md` et `apps/web/src/app/conditions-rattachement/page.tsx`.
[^p4]: Dépôt fourni, `docs/DEPLOYMENT.md`, `docs/SECURITY.md` et `docs/ETAT-REEL-V1.md`.
[^p5]: Dépôt fourni, `apps/web/src/app/page.tsx`.
[^p6]: Dépôt fourni, `apps/web/src/app/a-propos/page.tsx` et `apps/web/src/app/faq/page.tsx`.
[^p7]: Dépôt fourni, `apps/web/src/app/securite/page.tsx`.
[^p8]: Dépôt fourni, `apps/web/src/app/v1/page.tsx`.
[^p9]: Dépôt fourni, `apps/web/src/components/AuthForms.tsx` et les routes `/inscription`, `/connexion`.
[^p10]: Dépôt fourni, `apps/web/src/components/public/PublicShell.tsx`.
[^p11]: Dépôt fourni, composants privés et `apps/api/config/settings.py` ; constats issus d’une lecture statique, à confirmer dans les navigateurs et environnements déployés.
