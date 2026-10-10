# Render Free : visiteurs anonymes et accès admin

## Visiteurs dans le tableau de bord Django

Le menu admin **Visiteurs anonymes** affiche un UUID aléatoire par navigateur, la première et la dernière visite, le nombre de pages vues, les consultations des pages de connexion, ainsi que les compteurs de succès/échecs de login, d’inscriptions et de connexions OAuth. Les visites sont agrégées par cookie plutôt que conservées sous forme d’une ligne détaillée par clic.

Le cookie `ecarnet_visitor` dure 30 jours. Il est `HttpOnly` et `Secure` en production; son attribut `SameSite=None` permet les retours OAuth POST. Le serveur ne garde pour ce tableau ni adresse IP, ni user-agent, ni email, ni mot de passe, ni URL complète : seulement une catégorie de page. L’identifiant est pseudonyme, pas une preuve d’identité. Les agrégats inactifs depuis 90 jours sont purgés au prochain démarrage du service.

Le tracker envoie sa requête en arrière-plan sur chaque route, y compris l’accueil, les espaces, la connexion et l’inscription. Il ne bloque pas l’affichage du site. Une visite réelle envoie une requête entrante à Render et peut réveiller l’API endormie. L’offre Free se remettra toutefois en veille après une nouvelle période sans trafic; ce mécanisme ne garde pas le serveur éveillé en permanence.

## Lien admin

Panneau Django de production : **https://ecarnet-api.onrender.com/admin/**

Le chemin est `/admin/` par défaut; `DJANGO_ADMIN_PATH` peut le personnaliser. L’identifiant Django à saisir est l’adresse email configurée.

## Création admin sans Shell Render

Les Web Services gratuits Render n’offrent pas de Shell/SSH. Ce service étant de type Docker, Render construit l’image depuis `apps/api/Dockerfile` et utilise son `CMD` comme commande de démarrage. Après les migrations et le nettoyage, ce démarrage exécute `python manage.py bootstrap_admin --if-configured` avant Gunicorn. Le build Docker n’exécute pas de commande de gestion Django.

1. Dans le service **ecarnet-api** sur Render, ajoutez dans **Environment** :
   - `DJANGO_ADMIN_EMAIL` : une adresse dédiée à l’administration;
   - `DJANGO_ADMIN_PASSWORD` : un mot de passe robuste d’au moins 20 caractères.
2. Enregistrez les variables et déployez cette version du dépôt. Le premier démarrage crée le compte avant Gunicorn, sans commande Shell.
3. Connectez-vous au panneau avec l’email et le mot de passe saisis dans Render.
4. Après le démarrage réussi, retirez **les deux variables** de Render et redéployez. Si elles sont absentes, le bootstrap est ignoré; le compte créé reste en base.

La commande ne réinitialise pas un superadmin déjà présent et refuse de promouvoir un compte ordinaire. Utilisez une adresse admin dédiée. Si les variables sont invalides ou si l’adresse appartient à un compte ordinaire, l’erreur apparaît dans les journaux Render et l’API démarre tout de même sans créer de nouvel admin.

Ne mettez jamais de vraie valeur dans Git, dans le frontend Vercel, dans une variable `NEXT_PUBLIC_*`, ni dans un message.

## Documentation Render

- [Services gratuits et mise en veille](https://render.com/docs/free)
- [Déploiement Docker, Dockerfile et commande de démarrage](https://render.com/docs/docker)
- [Disponibilité du Shell/SSH par type de service](https://render.com/docs/ssh)
