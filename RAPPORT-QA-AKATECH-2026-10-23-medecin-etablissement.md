# Rapport QA / Release Gate — Mon E-Carnet, espaces médecin et établissement
**Date** : 23/10/2026 | **Méthode** : grille `akatech-qa-release-gate` v2.1 | **Périmètre** : espace professionnel + espace établissement (API Django et web Next.js)

> **Limite à lire d'abord.** Cet audit est fait **par lecture du code et tests sur les fonctions pures**. Je n'ai pas pu lancer Django (pas d'accès au dépôt de paquets), ni un navigateur, ni un mobile, ni mesurer la performance.
> La grille interdit de cocher une case qu'on n'a pas constatée sur le produit : les sections correspondantes sont donc listées « non vérifié », pas « OK ».

## Verdict : BLOQUÉ (provisoire)
Trois défauts de sécurité ont été trouvés et **corrigés dans cette livraison**. La règle de la grille veut que tout défaut de sécurité bloque jusqu'à validation du correctif.
**Passage à « PASS AVEC RÉSERVES » dès que** : (1) `python manage.py test` est vert, (2) les 4 vérifications manuelles ci-dessous sont faites en préproduction.

## Checks bloquants (trouvés, corrigés, à valider par exécution)
| # | Sévérité | Constat | Correctif |
|---|----------|---------|-----------|
| F1 | Sécurité / consentement | `MembershipDecisionView` acceptait une décision sur **n'importe quel statut** : un administrateur pouvait « approuver » un rattachement que le médecin avait **quitté** (ou refusé), sans nouvel accord du médecin (l'ancienne acceptation des conditions restait valable), ou « refuser » un rattachement actif. | Seule une demande `pending` se décide (verrou de ligne). Fichier `establishments/views.py`. Test : `establishments/test_audit_qa_2026_10_23.py`. |
| F2 | Sécurité / RBAC | `ProfessionalFollowUpPlanCreateView` retrouvait l'autorisation par `status="active"` seulement : pas de contrôle de l'**établissement courant**, pas de contrôle d'**expiration** (une autorisation expirée mais encore marquée active passait), identifiant mal formé → erreur 500 possible. | Même porte que les autres lectures cliniques : établissement courant + `require_scope(grant, "consultations")` + identifiant invalide traité comme refus 403. Fichier `care/views.py`. Tests : `care/test_self_access.py` (classe `FollowUpPlanGrantTests`). |
| F3 | Sécurité / cache | Aucune politique de cache par défaut sur l'API : seules quelques vues posaient `Cache-Control`. Les réponses dépendent de la session (dossier, consultations, équipe) ; un cache partagé ne doit jamais pouvoir les resservir à un autre compte. | Middleware `ApiPrivateNoStoreMiddleware` : `private, no-store` sur `/api/` quand la vue ne fixe pas déjà sa politique (le logo garde `private, max-age=3600`). Test : `identity/test_api_no_store.py`. |

## Réserves (délai de correction)
| Section | Constat | Échéance proposée |
|---------|---------|-------------------|
| Résilience | `cryptography` (copie chiffrée des codes médecin 48 h) n'est installée que via Authlib. Ajoutée à `requirements.in` ; **relancer `make lock`** pour régénérer le fichier verrouillé. | avant mise en ligne |
| Données | La clé de chiffrement des codes dérive de `DJANGO_SECRET_KEY` : si la clé change, les codes encore affichés ne sont plus lisibles (échec propre, code vide) ; il suffit d'en regénérer un. À documenter dans le runbook. | V1.1 |
| UX / sécurité | `EstablishmentDetailView` renvoie la fiche établissement (dont `internal_code`, e-mail, responsable) à tout médecin ayant **eu** un rattachement, même `refused`/`terminated`/`pending`. À restreindre aux rattachements actifs ou en attente si ce n'est pas voulu. | V1.1 (décision produit) |
| Accessibilité | Les zones de statut du scanner et des codes ont `role="status"` ; navigation clavier complète, contraste et zoom 200 % **non mesurés**. | avant Recette #3 |
| Mobile | Scanner QR : permission caméra sur iOS Safari et Chrome Android, mode photo de secours : **non essayés sur appareil réel**. | avant Recette #3 |

## Vérifié par lecture du code (OK sur le code, à confirmer à l'exécution)
- Administrateur d'établissement : chaque vue de gestion filtre par `active_administrator(user, establishment_id)` (liste, codes, équipe, photo, modèle d'ordonnance) ; tests d'isolation entre structures déjà présents (`test_item7.py`).
- Accès clinique médecin : exige contexte professionnel actif **et** rattachement `active` dans l'établissement courant (`professional_clinical_access_error`) ; chaque lecture d'un dossier passe par une autorisation propre au médecin (`professional=profile`, `require_scope`).
- Codes médecin : usage unique, haché en base, verrou de ligne à l'utilisation, limite 10 essais/heure (`code_redeem`), copie chiffrée effacée à l'usage, à la révocation et à l'expiration ; lecture réservée à l'administrateur de la structure, `no-store`.
- QR patient : usage unique, 5 minutes, jeton non consommé en cas de refus ; **nouveau** : un médecin ne peut pas ouvrir son propre dossier (403 + audit).
- Journal d'audit : liste blanche de clés, aucune donnée de santé ni code dans les métadonnées.
- Cookies : `HttpOnly`/`Secure`/`SameSite` configurés ; `DEBUG` faux par défaut ; clé secrète obligatoire hors débogage ; aucune variable `NEXT_PUBLIC_*` secrète.
- Double envoi : boutons désactivés pendant l'envoi sur les codes, la demande d'accès, le rattachement ; verrou de ligne sur la signature de consultation.

## Non vérifié (aucune case cochée)
Tests Python complets · RBAC par requêtes réelles avec deux comptes · erreur 500 provoquée (message générique, pas de trace) · alertes et journaux en production · sauvegarde/restauration · matrice navigateurs × appareils · Core Web Vitals · bundle de production (recherche de secrets) · rejeu de migration `establishments/0010` sur copie de préproduction.

## 4 vérifications manuelles à faire en préproduction
1. `python manage.py test` — tout vert, dont `care.test_self_access`, `establishments.test_audit_qa_2026_10_23`, `identity.test_api_no_store`.
2. Avec deux comptes médecin de deux établissements : l'un ne peut lire aucun dossier ni plan de suivi de l'autre.
3. Un médecin qui quitte un établissement ne peut pas être « réapprouvé » par l'administrateur (l'API répond 400).
4. Sur un téléphone Android et un iPhone : scanner un QR patient depuis l'espace médecin, de bout en bout.

## Sections N/A
SEO, tracking de conversion, webhooks, files d'attente : N/A (espaces connectés, aucun de ces modules dans ces écrans).
