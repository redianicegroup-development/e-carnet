# Mise à jour du 08/11/2026 — audit AKATech v6 + landing

À dézipper par-dessus le projet V1_7_3-1 (mêmes chemins). Aucune migration de base de données.

## À faire à la main (un patch ne peut pas supprimer de fichiers)

```bash
rm -rf apps/api/private-media          # SEC-02 : 5 documents téléversés de test, jamais dans une archive
rm -f  apps/api/db.sqlite3             # base locale (comptes et déclarations de test) : ne pas livrer non plus
```

## Variables d'environnement à mettre à jour sur l'hébergeur

| Variable | Valeur | Pourquoi |
|---|---|---|
| `DJANGO_HSTS_SECONDS` | `31536000` | SEC-07. La valeur `86400` posée dans l'environnement actuel écrase le nouveau défaut. |
| `ECARNET_SESSION_AGE_SECONDS` | `604800` | SEC-04 : session de 7 jours (au lieu de 30). |
| `ECARNET_PRIVILEGED_IDLE_SECONDS` | `1800` | SEC-04 : déconnexion après 30 min d'inactivité des comptes professionnels, établissement et staff (0 = désactivé). |
| `ECARNET_CSP_REPORT_URI` (web, facultatif) | URL de collecte | SEC-01 : reçoit les rapports de la CSP « Report-Only ». |
| `ECARNET_CSP_ENFORCE` (web, facultatif) | `true` | SEC-01 : bascule la même CSP en mode bloquant, après 2 semaines de rapports propres. |
| `ECARNET_HSTS_INCLUDE_SUBDOMAINS` / `DJANGO_HSTS_INCLUDE_SUBDOMAINS` | `true` | SEC-07 : seulement quand tous les sous-domaines sont servis en HTTPS. |

## Ce que contient la mise à jour

- **SEC-01** en-têtes de sécurité du web (`apps/web/next.config.ts`) : nosniff, anti-cadrage, Referrer-Policy, Permissions-Policy (caméra autorisée pour le scanner), COOP, HSTS ; CSP en Report-Only.
- **SEC-02** `.dockerignore` (documents et bases locales), contrôle CI « aucun document dans le dépôt ».
- **SEC-04** session 7 jours, déconnexion des comptes sensibles après inactivité, « Se déconnecter de tous les appareils » (3 espaces), textes légaux et aide alignés.
- **SEC-05** `Idempotency-Key` + délai maximal + reprises sûres côté client ; rejeu côté API (`apps/api/apps/identity/idempotency.py`).
- **SEC-06** job CI « chaîne d'approvisionnement » (npm audit, pip-audit, gitleaks), CodeQL, `renovate.json` (délai de 10 jours).
- **SEC-07** HSTS d'un an côté API et côté web.
- **UX-01** allergies : « Aucune allergie connue » / « Je ne sais pas » sont des choix ; le champ libre refuse « Je n'es pas »… ; la carte d'urgence dit « Non renseigné » et affiche la date de déclaration.
- **UX-03** audit axe étendu (espaces connectés, palettes, contrastes mesurés, focus masqué, cibles), job CI bloquant sur les pages publiques, contrastes des couleurs dérivées corrigés sur la teinte c2, marges de focus, cibles ≥ 24 px.
- **Landing** : sections reprises de la maquette HTML (héro, FAQ, contact et pied de page de l'app conservés).

## Vérifications à lancer chez toi (non exécutables dans mon environnement)

```bash
npm ci && npm run lint && npm run typecheck && npm run test:web
cd apps/api && python manage.py makemigrations --check && python manage.py test
```

Audit d'accessibilité des espaces connectés (recette) :

```bash
SPACES=patient,professionnel,etablissement A11Y_PALETTES=all \
A11Y_PATIENT="courriel:mot de passe" A11Y_PROFESSIONNEL="…" A11Y_ETABLISSEMENT="…" \
node ops/accessibility-wcag-audit.mjs
```

## Limites connues

- `SameSite=None` reste sur les cookies : l'état OAuth Apple est dans la session et le retour d'Apple est un POST inter-sites. Passer en `Lax` demande de déplacer cet état dans un cookie dédié.
- La CSP reste en Report-Only avec `'unsafe-inline'` : l'étape suivante est un nonce par requête (middleware).
- Les constantes `FEATURES`, `STEPS` et `SAFEGUARDS` de `landing-content.ts` ne sont plus affichées par la landing ; elles restent car des tests les lisent.
