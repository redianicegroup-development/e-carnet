# Render Free : console admin et visiteurs anonymes

## Console admin côté application

La console personnalisée est servie par le frontend Mon E‑Carnet : **https://e-carnetci.vercel.app/admin/**. Elle utilise la session de connexion habituelle, puis l’API n’autorise le dashboard qu’aux comptes dont `is_superuser=True`. Les comptes simplement `is_staff` ne peuvent pas l’ouvrir.

La console comporte cinq sections : **Vue d’ensemble** (KPI, facilité moyenne et courbes sur 30 jours), **Visites & clics** (recherche parmi les 200 visiteurs récents), **Feedback** (recherche et suivi du statut des retours), **Enquêtes** (découverte visiteurs et expérience produit, distribution et réponses) et **Établissements** (création et invitation du responsable). Les courbes présentent les nouveaux visiteurs, feedbacks et réponses quotidiennes aux deux enquêtes, ainsi que la facilité moyenne quotidienne après usage. Elles s’appuient sur les événements réellement horodatés : les compteurs cumulés de pages et de clics ne sont pas ventilés par jour, car aucun historique quotidien n’est conservé. Les données sont rechargées discrètement toutes les deux minutes lorsque la page admin est visible. La console ne donne pas accès aux dossiers patients. La route `/admin/` de Django Admin n’est plus exposée par l’API.

Les statistiques pseudonymes n’affichent pas d’emails, d’adresses IP, d’user-agents, de mots de passe, de textes de boutons ou d’URL complètes. Les messages de feedback sont une donnée distincte : ils sont visibles par les superadministrateurs; le formulaire ne demande pas d’email et avertit de ne pas inclure de données personnelles ou médicales.

## Données visiteurs

Le cookie `ecarnet_visitor` dure 30 jours. Il est `HttpOnly` et `Secure` en production; `SameSite=None` permet les retours OAuth POST. Le serveur garde des catégories de page et de clic autorisées, des compteurs par visiteur pseudonyme et uniquement la dernière catégorie de clic — pas d’historique brut des clics. Les clics sont mesurés sur les pages publiques et d’authentification; ils sont ignorés dans les espaces patient, professionnel, établissement, onboarding, staff et admin. Les agrégats inactifs depuis 90 jours sont purgés au prochain démarrage du service.

Le tracker envoie sa requête de visite en arrière-plan sur chaque route, y compris l’accueil, les espaces, la connexion et l’inscription. Il ne bloque pas l’affichage du site. Une visite réelle envoie une requête à Render et peut réveiller l’API endormie; l’offre Free peut ensuite se remettre en veille. Le formulaire de feedback public est limité à cinq envois par heure et par cookie visiteur.

Deux enquêtes distinctes sont utilisées. **Découverte visiteurs** : quatre questions facultatives, proposées une seule fois après cinq pages publiques cumulées; elles portent sur le profil, la recherche, les freins à l’inscription et les contenus manquants. **Expérience produit** : proposée une seule fois après la première action réussie dans un espace connecté; elle mesure la facilité de cette tâche (1 = très difficile, 5 = très facile), avec des choix facultatifs sur les points appréciés, les frictions et une amélioration. Les réponses ne stockent pas l’email ni l’identifiant de compte; l’admin ne reçoit aucun identifiant visiteur dans les réponses. Les anciennes réponses à l’enquête précédente restent consultables dans une archive et ne sont pas mélangées aux nouveaux résultats.

La console admin sépare les volumes, taux de réponse, distributions et réponses individuelles des deux enquêtes. L’API publique ne renvoie que la moyenne de facilité produit et le nombre de réponses; elle masque la moyenne tant que l’échantillon compte moins de 30 réponses et n’expose jamais les commentaires. La catégorie « Question » du feedback flottant ouvre le centre d’aide; les suggestions et signalements restent anonymes. Les champs libres peuvent contenir du texte saisi par l’utilisateur : ne pas y inscrire de données personnelles ou de santé.

## Création du compte superadministrateur sans Shell Render

Les Web Services gratuits Render n’offrent pas de Shell/SSH. Ce service étant de type Docker, Render construit l’image depuis `apps/api/Dockerfile` et utilise son `CMD` comme commande de démarrage. Après les migrations et le nettoyage, le démarrage exécute `python manage.py bootstrap_admin --if-configured` avant Gunicorn. Le build Docker n’exécute pas la commande de gestion.

1. Dans le service **ecarnet-api** sur Render, ajoutez dans **Environment** :
   - `DJANGO_ADMIN_EMAIL` : une adresse dédiée à l’administration;
   - `DJANGO_ADMIN_PASSWORD` : un mot de passe aléatoire d’au moins 20 caractères, sans ressemblance avec l’email ou une phrase courante. Utilisez un gestionnaire de mots de passe pour le générer; ne le partagez pas dans un message.
2. Enregistrez les variables et déployez cette version du dépôt. Au démarrage, le bootstrap crée le compte superadministrateur avant Gunicorn.
3. Ouvrez **https://e-carnetci.vercel.app/admin/** et connectez-vous avec ces identifiants.
4. Après la création, retirez **les deux variables** de Render et redéployez. Le compte reste enregistré en base.

La commande ne réinitialise pas un superadmin déjà présent et refuse de promouvoir un compte ordinaire. Si Django refuse le mot de passe, les journaux indiquent le motif de validation sans afficher le secret. Si les variables sont invalides ou si l’adresse correspond à un compte ordinaire, le service démarre sans créer un nouvel administrateur. N’inscrivez jamais les vrais identifiants dans Git, dans le frontend, une variable `NEXT_PUBLIC_*` ou un message.

## Documentation Render

- [Services gratuits et mise en veille](https://render.com/docs/free)
- [Déploiement Docker, Dockerfile et commande de démarrage](https://render.com/docs/docker)
- [Disponibilité du Shell/SSH par type de service](https://render.com/docs/ssh)
