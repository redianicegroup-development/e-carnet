# ACS-13 — Accès d’urgence « bris de glace » (version 1.8, 12/11/2026)

**État : codé, testé en source, désactivé.** `ECARNET_BREAK_GLASS_ENABLED=false` par défaut : toutes les routes répondent 404 `break_glass_disabled` et l’interface n’affiche rien. **Aucune activation en production sans les trois décisions écrites ci-dessous.**

## Les trois décisions qui restent à signer (hors code)

1. **Avis juridique** : base légale du bris de glace en Côte d’Ivoire, rôle de l’ARTCI (la déclaration et les pages de confidentialité doivent décrire ce traitement avant activation).
2. **Définition stricte de l’urgence et de qui l’invoque.** Le code retient : patient inconscient, danger vital immédiat, ou impossibilité de consentir lors d’une urgence médicale ; invocable par tout professionnel **vérifié** avec un rattachement **actif** dans un établissement **actif**. Si le comité veut restreindre à certaines fonctions (médecin, infirmier…), c’est une condition à ajouter dans `break_glass._eligible_professional`.
3. **Validation par le comité du projet.**

## Ce qui est livré

| Exigence | Où et comment |
|---|---|
| Modèle `EmergencyAccessRequest` : professionnel, établissement, motif (liste fermée + texte libre obligatoire), horodatage, durée ≤ 1 h non renouvelable | `care/models.py` + migration `0030_emergency_access`. Immuable (ni modification ni suppression), contraintes en base (motif non vide, fin après début). Une table à part, `EmergencyAccessReview`, porte la revue. |
| Accès limité à la fiche d’urgence | `break_glass.emergency_summary` : identité, groupe sanguin, allergies, traitements, antécédents déclarés. Lu en direct dans les déclarations du patient. Ni contact d’urgence, ni coordonnées, ni consultations, documents ou mesures. Aucune autorisation d’accès au carnet n’est créée. |
| Accès toujours visible | Notification immédiate au patient (jamais regroupée) ; personnes de confiance actives **si** `ECARNET_TRUSTED_CONTACTS_ENABLED` ; ligne dans l’historique d’accès du patient ; audit `break_glass.*` de sévérité critique ; notification aux administrateurs de l’établissement. |
| Revue a posteriori sous 72 h | Liste et décision dans l’espace établissement (`/etablissement/urgences`). Décision unique et définitive : *justifié* ou *non justifié* (note obligatoire). Un administrateur ne revoit pas son propre accès ; on ne revoit pas un accès encore ouvert. |
| Abus : sanction et signalement | Incident de sécurité critique (`OperationalIncident`, visible de l’équipe Mon E‑Carnet), événement d’audit `break_glass.abuse_flagged`, patient prévenu. La **sanction** reste une décision humaine (suspension du rattachement par les écrans existants). |
| Revue en retard | Commande `python manage.py review_break_glass_overdue` : incident « majeur » et notification des administrateurs, **une seule fois par accès**. À planifier (cron) toutes les heures. |
| Drapeau | `ECARNET_BREAK_GLASS_ENABLED=false`. `ECARNET_BREAK_GLASS_DURATION_MINUTES` ne peut que **raccourcir** la fenêtre (plafond 60). |

## Choix faits dans le code (à confirmer avec la décision n° 2)

- **Identification du patient.** Le cahier des charges ne le dit pas. Le patient est désigné par son **identité exacte** (nom, prénom, date de naissance ; le téléphone départage seulement des homonymes), accents et majuscules ignorés. Aucune recherche libre : réponse **identique** que le dossier n’existe pas, soit ambigu ou soit le dossier du professionnel lui-même ; échecs tracés **sans** l’identité saisie ; 6 demandes par heure et par professionnel. Le motif est contrôlé **avant** toute recherche.
- **Non renouvelable** = même professionnel, même patient : refus pendant 24 h après la première demande. Rejouer la demande pendant la fenêtre retrouve le même accès, sans le prolonger. Un autre professionnel de la structure peut ouvrir son propre accès (son motif, sa revue).
- **Pas d’accès d’urgence si le patient a déjà ouvert un accès** à ce professionnel (code `consent_available`).
- **« Antécédents majeurs »** : le modèle n’a pas de drapeau « majeur » ; tous les antécédents déclarés sont donc inclus (20 au plus). Un champ « à montrer en urgence » choisi par le patient serait la bonne évolution.
- **Contact d’urgence exclu** du périmètre, conformément à la liste du cahier des charges. L’ajouter est une décision.
- Le texte libre du motif n’est **jamais** recopié dans l’audit ni dans les notifications ; l’administrateur le lit pour sa revue.
- La fiche s’efface de l’écran du professionnel à la fin de l’heure (compte à rebours), rien n’est gardé sur l’appareil, et les pages d’urgence ne sont pas préchargées hors connexion : un accès d’urgence se trace en ligne.

## Tests

- API : `apps/api/apps/care/test_break_glass.py` — les quatre tests exigés (*sans motif → refus ; au-delà d’1 h → refus ; le patient est notifié ; l’accès ne dépasse jamais le périmètre d’urgence*) puis drapeau, identification, non-renouvellement, durée plafonnée, rôles, isolation entre établissements, revue, abus, retard, immutabilité.
- Web : `apps/web/tests/bris-de-glace-acs13-2026-11-12.test.mjs`.
- **Non exécutés dans l’environnement de préparation** (pas de Django installé, pas de réseau) : lancer `python manage.py makemigrations --check` (la migration est écrite à la main) puis `python manage.py test apps.care.test_break_glass`.

## Avant d’activer

1. Les trois décisions signées et archivées.
2. Pages de confidentialité, CGU, déclaration ARTCI et information du patient mises à jour.
3. Cron `review_break_glass_overdue` en place ; une personne désignée côté équipe pour traiter les incidents `break-glass-abuse:*`.
4. Essai à blanc en préproduction avec un compte établissement et un compte patient.
