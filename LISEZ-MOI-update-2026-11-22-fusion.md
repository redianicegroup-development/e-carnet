# E-Carnet : mise à jour du 22/11/2026 (fusion)

Archive différentielle sur `e-carnet-3.zip` : décompresser **à la racine** du projet, en écrasant. Elle contient (1) les 7 demandes du tour précédent, (2) la suite du
point 6 (notifications du laboratoire et de l'admin) et (3) la fusion de `e-carnet-3_modifications-2026-11-22.zip` **dans sa dernière version** (cachet et signature de
l'établissement, ordonnance, tuiles, cartes de chiffres, tableau de bord, admin : nouveaux `admin-skin.css`, `attestations.css`, `establishment-dashboard.css`).
Un seul fichier était modifié des deux côtés avec un conflit (`CollapsibleSection.tsx`) : les props `tone` (tuiles) et `count` (pastille) coexistent.

## 1. Suppression de compte (cause trouvée grâce au log)
`erase_patient_records` faisait `EmergencyAccessRequest.objects.filter(...).update(reason_note="")`. Le gestionnaire des accès d'urgence **refuse tout `update()`**
(`TypeError : « Les accès d'urgence sont immuables »`) : TOUTE suppression de compte renvoyait une erreur 500 (4,4 s de travail, puis échec, rollback complet).
Correctif : le motif libre est remplacé par « Contenu effacé à la suppression du compte. » via `QuerySet.update` de base (la base refuse un motif vide), le reste
(qui, quand, où, catégorie) est conservé. Test de régression ajouté. Les 3 tests d'effacement qui échouaient déjà dans le zip d'origine devraient passer.
Aussi : `LOGGING` dans `config/settings.py` (sans lui, Django n'écrivait aucune trace d'erreur : on ne voyait que « POST … 500 »), enveloppe JSON claire autour de
la suppression, messages d'erreur du client selon le code HTTP (un 500 n'est plus « service indisponible »).

## 2. Message « Connexion impossible » (Google)
Le garde-fou est conservé : une adresse déjà utilisée par un compte e-mail/mot de passe n'est pas liée automatiquement (aucune vérification d'e-mail à l'inscription :
lier sans connexion permettrait de détourner un compte). Nouveau titre « Ce compte existe déjà » et message qui dit quoi faire (se connecter, puis lier Google dans
Réglages › Sécurité et connexion).

## 3. Rattachements (établissement ⇄ professionnel)
- Demandes = profils (photo ronde + « En attente » + point jaune), dans « Demandes » ET dans « Médecins » ; 3 par ligne sur téléphone.
- Au toucher : fiche (nom, prénoms, métier, e-mail) avec Refuser / Confirmer ; modals de résultat : « Vous avez accepté la demande : X est rattaché(e) à … »,
  « Vous avez refusé la demande de X », ou l'erreur avec son motif (rien n'est modifié). Le refus demande d'abord une confirmation.
- Badge du nombre en attente sur l'onglet « Demandes » et sur la tuile.
- Notifications (nouvelle boîte du compte, cloche dans les 4 espaces) : l'administrateur reçoit « Nouvelle demande de rattachement » ; le médecin reçoit
  « Rattachement accepté / refusé / retiré » ; chez le médecin, les onglets se recalculent à l'arrivée de la notification (sans recharger).
  API : `/api/v1/establishments/notifications/{inbox,pulse,read-all,clear,<id>/,<id>/read/}` (réutilise `EstablishmentNotification`).

## 3 bis. Point 6 : notifications des autres espaces (suite)
Boîte commune (même cloche, mêmes routes), un événement = une notification unique par destinataire (`event_key`), push sans nom ni motif. Ne bloque jamais l'action qui la déclenche.
- **Laboratoire** : bienvenue au nouvel administrateur (à sa 1re connexion) ; « Un nouvel administrateur a été ajouté » / « n'a plus accès » pour ses collègues ; structure
  parente suspendue ou réactivée.
- **Établissement** (en plus des demandes de rattachement) : « Un médecin a quitté l'établissement » ; « Structure suspendue / réactivée » ; les notifications déjà produites
  par l'API (revue d'accès d'urgence, facture en retard, relances internes) apparaissent maintenant dans la cloche, avec leur lien.
- **Admin** (super-administrateurs) : « Nouvelle demande de suspension de compte » ; « Nouveau retour utilisateur » (un message écrit, ou une note de 3 étoiles ou moins ; une
  bonne note seule ne notifie pas). Cloche dans la console admin ; le lien ouvre l'onglet (`/admin#feedback`, `/admin#account-requests`). Titre et texte sans identité.
- **Migration `establishments/0021`** : `EstablishmentNotification.establishment` devient facultatif (les notifications de l'équipe ne concernent aucune structure). Colonne NULL en plus, aucune donnée touchée.

## 4. Carte virtuelle
« Carte d'identité médicale » premium (format 85,6 × 54, vert encre, filets et puce dorés, tuiles en verre, photo sous double cadre doré), image PNG identique,
carte toujours pliée à l'ouverture de la page.

## 5. Pied de page
L'en-tête collant et le menu (barre du bas ; bouton du menu public) se retirent à l'arrivée au pied de page et reviennent dès qu'on remonte ; jamais sur une page qui
ne défile pas. Composant `FooterBarsHider`.

## 6. Traduction
« Mon E-Carnet » n'est plus traduit : lien de la page de connexion et de récupération, en-têtes, carte, et ~90 mentions dans les textes (spans `notranslate`).

## À faire au déploiement
```
python manage.py migrate      # care 0034 + establishments 0020 (archive fusionnée) + establishments 0021 (notifications de l'équipe) : colonnes vides / NULL, aucune donnée touchée
```

## Vérifications faites / non faites
- Tests front (lisent les sources) : 26 échecs, **les mêmes 26 que dans le zip d'origine**, aucun nouveau ; 14 nouveaux tests passent. Syntaxe TS/TSX et Python vérifiée.
- NON exécutés : tests Django (pas de Django dans cet environnement), `makemigrations --check`, `tsc`, ESLint, Playwright, rendu réel. `test_role_notifications.py` (8 tests) et
  le test de régression d'effacement sont écrits mais non lancés. La migration 0021 est écrite à la main : à confirmer par `makemigrations --check`.

## Reste à traiter (signalé, non fait)
- Effacement : `CareSnapshot.payload` (instantanés d'adressage) et `EstablishmentRecordOpening.reason_note` restent après suppression d'un compte (tables immuables).
- Notifications encore seulement proposées : professionnel (rendez-vous demandé ou modifié, résultat de labo reçu, nouvelle demande d'accès patient), admin (établissement à valider :
  la création d'une structure passe aujourd'hui par le staff, donc rien à notifier ; demande de récupération de compte ; paiement à rapprocher).
