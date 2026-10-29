# Web Push — obtenir et configurer les clés VAPID (mode d'emploi)

Ce guide vous mène de zéro jusqu'à la première notification reçue sur un téléphone. Comptez une quinzaine de minutes.
Pour le fonctionnement général (planification, confidentialité, limites), voir `docs/WEB-PUSH.md`.

## 1. À quoi servent ces clés

Pour envoyer une notification, votre serveur doit se faire reconnaître auprès des services de Google, Apple, Mozilla et Microsoft.
Il le fait avec une **paire de clés** :

| Variable | Rôle | Où elle va |
|---|---|---|
| `ECARNET_VAPID_PUBLIC_KEY` | clé publique, que le navigateur du patient reçoit pour s'abonner | serveur (API) ; elle n'est pas secrète |
| `ECARNET_VAPID_PRIVATE_KEY` | clé privée, qui signe chaque envoi | serveur (API) uniquement, **secrète** |
| `ECARNET_VAPID_SUBJECT` | une adresse de contact, au format `mailto:adresse@votre-domaine` | serveur (API) ; les services de push s'en servent pour vous joindre en cas de problème |

Les trois sont nécessaires. S'il en manque une, le push reste simplement désactivé : l'application et ses rappels
« dans l'application » continuent de fonctionner normalement.

## 2. Avant de commencer : installer `pywebpush` (étape 0)

Le serveur a besoin de la bibliothèque `pywebpush`. Elle figure dans `apps/api/requirements.in`, mais le fichier verrouillé
`apps/api/requirements.txt` (versions exactes + empreintes) ne la contient pas encore. Ce fichier ne peut pas être écrit à la main : il se
génère avec accès à internet. Deux façons, au choix :

- **Sans rien installer (recommandé)** : sur GitHub, onglet **Actions** → **Verrouiller requirements.txt** → **Run workflow**.
  Une minute plus tard, un commit « chore(api): verrouille pywebpush » est ajouté à la branche. (Si la branche est protégée,
  téléchargez le fichier `requirements.txt` en pièce jointe du run et remplacez `apps/api/requirements.txt` par celui-ci.)
- **Sur votre ordinateur** (Python 3.12) : `make lock`, puis relire le changement et le commiter.

Ensuite, **redéployez** l'API pour qu'elle installe la bibliothèque, et appliquez la migration : `python manage.py migrate`
(elle crée les tables `0021`).

## 3. Générer la paire de clés

À faire **une seule fois par environnement**, depuis la racine du projet. Deux méthodes équivalentes :

