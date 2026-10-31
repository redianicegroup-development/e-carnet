# Mon E-Carnet — Plan AKATECH d’optimisation, capacité et montée en charge Hodi

**Version :** 29 octobre 2026  
**Statut :** plan d’exécution basé sur le code réel et le CDC v11  
**Hébergeur cible :** Hodi, offre Site Pro au démarrage, sous réserve des confirmations écrites du CDC  
**Périmètre :** backend Django/DRF, frontend Next.js, PostgreSQL, Redis, stockage privé, supervision, tests de charge et évolution vers plusieurs instances.

> Ce document ne déclare pas la production prête. Il donne l’ordre de travail et les conditions pour passer d’un pilote fictif à une exploitation réelle. Les données de santé restent interdites tant que les validations juridique, médicale, sécurité et hébergement ne sont pas signées.

## 1. Décision d’architecture recommandée

### Décision immédiate

Commencer avec **une seule application API Django en production**, PostgreSQL partagé, un reverse proxy/TLS fourni ou configuré chez Hodi, et un stockage de fichiers privé persistant séparé du répertoire remplacé lors d’un déploiement. L’offre Hodi Site Pro est cohérente pour le pilote fictif et les premiers utilisateurs, mais sa capacité n’est pas garantie par le seul nombre de comptes.

Ne pas ajouter Kubernetes maintenant. Ne pas créer trois conteneurs API sur une seule machine de 4 Go : cela ne crée pas de puissance supplémentaire et peut épuiser la RAM. Ne pas ajouter un load balancer avant d’avoir démontré que le backend ou le réseau est le goulot d’étranglement et que les instances peuvent fonctionner sans état local.

### Architecture cible du pilote

```text
Utilisateur
   |
HTTPS / domaine contrôlé par le projet
   |
Reverse proxy / terminaison TLS Hodi
   |------------------------------|
Next.js production                 Django + Gunicorn
                                   |       |       |
                                   PostgreSQL  Redis  stockage privé Hodi
                                   |
                             sauvegardes testées
```

Le frontend peut être servi comme application Next.js optimisée ou par la solution de publication Hodi. L’API doit utiliser Gunicorn, jamais `runserver`. Les fichiers médicaux, avatars, logos, cachets et signatures doivent être servis uniquement par des routes authentifiées et rester privés.

### Architecture lorsque les mesures le justifient

```text
Utilisateurs
     |
Load balancer / reverse proxy Hodi ou Nginx/HAProxy validé
     |
API Django 1 ---- API Django 2 ---- API Django N
     |                 |                 |
     +-----------------+-----------------+
                       |
              PostgreSQL + Redis partagés
                       |
              stockage privé partagé
```

Cette phase exige : sessions partagées, cache/rate limit partagé, même `DJANGO_SECRET_KEY`, migrations expand/contract, aucune dépendance au disque local, health checks liveness/readiness et déploiement progressif. Si Hodi ne fournit pas plusieurs instances derrière un répartiteur dans la même offre, il faudra demander un serveur dédié ou une architecture gérée distincte ; il ne faut pas bricoler un load balancer sur une seule VM en pensant avoir supprimé le point de panne unique.

## 2. Faits observés dans le dépôt

| Zone | État observé | Conséquence |
|---|---|---|
| API | `apps/api/Dockerfile` lance Gunicorn avec 2 workers et 4 threads | Base correcte pour un pilote, à mesurer avec le profil réel |
| API locale | `docker-compose.yml` lance `runserver`, `DJANGO_DEBUG=true` et monte le code | Configuration de développement uniquement |
| Frontend | Image Docker multi-étapes avec Next.js standalone, utilisateur non root et `node apps/web/server.js` | À valider sur le service staging Hodi avec l’URL API définitive |
| Base | PostgreSQL 16 en Compose local, `conn_max_age=60` | À tester sur la PostgreSQL Hodi avec pool et limites de connexions |
| Cache | Hors tests, `DatabaseCache` Django est utilisé | Suffisant pour une instance, mauvais choix pour plusieurs instances et rate limiting intensif |
| Redis | Hodi le propose, mais le cache applicatif actuel ne l’utilise pas par défaut | À brancher avant le scale horizontal |
| Sessions | Sessions Django côté serveur | Compatible multi-instance si la base et la clé secrète sont communes |
| Médias | Cloudinary encore présent dans les uploads et suppressions | Bloquant CDC avant données réelles ; migrer vers stockage privé Hodi ou obtenir une décision écrite |
| Sécurité API | Réponses API `private, no-store` par défaut et throttling DRF présents | Bon garde-fou ; le backend doit conserver ces protections derrière proxy |
| Santé | `/api/v1/health/live/` et `/api/v1/health/ready/` existent | Base pour le reverse proxy, l’uptime et l’autosortie d’une instance malade |
| CI | Tests Django PostgreSQL, lint, typecheck, tests web, build Next et E2E présents | Ajouter scans secrets/dépendances/images, migrations et artefact immuable |
| Sauvegardes | Script `ops/backup-db.sh` et smoke de restauration présents | Les preuves sont locales ; il faut une restauration sur staging Hodi et mesurer RPO/RTO |

