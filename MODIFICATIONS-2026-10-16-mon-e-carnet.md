# Mon E‑Carnet — modifications du 16 octobre 2026 (base : `e-carnet_v13.zip`)

Contenu de l'archive : uniquement les fichiers modifiés ou ajoutés par rapport à la v13 (chemins d'origine conservés). Voir `docs/CHANGELOG.md` pour le résumé.

## Fusion avec la v13 (À propos, Crédits, en-tête, pied de page)

Les modifications ont été développées sur la v12 puis fusionnées (fusion à trois voies) dans la v13. Seuls des renommages touchaient les fichiers de ton lot : `a-propos/page.tsx`, `credits/page.tsx`, `lib/credits.ts`, `PublicHeader.tsx`, `PublicShell.tsx`. Ta version a été conservée, le renommage « Mon E‑Carnet » y a été rejoué (le filigrane du pied de page devient « MON E‑CARNET », avec une taille réduite pour garder la même emprise). Les deux entrées du `CHANGELOG.md` sont conservées.

**Attention : l'archive v13 ne contient pas `apps/web/public/`.** Les fichiers de ce dossier que j'ai modifiés (`llms.txt`, `manifest.webmanifest`, titres des SVG de marque) partent de leur version v12 : compare-les avec ceux de ton projet avant de les écraser (ils ne portent que le renommage). Le test du pied de page exige `public/brand/akatech-studio-logo.webp`, absent de l'archive : il échoue ici pour cette seule raison.

## À faire une fois, dans cet ordre

1. `cd apps/api && python manage.py migrate` : applique `patients.0008` (nouveaux types de déclaration `city` et `emergency_contact`, avec **recopie** de la ville et du contact d'urgence déjà saisis sur les cartes ; les colonnes de la carte ne sont pas effacées).
2. `make lock` (Python 3.12, avec réseau) puis commiter `apps/api/requirements.txt` : génère les versions exactes et les empreintes à partir de `requirements.in`. **Tant que ce n'est pas fait, l'étape CI « Dépendances verrouillées » échoue volontairement.** Le Dockerfile n'a pas à changer : pip passe en mode empreintes dès qu'elles existent.
3. Rejouer : `python manage.py test`, `python manage.py makemigrations --check --dry-run`, `npm test`, `npm run lint`, `npm run build`.

## Ce qui a été vérifié ici, et ce qui ne l'a pas été

Environnement de travail sans réseau : Django, Next.js et leurs dépendances n'étaient pas installables.

| Vérifié | Comment |
|---|---|
| Tests web | 89 réussis sur 90 sur l'arbre fusionné (en ajoutant un fichier `.webp` factice pour le test du pied de page, voir ci‑dessus). L'échec restant (`un thème enregistré est mis en cache…`) échoue aussi sur la v12 et la v13 non modifiées : le paquet `@ecarnet/ui` n'est pas lié sans `npm install`. |
| Rendu et interactions | Les vrais composants (`AppSidebar`, `GooeyAccountMenu`, `PatientCarnet`, `PatientPreconsultations`, `RecoveryRequestForm`, carte d'urgence) compilés avec esbuild et joués dans Chromium : mobile 390 px et desktop 1280 px, palettes lavande, miel et sauge, goutte de navigation et menu observés image par image au ralenti, Échap, focus, absence de débordement horizontal. |
| Syntaxe et imports | 91 fichiers TS/TSX modifiés compilés sans erreur ; tous les imports relatifs résolus ; Python : compilation, noms indéfinis et imports contrôlés ; migration `0008` comparée au modèle (mêmes choix, même `max_length`). |
| **Non exécuté** | **Tests Django** (les nouveaux sont écrits : `care.tests`, `patients.tests`), `makemigrations --check`, `next build`, `eslint`, `tsc`. À rejouer avant de déployer. |

## Décisions à confirmer

- **Audit** : un événement `clinical_data.read` **par patient et par requête** (avec `resource_count`), pas un seul par requête : un événement ne référence qu'un patient, et chaque patient doit retrouver la lecture dans son propre journal.
- **Récupération de compte** : la v12 n'avait aucune page de récupération (la question secrète seule ne suffit pas, cf. `ARCHITECTURE.md`). `/connexion/recuperation` envoie donc une demande à l'équipe par la boîte de contact (préfixe `[Récupération de compte]`), sans réinitialisation automatique. Une vraie réinitialisation reste une décision de sécurité à prendre (point A3 du dossier juridique).
- **QR** : il reste activable/désactivable (consentement explicite) ; ce qui disparaît, c'est le renouvellement. Il est replié par défaut.
- **Polices** : libellés écrits avec « and » comme demandé (« Sora and Bricolage »…) ; passer à « et » = une ligne dans `packages/ui/src/themes.ts`.
- **Textes légaux** : le nom du service y est remplacé par « Mon E‑Carnet » et la fiche « pré‑consultation » de la politique de confidentialité ne mentionne plus l'établissement destinataire : à faire valider par le conseil juridique.
- Une consultation exige toujours une pré‑consultation préparée. Aucun endpoint ne lit encore `declarations` ni `consultations` : `require_scope()` est prêt pour eux.

## Restes connus

- Le logotype « e‑carnet » du fichier `logo-horizontal.svg` est dessiné en tracés : à redessiner en « Mon E‑Carnet ».
- Deux libellés de choix dans `identity/models.py` (« Une question sur E‑Carnet », « Je découvre E‑Carnet ») gardent l'ancien nom : les changer demande une migration, hors de ce lot.
- Colonnes héritées de `PatientEmergencyCard` (`city`, `contact_name`, `contact_phone`, `offline_declaration_ids`) à supprimer dans une migration ultérieure, une fois la recopie constatée en production.
- Le patient ne peut toujours pas retirer une déclaration depuis l'interface (l'API le permet).
