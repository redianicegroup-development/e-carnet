# v1.4 finale (31/10/2026) — fusion de toutes les séries

Cette archive réunit :
1. **v1.1 corrigée** (`e-carnet_v1_1-corrige.zip`, travail d'une autre session) : navigation avec bouton central surélevé, accueil en vitrine avec tuiles pliables, consultations en deux étapes (pré-consultation puis accès temporaire), page Historique, onboarding sans doublon, en-tête « Moi », page `/proches-et-enfants`, crédits avec le logo actuel, liste d'e-mails d'exploitation fermée, webhook de surveillance horodaté, incident résolu, archivage, CDC v12 (`docs/.cdc/`). Voir `MODIFICATIONS-2026-10-28-interface-et-fusion.md` et `MANIFESTE-2026-10-28.txt`.
2. **v1.2** : lot du 28/10 (carte d'urgence hors connexion, plans de suivi), mode d'emploi des clés VAPID, workflow de verrouillage de `pywebpush`. Voir `MANIFESTE-2026-10-28-lot-urgence-plans.txt`.
3. **v1.3** : export Excel par période, journal d'audit consultable, connexion Google seule, suppression de l'alerte de la carte d'urgence publique. Voir `MODIFICATIONS-2026-10-29-v1.3.md`.
4. **v1.4** : lot P2 (charge, WCAG, mobile), motif « Urgence » et ouverture sans limite de durée (ETA-09), jours de la semaine et rappel de renouvellement (PAT-14). Voir `MODIFICATIONS-2026-10-29-v1.4.md`.

## Comment la fusion a été faite
Base commune : v1.1. Les changements de la v1.1 corrigée (63 fichiers) et ceux des v1.2 à v1.4 (59 fichiers) ne se recoupent que sur 4 fichiers :
- `apps/api/config/settings.py` : les deux séries de réglages sont conservées (durée d'ouverture de dossier, renouvellement des rappels, tolérance du webhook, étiquette d'environnement).
- `apps/web/src/components/PatientCarnet.tsx` : l'autre session a retiré l'import des pré-consultations (déplacées dans le parcours de consultation) ; mon import de `PatientCarnetExport` est conservé.
- `apps/web/src/app/info-pages.css` : fusion automatique sans conflit.
- `MANIFESTE-2026-10-28.txt` : deux manifestes différents portaient ce nom ; le mien est renommé `MANIFESTE-2026-10-28-lot-urgence-plans.txt`.

Compatibilité vérifiée : le journal d'audit (v1.3) s'appuie sur la liste d'exploitation désormais fermée par défaut (ses tests déclarent la liste) et sur les clés d'audit, auxquelles l'autre session n'a fait qu'ajouter (`incident_key`, `category`, `severity`). Aucune migration ajoutée par l'autre session : la numérotation reste `care 0024`, `establishments 0013`, sans doublon.

## Vérification
Tests web : 215 tests, 209 réussis, 6 en échec. Ce sont les mêmes 6 que dans la v1.1 corrigée prise seule (aide, rattachement médecin, QR visite, schémas, stockage local, cache de thème) : la fusion n'en ajoute aucun. Syntaxe des 253 fichiers TypeScript, `sw.js` et tous les fichiers Python vérifiés. **Non exécutés ici** : tests Django (l'autre session indique 460 réussis sur sa version ; non revérifié sur la fusion), `makemigrations --check`, ESLint, `next build`, rendu à l'écran.

## Points encore ouverts
- Rendez-vous côté professionnel et établissement (le patient ne choisit pas de destinataire).
- Écran d'ouverture de dossier avec choix du motif (API seulement).
- Web push : désabonnement à la déconnexion (appareil partagé), `README-CORRECTIONS.md` cité par le script k6 mais absent, `push-web.patch` et `phase2-celery` à retirer de la racine, verrouillage de `pywebpush`, clés VAPID, cron, essais sur vrais téléphones, test de charge.
- Questions posées par l'autre session : le sens de « identité visuelle, dernière image », carte virtuelle en tuile pliable ou en fenêtre, et l'ordre des écrans des maquettes (Aujourd'hui, agenda, cartes de consultation avec sceau).