**A. Avec le script du projet** (Python et la bibliothèque `cryptography`, déjà dans les dépendances de l'API) :

```
python apps/api/scripts/generate-vapid-keys.py
```

**B. Avec Node** (si vous n'avez pas Python sous la main) :

```
npx web-push generate-vapid-keys
```

Les deux donnent la même chose : une clé publique et une clé privée en texte (lettres, chiffres, `-` et `_`).
Avec la méthode A, vous obtenez directement trois lignes prêtes à copier :

```
ECARNET_VAPID_PUBLIC_KEY=…      (87 caractères)
ECARNET_VAPID_PRIVATE_KEY=…     (43 caractères)
ECARNET_VAPID_SUBJECT=mailto:contact@votre-domaine
```

Avec la méthode B, la ligne « Public Key » est la clé publique et la ligne « Private Key » la clé privée. Si les longueurs sont
différentes de 87 et 43 caractères, c'est que quelque chose a été coupé ou ajouté en copiant : recommencez la copie.

Remplacez `mailto:contact@votre-domaine` par une **adresse réelle** que vous lisez.

> **Gardez la clé privée comme un mot de passe** : dans un gestionnaire de mots de passe, jamais dans le dépôt, un e-mail ou une
> conversation. Utilisez une **paire différente** pour chaque environnement (local, test, production).

## 4. Renseigner les trois variables

Selon l'endroit où tourne l'API :

**En local avec Docker** : à la racine du projet, créez ou complétez le fichier `.env` avec les trois lignes (le fichier `.env` n'est
jamais commité), puis `docker compose up --build`. Le fichier `docker-compose.yml` transmet ces valeurs à l'API.

**Sur Render** : tableau de bord → votre service API → **Environment** → ajoutez les trois variables
(elles sont déjà prévues dans `render.yaml` avec `sync: false`, donc vides tant que vous ne les saisissez pas) → **Save changes**
(le service redémarre).

**Sur Hodi (cPanel)** : dans l'application Python, section des **variables d'environnement** (dans cPanel, « Setup Python App » →
« Environment variables », si votre offre la propose), ajoutez les trois variables, puis redémarrez l'application.
Si vous ne trouvez pas cet écran, demandez à Hodi où définir les variables d'environnement d'une application Python : c'est un
point à confirmer par écrit avec eux. La tâche planifiée des rappels (cron, `docs/WEB-PUSH.md`) doit aussi voir ces variables.

**Ailleurs** : n'importe quel hébergeur permet de définir des variables d'environnement ; les noms sont exactement ceux du tableau
du §1, sans guillemets ni espaces autour du `=`.

## 5. Vérifier que le push est activé

1. L'API a redémarré, `pywebpush` est installé (étape 0) et les trois variables sont saisies.
2. Connectez-vous à l'application dans le navigateur, puis ouvrez cette adresse (en remplaçant le domaine par le vôtre) :
   `https://VOTRE-API/api/v1/patient/care/push/vapid-key/`
3. Vous devez voir `"enabled": true` et une longue clé dans `"public_key"`. Si `"enabled": false`, une des trois variables manque,
   ou `pywebpush` n'est pas installé : reprenez l'étape 0 et le §4.

## 6. Tester sur un vrai téléphone

1. Ouvrez l'application, **Paramètres → Notifications → « Activer les notifications »**, et acceptez la demande du navigateur.
2. **Android (Chrome)** : cela fonctionne directement dans le navigateur.
3. **iPhone / iPad (iOS 16.4 ou plus)** : le push ne marche que si l'application est **ajoutée à l'écran d'accueil**
   (Partager → « Sur l'écran d'accueil »), puis ouverte depuis cette icône. L'application l'explique à l'écran.
4. Créez un rappel de médicament pour dans quelques minutes, puis lancez l'envoi à la main :
   `python manage.py send_due_reminders --dry-run` (essai à blanc), puis sans `--dry-run`. En production, c'est la tâche planifiée
   toutes les 5 minutes (`docs/WEB-PUSH.md`, section « Planification ») qui s'en charge.
5. La notification affiche un texte neutre (« Rappel de prise ») : c'est voulu, aucun nom de médicament sur l'écran verrouillé.

## 7. Règles à ne jamais oublier

- **Ne changez plus la paire** une fois en service : tous les appareils seraient désabonnés et chaque patient devrait réactiver les
  notifications.
- **Une fuite de la clé privée** (publiée par erreur, partagée) : générez une nouvelle paire (§3), remplacez les trois valeurs,
  redéployez. Les patients devront réactiver les notifications.
- **Ne perdez pas la clé privée** : sans elle, impossible de continuer avec la même paire. Conservez-la dans un gestionnaire de mots de passe.

## 8. En cas de problème

| Symptôme | Cause probable | Que faire |
|---|---|---|
| Le bouton « Activer les notifications » est absent ou grisé | push désactivé côté serveur | vérifier le §5 (`"enabled": false`) |
| `"enabled": false` alors que les trois variables sont saisies | `pywebpush` pas installé | étape 0, puis redéployer |
| Sur iPhone, rien à activer | application non ajoutée à l'écran d'accueil, ou iOS plus ancien que 16.4 | §6, point 3 |
| Abonnement accepté mais aucune notification | tâche planifiée absente, ou variables non visibles par le cron | `docs/WEB-PUSH.md` (« Planification »), §4 (Hodi) |
| Erreurs 401 ou 403 dans les journaux d'envoi | la clé publique et la clé privée ne forment pas la même paire, ou l'adresse `mailto:` est invalide | recopier les deux clés depuis la même génération ; corriger l'adresse |
| Une notification manque après une longue extinction du téléphone | le message expire au bout d'une heure | normal ; le rappel reste visible dans l'application |
