# Accès administrateur E‑Carnet

## Lien

Panneau Django de production : **https://ecarnet-api.onrender.com/admin/**

Le chemin est `/admin/` par défaut. S’il est personnalisé par `DJANGO_ADMIN_PATH`, utilisez cette valeur à la place. L’identifiant de connexion Django est l’adresse email configurée.

## Création initiale du compte

La commande crée un superutilisateur uniquement quand elle est exécutée explicitement; le démarrage de l’API ne crée ni ne promeut automatiquement de compte.

1. Dans Render, ouvrez le service backend **ecarnet-api** et ajoutez dans **Environment** :
   - `DJANGO_ADMIN_EMAIL` : une adresse dédiée à l’administration;
   - `DJANGO_ADMIN_PASSWORD` : un secret d’au moins 20 caractères, choisi avec un gestionnaire de mots de passe.
2. Dans le Shell du service Render, exécutez :

   ```sh
   python manage.py bootstrap_admin
   ```

3. Connectez-vous au panneau avec cette adresse email et le mot de passe saisis dans Render.
4. Une fois la création terminée, retirez `DJANGO_ADMIN_PASSWORD` des variables Render si vous n’en avez plus besoin. La commande ne réinitialise pas le mot de passe d’un superadmin déjà créé.

Ne mettez jamais ces valeurs dans Git, dans le frontend Vercel, dans une variable `NEXT_PUBLIC_*`, ni dans un message ou une capture d’écran. Si l’adresse est déjà associée à un compte ordinaire, la commande refuse de lui attribuer les droits superadmin; utilisez une adresse dédiée.