## 3. Priorités de code et d’exploitation

### P0 — avant tout staging Hodi

1. **Configuration frontend implantée.** `apps/web/Dockerfile` exécute `npm ci`, `npm run build` puis démarre le serveur standalone non root. `ECARNET_API_ORIGIN` doit être fourni comme argument de build. Il reste à valider le déploiement réel sur le staging Hodi ; ne jamais utiliser `next dev` sur Hodi.
2. **Séparer migration et démarrage applicatif.** Le conteneur web ne doit pas exécuter une migration destructrice à chaque redémarrage d’une instance. La migration doit être une étape CI/CD unique, après sauvegarde, avec verrouillage et smoke test.
3. **Remplacer ou isoler Cloudinary.** Le CDC exige un stockage privé Hodi persistant, sauvegardé et restaurable avec la base. L’adaptateur de stockage doit être abstrait afin que les routes authentifiées ne dépendent pas d’une URL publique.
4. **Demander les confirmations Hodi écrites.** Persistance hors répertoire de déploiement, chiffrement, droits d’accès, sauvegardes, copie européenne, restauration, extension disque et support de plusieurs instances/load balancer.
5. **Conserver les garde-fous de santé.** Readiness doit vérifier au minimum la connexion PostgreSQL et les dépendances nécessaires ; liveness ne doit pas dépendre d’une opération lente.
6. **Créer trois environnements.** Local et staging avec données synthétiques ; production séparée, secrets séparés, base séparée. Le même artefact doit être promu de staging vers production.
7. **Renforcer la CI.** Ajouter `pip-audit`, `npm audit` avec politique documentée, gitleaks, scan d’image Trivy, vérification des migrations, build frontend production et smoke tests après déploiement.

### P1 — avant le pilote fictif Hodi

1. Passer le cache de production de `DatabaseCache` à Redis partagé pour les throttles, compteurs de récupération et futurs verrous distribués.
2. Vérifier les index sur les parcours chauds : accès QR, `AccessGrant`, délégation proche, referrals, ouvertures établissement, notifications, documents et événements d’audit. Utiliser `EXPLAIN (ANALYZE, BUFFERS)` sur une base de staging anonymisée.
3. Vérifier les payloads de listes : pagination obligatoire, limites maximales, `select_related`/`prefetch_related` confirmés, aucune sérialisation d’un dossier complet dans une inbox.
4. Mesurer les transactions concurrentes sur QR à usage unique, consentement, révocation et code de rattachement. Les contraintes uniques et `select_for_update()` doivent rester effectives sur PostgreSQL cible.
5. Plafonner et mesurer les uploads : taille PDF, taille image, quota par patient, type MIME réel, temps de transfert et consommation disque.
6. Ajouter un `request_id` propagé dans les logs, sans données médicales. Journaliser durée, code HTTP, endpoint, taille de réponse et identifiant technique, jamais le contenu clinique.

### P2 — de 800 à 2 000 patients inscrits, selon la charge réelle

