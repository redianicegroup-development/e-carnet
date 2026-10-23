# Mises à jour du 23/10/2026 — un seul compte, deux espaces (professionnels)

**Aucune migration, aucune nouvelle dépendance.**

## Principe
Un professionnel garde **un seul compte** et dispose de deux espaces séparés : **Espace patient** (son propre carnet) et **Espace professionnel**.
Un patient simple, un compte établissement ou un médecin dont le profil n'est pas encore créé n'ont **pas** ce choix.

## Interface
- **« Changer d'espace »** dans le menu du profil (barre latérale et menu mobile), **visible uniquement pour un compte professionnel**
  (contexte professionnel existant **et** profil créé). Le libellé indique la destination : « Changer d'espace : espace patient » / « … espace professionnel ».
  Le clic active le bon contexte côté serveur (`POST /api/v1/identity/contexts/select/`, déjà existant), puis ouvre l'autre espace. En cas d'échec, un message s'affiche dans le menu.
- **Lien direct / favori** vers l'autre espace d'un professionnel : le contexte est activé automatiquement (une seule fois) puis la page se recharge ; sinon l'API refusait les appels.
  Rien ne change pour les autres comptes (aucun contexte n'est créé par ce mécanisme).
- Code : `lib/spaces.ts` (`isProfessionalAccount`, `spaceSwitchTarget`, `contextToActivate`, fonctions pures testées) et `components/shell/SpaceShell.tsx`.

## Séparation des données (vérifiée, aucun changement nécessaire)
- Cachet, signature et rattachements ne sont lus que par les écrans professionnels ; aucun écran patient n'appelle le profil professionnel.
- L'historique patient (consultations où le compte est patient) et les consultations du médecin (où il est signataire) viennent de deux requêtes distinctes : ils ne se mélangent pas.

## Blocage côté serveur : jamais son propre dossier
- `care/services.py` : `create_professional_grant` refuse le QR si le dossier appartient au même compte (`SelfAccessRefused`), **avant** de consommer le QR (il reste utilisable).
  Message : « Vous ne pouvez pas ouvrir votre propre dossier en tant que professionnel. Consultez-le depuis votre espace patient : un confrère peut vous soigner par le circuit habituel (QR, autorisation, consultation signée par lui). »
- `care/views.py` : réponse **403** avec `code: "self_access"` ; le refus est **tracé** dans le journal d'audit (`access_grant.self_refused`, sans donnée de santé).
  La liste des autorisations du professionnel exclut aussi toute autorisation sur son propre dossier (défense en profondeur).
- `care/consultation_services.py` : `validate_consultation` refuse de signer une consultation sur son propre dossier (défense en profondeur).
- Un **confrère** suit le circuit normal : QR du patient → demande → autorisation du patient → consultation signée par ce confrère.

## Tests
- Node : `tests/un-compte-deux-espaces.test.mjs` (7 tests, ajouté à `npm test`) — tous verts.
- Python : `care/test_self_access.py` (6 tests : refus + message, audit + QR non consommé, confrère accepté, autre patient inchangé, liste sans auto-autorisation, aide sur profil sans compte).
  **Non exécutés ici** (Django absent du bac à sable) : seulement compilés. À lancer : `python manage.py test apps.care.test_self_access`.
- Suite Node complète : 162/165. Les 3 échecs (« un seul centre d'aide » : dossier `src/app/faq` encore présent ; « QR de visite » : `AccountSettingsClient` sans `emergencyPublicUrl` ;
  « thème » : paquet `@ecarnet/ui` absent du bac à sable) concernent des fichiers datant du 17–19/10 que je n'ai pas modifiés ; ils sont à vérifier dans votre dépôt.

## Pas testé
Pas de test dans un navigateur : le menu et la bascule sont vérifiés par analyse du code, tests sur les fonctions pures et vérification de syntaxe.
Ce n'est pas un avis juridique : l'auto-soin n'a pas été vérifié dans la déontologie ivoirienne (texte introuvable) ; le blocage reste, de toute façon, la position la plus prudente.
