# P2 — recette charge, accessibilité et mobiles

## État au 29 octobre 2026

| Chantier | État | Preuve / blocage |
|---|---|---|
| k6 100 utilisateurs | Script prêt | Exécution requiert staging et comptes synthétiques |
| k6 300 utilisateurs | Script prêt | Exécuter après validation du profil 100 |
| k6 1 000 utilisateurs | Script prêt | Exécuter après validation du profil 300 ; durée plus longue |
| Audit WCAG 2.2 AA | Automatisé : 0 violation sur 10 routes locales | `reports/wcag-2.2-aa-automated.json`; compléter par revue clavier et lecteur d’écran |
| Cinq utilisateurs mobiles réels en 4G | Non exécuté | Nécessite cinq personnes, leurs appareils et un staging accessible |
| Matrice Android/iPhone/navigateurs | Préparée | Voir tableau ci-dessous ; résultats à renseigner pendant la recette |
| Images non optimisées | Images hero recompressées | Vérifier le poids dans Lighthouse/DevTools après déploiement |

## Exécution k6

Uniquement sur staging synthétique, jamais sur production :

```bash
k6 run -e BASE_URL=https://staging-api.example.com \
  -e WEB_ORIGIN=https://staging.example.com \
  -e PROFILE=A -e TEST_USERS='[...]' ops/loadtest/k6-ecarnet.js
k6 run -e BASE_URL=https://staging-api.example.com \
  -e WEB_ORIGIN=https://staging.example.com \
  -e PROFILE=B -e TEST_USERS='[...]' ops/loadtest/k6-ecarnet.js
k6 run -e BASE_URL=https://staging-api.example.com \
  -e WEB_ORIGIN=https://staging.example.com \
  -e PROFILE=C -e TEST_USERS='[...]' ops/loadtest/k6-ecarnet.js
```

A doit être validé avant B, et B avant C. Les profils font des lectures patient authentifiées et vérifient p95/p99, erreurs 5xx, 429, échecs de connexion et checks. Utiliser au moins autant de comptes synthétiques que de VUs pour éviter de mesurer un partage de compte ou le limiteur par e-mail.

## Audit WCAG automatisé

```bash
BASE_URL=http://127.0.0.1:3000 node ops/accessibility-wcag-audit.mjs
```

Le rapport est écrit dans `reports/wcag-2.2-aa-automated.json`. Il couvre les règles automatisables axe sur les routes déclarées. Il ne remplace pas : navigation clavier complète, zoom 200 %, reflow 320 px, contraste vérifié dans les états interactifs, lecteur d’écran, erreurs de formulaire et authentification.

## Matrice mobile recommandée

| Famille | Appareil / OS | Navigateur | Parcours minimum | Résultat |
|---|---|---|---|---|
| Android entrée/milieu de gamme | Android 12–14 | Chrome stable | connexion, onboarding, carnet, QR, consultation | À renseigner |
| Android alternatif | Android 13–14 | Firefox stable | mêmes parcours + retour arrière | À renseigner |
| Android WebView | Android 13–14 | Chrome WebView / PWA installée | installation, offline carte urgence, reprise réseau | À renseigner |
| iPhone récent | iOS 17–18 | Safari | inscription, accès, déclaration, partage | À renseigner |
| iPhone alternatif | iOS 16–18 | Chrome iOS | mêmes parcours, upload photo/document | À renseigner |
| Desktop de contrôle | Windows/macOS récent | Chrome, Firefox, Safari/Edge | formulaires, tableaux, navigation clavier | À renseigner |

## Protocole pour cinq utilisateurs réels en 4G

Ne pas utiliser de données de santé réelles. Créer des comptes et déclarations fictifs. Pour chaque participant :

1. ouvrir la landing puis créer ou utiliser un compte de test ;
2. parcourir onboarding et accueil ;
3. ajouter une déclaration fictive ;
4. ouvrir la carte d’urgence en ligne puis couper le réseau et vérifier le message d’obsolescence ;
5. préparer une pré-consultation ;
6. tester une erreur de formulaire et la récupération ;
7. mesurer temps de chargement perçu, blocage, texte incompris, bouton inaccessible et perte de réseau ;
8. supprimer le compte de test après la session.

Consigner appareil, OS, navigateur, réseau/opérateur, débit approximatif, durée, incidents et verbatim. L’acceptation P2 exige qu’aucun participant ne soit bloqué sur les parcours critiques et que tous les problèmes de gravité élevée aient une correction ou une décision documentée.
