# Mise à jour E‑Carnet — 14 octobre 2026 (appliquée sur la 1.9)

## Base et méthode

Archive `e-carnetv_1_9.zip`. Mes modifications (confirmations, login, cookies, parcours établissement) ont été fusionnées **fichier par fichier** : les fichiers que la 1.9 n'avait pas touchés sont repris tels quels, les 13 fichiers touchés des deux côtés ont été fusionnés à trois (base 1.7 ↔ 1.9 ↔ mes modifications) et relus à la main. Rien de la 1.9 n'est retiré : transferts de représentation, carte d'urgence, étape sécurité, nouvelle barre latérale, `PublicHeader` restent en place.

## Points d'intégration avec la 1.9

- **Destination après connexion** : les règles de la 1.9 (transfert de représentation, `/onboarding/securite`, `recovery_configured`) sont conservées ; seule la branche établissement ajoute « fiche à compléter » avant l'étape sécurité.
- **Fiche d'établissement → étape sécurité** : après la première complétion de la fiche, l'établissement enchaîne sur `/onboarding/securite` si la récupération n'est pas configurée (comme les patients et les professionnels), sinon sur son espace.
- **Barre latérale 1.9** : la garde « fiche non complétée » vit dans `SpaceShell.tsx` ; les pages `/etablissement/fiche` et `/etablissement/activation` restent des pages « nues » dans la nouvelle barre latérale.
- **Accès patient** : les confirmations (autoriser, refuser, prolonger, clôturer une pré‑consultation) ont été greffées sur les écrans réécrits de la 1.9 (boutons `consent-decision`, pré‑consultation en écrans successifs).
- **Pied de page** : l'en‑tête public est maintenant dans `PublicHeader.tsx` ; le lien « Gérer les cookies » est ajouté dans `PublicShell.tsx` et son style dans `site-pages.css` (le bloc pied de page a quitté `globals.css` en 1.9).

## Contenu (rappel)

Voir [ADR‑003](docs/adr/ADR-003-fiche-etablissement-completee-par-l-etablissement.md) et le [changelog](docs/CHANGELOG.md) : parcours établissement par nom + e‑mail (migration `0007`), faille d'écrasement de compte corrigée, modal de confirmation étendu, login à deux volets / écran d'accueil mobile, personnage « answer » animé, bannière cookies aux couleurs du thème avec lien « Gérer les cookies ». Idées complémentaires : [ROADMAP‑V2](docs/ROADMAP-V2.md).

## Test corrigé qui n'était pas de mon fait

`apps.identity.tests.OAuthRedirectTests.test_existing_oauth_account_redirects_to_active_space` échouait **sur la 1.9 seule** : un compte sans méthode de récupération est désormais envoyé vers `/onboarding/securite`. Le test configure maintenant la récupération (redirection vers l'espace) et un second test vérifie le cas sans récupération.

## Vérifications

- API : 175 tests passent (158 de la 1.9 + 17 ajoutés), 3 ignorés, `makemigrations --check` propre.
- Web : 46 tests passent (40 de la 1.9 + 6 ajoutés), `tsc --noEmit` propre, ESLint sans erreur (4 avertissements `<img>` déjà présents).
- Contrôle visuel dans Chromium sur la base 1.9 : connexion PC et mobile, bannière cookies, fiche d'établissement.
- **Non vérifié** : `next build` (polices Google non téléchargeables ici), envoi réel de courriel, parcours complet avec un vrai serveur PostgreSQL, Safari/iOS, rendu des écrans 1.9 touchés seulement par la fusion (sauf ceux listés ci‑dessus).

## À savoir avant de déployer

- Lancer la migration `establishments/0007`.
- Les comptes déjà invités avec une adresse qui a un compte doivent désormais se connecter avant d'activer.
- `ecarnet_analytics_consent` doit atteindre l'API par le proxy du front : à vérifier sur le staging, retour OAuth compris.
- **Secrets** : l'archive 1.9 contient encore `apps/api/.env` et `apps/api/db.sqlite3`. Changer la clé secrète Django, le mot de passe de la base, le secret Google et le mot de passe admin ; utiliser `scripts/make-archive.sh` pour les prochains zips.