**État d’implantation au 29 octobre 2026 :** le scénario k6 paramétrable A/B/C est présent dans `ops/loadtest/k6-ecarnet.js` pour 100, 300 et 1 000 utilisateurs virtuels. Les profils doivent encore être exécutés sur un staging HTTPS avec comptes synthétiques ; aucun résultat de capacité ne doit être inventé depuis l’environnement local. Un audit automatisé WCAG 2.2 AA est disponible via `npm run audit:wcag`, et la recette mobile/4G est documentée dans `docs/P2-RECETTE-MOBILE-WCAG-CHARGE.md`. Les essais avec cinq utilisateurs réels restent à organiser humainement.

1. Activer les métriques RED par route : taux, erreurs, latence p50/p95/p99. Ajouter les métriques USE : CPU, RAM, disque, connexions PostgreSQL, cache et files éventuelles.
2. Optimiser les requêtes identifiées par les mesures, pas par intuition. Priorité aux listes professionnelles, historiques, exports et téléchargements contrôlés.
3. Augmenter les ressources Hodi ou passer à Cyber+ si la fiabilité, la sauvegarde horaire ou le RTO deviennent prioritaires ; le nombre de comptes seul ne déclenche pas le changement.
4. Mettre en place une tâche de nettoyage quotidienne des QR, analytics visiteurs et objets temporaires, avec alerte en cas d’échec.
5. Tester une publication progressive et un retour arrière avec document persistant intact.

### P3 — de 2 000 à 4 000 patients ou saturation démontrée

1. Rejouer les tests de charge avec la même topologie que la production.
2. Si l’API est le goulot : augmenter d’abord CPU/RAM et le nombre de workers, puis demander plusieurs instances Hodi derrière un load balancer.
3. Si PostgreSQL est le goulot : réduire les connexions, ajouter un pool géré/PgBouncer si Hodi le permet, optimiser les requêtes et index, puis demander une base séparée ou une offre supérieure.
4. Si le disque dépasse 70–80 % : extension de stockage ou passage Archipel. Le CDC estime environ 40 Go utiles maximum sur Site Pro ; les documents réels doivent être mesurés.
5. Si le temps de réponse se dégrade sur plusieurs machines : étudier serveur dédié ou infrastructure gérée. Kubernetes ne vient qu’après une justification d’exploitation, de budget et de compétences.

## 4. Règle de décision pour le load balancer

Le load balancer n’est **pas** lié à un seuil arbitraire de patients. Il devient justifié si toutes les conditions suivantes sont remplies :

- le test de charge montre que le service API est le goulot, et non PostgreSQL, stockage ou réseau ;
- deux instances peuvent traiter les mêmes requêtes avec la même base et le même cache ;
- aucun fichier ou état de session critique ne dépend du disque local ;
- Redis ou une alternative partagée est disponible pour les compteurs et verrous ;
- liveness/readiness permettent de retirer une instance malade ;
- les migrations sont compatibles avec N-1/N/N+1 ;
- Hodi confirme le mécanisme, le coût, les IP, les certificats, les logs et le comportement en panne.

### Seuils de déclenchement proposés, à confirmer par le pilote

| Signal sur 15 minutes | Vert | Attention | Action |
|---|---:|---:|---|
| Latence API p95 parcours lecture | < 500 ms | 500–1 000 ms | Optimiser puis augmenter ressource |
| Latence API p95 écriture/consentement | < 800 ms | 800–1 500 ms | Vérifier transaction et DB |
| Erreurs HTTP 5xx | < 0,5 % | 0,5–1 % | Incident et analyse immédiate |
| CPU soutenu | < 60 % | 60–75 % | Profilage/rightsizing |
| RAM soutenue | < 70 % | 70–85 % | Réduire workers ou augmenter RAM |
| PostgreSQL connexions utilisées | < 60 % | 60–80 % | Pool et plafond de connexions |
| Disque | < 60 % | 60–75 % | Nettoyage, quotas, extension |
| Cache/rate limit | < 1 % erreur | 1–2 % | Redis et réseau à vérifier |

Un seul dépassement ponctuel n’impose pas un load balancer. Un dépassement soutenu, reproductible sous charge et confirmé par profilage peut déclencher la phase multi-instance.

## 5. Scénario de test de charge

Les tests doivent tourner sur staging Hodi avec données synthétiques et jamais sur la production. Ils doivent respecter des limites de débit raisonnables et ne pas téléverser de données personnelles.

### Profils

