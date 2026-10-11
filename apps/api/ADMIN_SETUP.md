# Render Free : console admin et visiteurs anonymes

## Console admin côté application

La console personnalisée est servie par le frontend E‑Carnet : **https://e-carnetci.vercel.app/admin/**. Elle utilise la session de connexion habituelle, puis l’API n’autorise le dashboard qu’aux comptes dont `is_superuser=True`. Les comptes simplement `is_staff` ne peuvent pas l’ouvrir.

Le tableau présente les compteurs agrégés des visiteurs pseudonymes : visiteurs récents, activité 24 h, pages consultées, authentifications et échecs de connexion. La console ne donne pas accès aux dossiers patients et n’affiche pas d’emails, d’adresses IP, d’user-agents, de mots de passe ou d’URL complètes. La route `/admin/` de Django Admin n’est plus exposée par l’API.

## Données visiteurs

Le cookie `ecarnet_visitor` dure 30 jours. Il est `HttpOnly` et `Secure` en production; `SameSite=None` permet les retours OAuth POST. Le serveur garde une catégorie de page et des compteurs agrégés, pas une ligne détaillée par clic. L’identifiant est pseudonyme, pas une preuve d’identité. Les agrégats inactifs depuis 90 jours sont purgés au prochain démarrage du service.

Le tracker envoie sa requête en arrière-plan sur chaque route, y compris l’accueil, les espaces, la connexion et l’inscription. Il ne bloque pas l’affichage du site. Une visite réelle envoie une requête à Render et peut réveiller l’API endormie; l’offre Free peut ensuite se remettre en veille.

## Création du compte superadministrateur sans Shell Render

Les Web Services gratuits Render n’offrent pas de Shell/SSH. Ce service étant de type Docker, Render construit l’image depuis `apps/api/Dockerfile` et utilise son `CMD` comme commande de démarrage. Après les migrations et le nettoyage, le démarrage exécute `python manage.py bootstrap_admin --if-configured` avant Gunicorn. Le build Docker n’exécute pas la commande de gestion.

1. Dans le service **ecarnet-api** sur Render, ajoutez dans **Environment** :
   - `DJANGO_ADMIN_EMAIL` : une adresse dédiée à l’administration;
   - `DJANGO_ADMIN_PASSWORD` : un mot de passe robuste d’au moins 20 caractères.
2. Enregistrez les variables et déployez cette version du dépôt. Au démarrage, le bootstrap crée le compte superadministrateur avant Gunicorn.
3. Ouvrez **https://e-carnetci.vercel.app/admin/** et connectez-vous avec ces identifiants.
4. Après la création, retirez **les deux variables** de Render et redéployez. Le compte reste enregistré en base.

La commande ne réinitialise pas un superadmin déjà présent et refuse de promouvoir un compte ordinaire. Si les variables sont invalides ou si l’adresse correspond à un compte ordinaire, l’erreur apparaît dans les journaux et le service démarre sans créer un nouvel administrateur. N’inscrivez jamais les vrais identifiants dans Git, dans le frontend, une variable `NEXT_PUBLIC_*` ou un message.

## Documentation Render

- [Services gratuits et mise en veille](https://render.com/docs/free)
- [Déploiement Docker, Dockerfile et commande de démarrage](https://render.com/docs/docker)
- [Disponibilité du Shell/SSH par type de service](https://render.com/docs/ssh)