- **Profil A — 100 utilisateurs actifs :** connexion, accueil, lecture du dossier, notifications, carte d’urgence.
- **Profil B — 300 utilisateurs actifs :** mélange patient/professionnel/établissement, lecture de listes, consentement et révocation.
- **Profil C — 1 000 utilisateurs actifs :** montée progressive, maintien 15–30 minutes, puis pic court ; uniquement après validation du profil B.
- **Profil D — uploads :** images/PDF synthétiques avec tailles représentatives, séparé du test API afin d’identifier le stockage comme goulot.
- **Profil E — concurrence sécurité :** deux consommations simultanées du même QR ou code ; une seule doit réussir.

### Critères de sortie

- aucun contournement d’autorisation ;
- zéro double consommation d’un QR ou d’un code ;
- aucune donnée clinique dans les logs ou caches intermédiaires ;
- p95 dans les budgets convenus ;
- aucune fuite mémoire sur 30 minutes ;
- restauration et cohérence base/fichiers vérifiées après test ;
- rapport daté avec charge, version, configuration, résultats et décision.

## 6. Plan d’observabilité minimal

À installer avant le pilote :

- uptime externe sur liveness et readiness ;
- logs structurés API et proxy ;
- erreurs frontend/backend dans un outil maîtrisé, avec masquage des données sensibles ;
- dashboard CPU, RAM, disque, PostgreSQL, latence, 4xx/5xx et cache ;
- alerte de certificat à moins de 14 jours ;
- alerte de sauvegarde échouée, disque > 75 %, 5xx soutenus et readiness indisponible ;
- procédure d’incident avec propriétaire, gravité, rollback et communication ;
- test mensuel de restauration sur environnement isolé, avec RPO/RTO mesurés.

## 7. Questions à envoyer à Hodi avant commande

1. Site Pro permet-il un dossier persistant privé, non supprimé lors d’un déploiement et inclus dans les sauvegardes ?
2. Ce dossier peut-il être utilisé pour les documents médicaux, logos, cachets, signatures et avatars avec contrôle d’accès serveur ?
3. L’offre autorise-t-elle explicitement les données de santé avec une instruction spécifique écrite ?
4. Les données de production et les sauvegardes sont-elles chiffrées au repos et en transit ? Qui peut y accéder ?
5. La copie de sauvegarde en Allemagne peut-elle être désactivée ou remplacée par une copie en Côte d’Ivoire ?
6. Quel est le RPO/RTO contractuel de Site Pro, Cyber+ et Archipel ?
7. Hodi fournit-il plusieurs instances applicatives derrière un load balancer ? À partir de quelle offre et à quel coût ?
8. Redis est-il partagé, persistant et adapté au rate limiting distribué ?
9. Quel est le prix d’une extension de stockage et la procédure de migration vers Archipel/dédié ?
10. Comment exporter et restaurer ensemble la base et les fichiers, et comment tester cette restauration ?

## 8. Ordre de réalisation concret

1. Valider l’image frontend production sur staging et séparer migrations/démarrage.
2. Obtenir les réponses écrites Hodi et trancher le stockage privé.
3. Déployer staging Hodi fictif avec domaine contrôlé, HTTPS, secrets séparés et sondes.
4. Brancher Redis partagé, logs structurés et métriques.
5. Rejouer les tests PostgreSQL, sécurité, concurrence et restauration.
6. Exécuter les profils de charge A puis B ; publier un rapport.
7. Corriger les goulots mesurés ; seulement ensuite décider Site Pro, Cyber+ ou Archipel.
8. Exécuter le rollback et le restore drill ; obtenir le Go/No-Go QA, juridique et médical.
9. Ouvrir un pilote fictif limité.
10. Refaire la mesure avant toute donnée réelle et avant toute architecture multi-instance.

## 9. Conclusion

Le bon plan pour Mon E-Carnet n’est pas de mettre immédiatement un load balancer ou Kubernetes. Le bon plan est : **production réelle du frontend, stockage privé maîtrisé, Redis partagé, sauvegarde restaurée, observabilité, tests de charge, puis rightsizing Hodi**. Le load balancer devient une décision mesurée lorsque plusieurs instances apportent réellement un gain et que l’application est sans état local. Cette approche respecte le CDC, limite les coûts et protège les données médicales avant la recherche de performance.
