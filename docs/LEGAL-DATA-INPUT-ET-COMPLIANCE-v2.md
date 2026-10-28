# Mon Carnet Numérique — LEGAL DATA INPUT, Compliance Matrix et champs à compléter

**Version 2 — 11 octobre 2026 — AKATech, Module 8 « Legal & Compliance » (mode juridique)**
**Établie sur `e-carnet_v1.zip` avec le `globals.css` rétabli (`e-carnet-admin-client`).** Elle remplace la version 1, rédigée sur la version précédente du projet.
**Statut : brouillon préparatoire. ⚠️ VALIDATION JURIDIQUE RECOMMANDÉE.** Ce document n’est ni un avis juridique ni une déclaration de conformité. Il complète `DOSSIER-REVUE-JURIDIQUE-v3.md`, qu’il ne remplace pas.

**Pages :** `/mentions-legales`, `/confidentialite`, `/cgu`, et `/credits` (non juridique). Tant que `LEGAL_REVIEW.status` vaut `"pending"` (`apps/web/src/lib/legal/config.ts`), les trois pages juridiques affichent un bandeau « version provisoire ».

---

## 1. Ce qui a changé dans le projet, et dans les textes

| Nouveauté du code | Effet sur les textes juridiques |
|-------------------|----------------------------------|
| **Suivi de visites** : `AnonymousVisitorTracker` est monté sur toutes les pages et appelle l’API ; cookie `ecarnet_visitor` de 30 jours ; table `AnonymousVisitor` | Mon texte « aucun outil de mesure d’audience » devenait **faux**. La politique le décrit désormais (données, cookie, destinataires, durée) et signale l’absence de choix préalable. |
| **Photo de profil enregistrée** : `avatar_data` (image réduite, 250 Ko au plus, stockée dans la base) | Le texte « E-Carnet n’héberge pas cette image » devenait faux. Corrigé. |
| **Console `/admin`** (superadministrateurs) | Ajoutée aux destinataires : elle ne lit que les statistiques de visites. |
| `professional_identifier` n’est plus collecté (le champ existe dans le modèle, aucune interface ni API ne l’alimente) | Retiré du tableau des données. Champ à supprimer ou à documenter. |
| Rubrique **Paramètres › En savoir plus** déjà prévue (« À venir ») | Branchée sur les pages légales et sur les crédits. |
| `globals.css` du zip ne contenait que le style de la console admin | Rétabli par vos soins ; aucune de mes modifications ne touche ce fichier. |

---

## 2. LEGAL_REQUIREMENTS (bloc de la PROJECT CARD)

```
LEGAL_REQUIREMENTS
├── mentions_legales: true
├── politique_confidentialite: true   # données de santé + mesure de fréquentation
├── cgu: true
├── cgv: false                        # aucune vente ni paiement dans le code
├── politique_cookies: section        # section « Cookies » de la confidentialité (3 cookies)
├── consentement_cookies: À TRANCHER  # cookie de mesure déposé dès la 1re visite, sans choix préalable
├── livraison_retours: false
├── remboursement: false
├── sector_specific: true             # DONNÉES DE SANTÉ → ⚠️ VALIDATION JURIDIQUE RECOMMANDÉE
├── pays_cible: "CI"                  # loi n° 2013-450 du 19 juin 2013
└── note: "Carnet de santé patient, accès clinique temporaire, pilote fermé sur données fictives (NO-GO réel)."
```

---

## 3. LEGAL DATA INPUT (reconstitué à partir du code)

> Reconstitué par **lecture statique** du dépôt (`settings.py`, `models.py`, `visitor_tracking.py`, `admin_views.py`, `render.yaml`, frontend). À faire valider par la personne qui maintient le backend ; une lecture du code ne remplace ni une inspection navigateur ni une vérification sur l’environnement déployé. Les lignes marquées ▲ sont nouvelles ou modifiées par rapport à la version 1.

```
LEGAL DATA INPUT
├── data_collected
│   ├── compte        : first_name, last_name, email, mot de passe (Argon2id), date_joined, last_login
│   ├── profil        : public_id (UUID), ▲ photo de profil (avatar_data : image WebP réduite ≤ 250 Ko, stockée en base) ou
│   │                   avatar_url fournie par un fournisseur de connexion, ThemePreference (palette + police)
│   ├── oauth         : AuthIdentity {provider, provider_user_id, email, display_name, avatar_url}
│   ├── contextes     : AccountContext {role patient|professional|establishment, is_active, onboarding_completed}
│   ├── patient       : phone, birth_date, address, coverage_provider, coverage_number, coverage_expiry
│   ├── santé         : ClinicalDeclaration {kind, label, details ≤ 2000, status declared|cancelled}
│   ├── pré-consult.  : CareEncounter {establishment, reason, observations ≤ 4000, recorded_with_help ≤ 160, status} + révisions
│   ├── accès         : AccessGrant {scope, status, dates, extension_count} ; PatientAccessQrToken {token_hash, expires_at, consumed_at}
│   ├── consultation  : Consultation {reason, observations, conclusion, care_plan, attestation_svg + hash + horodatage} + révisions
│   ├── professionnel : ▲ titre, spécialité, statut de rattachement, établissement actif
│   │                   (professional_identifier : champ du modèle NON collecté par l’interface)
│   ├── établissement : Establishment, administrateurs, invitations (e-mail, prénom, nom, token_hash),
│   │                   codes (code_hash), rattachements (version et date d’acceptation)
│   ├── audit         : AuditEvent {type, acteur, rôle, objets liés, métadonnées en liste blanche} — ni IP, ni user-agent, ni contenu médical
│   ├── ▲ visites     : AnonymousVisitor {visitor_id UUID, first_seen, last_seen, page_views, last_page_category,
│   │                   compteurs : login_page_views, login_success, login_failure, register_success, oauth_login, oauth_link…}
│   │                   — aucune IP, aucune URL complète, aucun lien vers un compte (pas de clé étrangère vers User)
│   ├── technique     : sessions Django en base ; cache de limitation (clé = IP, e-mail haché)
│   └── hors appli    : pièces justificatives de structure reçues par e-mail
├── third_party_services
│   ├── Vercel (web), Render (API, plan « free »), Neon (PostgreSQL)
│   ├── SMTP : fournisseur NON IDENTIFIÉ
│   ├── OAuth : Google, Facebook (Meta), Apple
│   └── ABSENTS : paiement, publicité, pixels, outil de mesure tiers, Sentry, stockage de médias externe
├── cookies
│   ├── sessionid       : session ; HttpOnly ; Secure ; SameSite=None (test) ; 8 h par défaut, renouvelée à chaque requête
│   ├── csrftoken       : CSRF ; lisible par le script ; Secure ; SameSite=None (test) ; 52 semaines (défaut Django)
│   └── ▲ ecarnet_visitor : mesure de fréquentation ; HttpOnly ; Secure ; SameSite=None (test) ; 30 jours ; déposé dès la 1re visite
├── storage        : localStorage limité au thème d’apparence non sensible et indexé par compte ; aucun sessionStorage / IndexedDB ;
│                    polices servies par le site (next/font)
├── retention      : NON DÉCIDÉE (A15). Validités techniques : session 8 h · QR 5 min · autorisation 2 h + 2 × 1 h ·
│                    invitation et code 48 h · demande en attente 7 jours · compteurs de limitation ≤ 1 h
│                    ▲ visites : la commande `cleanup_visitor_analytics` supprime après 90 jours sans visite, mais
│                    RIEN ne la planifie (ni `render.yaml`, ni `ops/`, ni `.github/`)
├── authentication : session Django + CSRF ; e-mail/mot de passe ; OAuth ; ▲ comptes superadmin créés par `bootstrap_admin`
├── payment_provider : absent
├── analytics        : ▲ INTERNE (AnonymousVisitorTracker → /api/v1/identity/analytics/visits/), sans service tiers
├── email_provider   : SMTP configurable, fournisseur inconnu
└── media_provider   : absent (la photo de profil est stockée dans la base)
```

---

## 4. Écarts relevés

| # | Constat | Gravité | Traitement |
|---|---------|---------|------------|
| 1 | **Cookie de mesure `ecarnet_visitor` déposé dès la première visite, sans information préalable ni choix** : identifiant persistant de 30 jours. Le code l’appelle « anonyme » ; il est **pseudonymisé** (identifiant stable, compteurs de connexion). | **Élevée** | Décrit dans la politique, sans trancher. **Décision juridique** : information seule, droit d’opposition ou consentement préalable. Aucun bandeau n’a été ajouté. |
| 2 | La durée de conservation des visites (90 jours) n’est appliquée que si quelqu’un lance la commande : rien ne la planifie. | Moyenne | Champ `retention.visits` à compléter ; planifier la commande ou la retirer. |
| 3 | Nom « AnonymousVisitor » et textes internes parlant d’« anonyme » : le terme est inexact au sens de la protection des données. | Moyenne | Employer « pseudonymisé » dans les textes et la documentation. |
| 4 | Le profil patient collecte adresse, organisme de couverture, numéro et expiration de couverture ; le dossier V3 ne citait que date de naissance et téléphone. | Élevée | Intégré à la politique. **Décision produit** : minimisation. |
| 5 | `ProfessionalProfile.professional_identifier` : champ mort (jamais alimenté). | Faible | Retiré des textes. Supprimer le champ ou le documenter. |
| 6 | `recorded_with_help` enregistre en texte libre l’identité de l’aidant ; aucun cadre juridique défini (A7). | Moyenne | Mentionné ; `privacy.helper` à compléter. |
| 7 | Compteurs de limitation : l’**adresse IP** sert de clé dans la table de cache (≤ 1 h). | Faible | Mentionné. |
| 8 | Photo de profil : image personnelle stockée dans la base de l’environnement de test (Render/Neon). | Moyenne | Mentionnée ; question au juriste (§7). |
| 9 | `/admin` : accès superadministrateur sans MFA (reporté V3). Règles d’accès du personnel non écrites. | Élevée | Champ `privacy.staffAccess` à compléter. |
| 10 | **Promesses encore présentes** hors de mon périmètre : `app/page.tsx` (« en un scan », « à tout moment », « chaque lecture ») et `app/v1/page.tsx` (« V1 stable », « socle sécurisé »). | Élevée | **Non modifiées.** Remplacements proposés en §8. La FAQ et l’aide, qui contenaient « à tout moment » et « doit être vérifié », ont été réécrites. |
| 11 | `landing.css` (style de l’en-tête et du pied public) n’était importé que par la page d’accueil. | Moyenne | Import ajouté dans `PublicShell.tsx`. À confirmer au build de production. |
| 12 | `globals.css` du premier zip ne contenait que le style de la console admin. | Moyenne | Rétabli par vos soins. **Conseil** : ajouter un contrôle de taille ou un test de présence des classes de base pour éviter qu’une génération automatique n’écrase le fichier. |
| 13 | `AuthForms.tsx` rend un second `h1` à côté de celui de `connexion/page.tsx` : deux titres de niveau 1 sur la page de connexion. | Faible | Non modifié (existait avant). |
| 14 | Le zip contient `apps/api/.env`, `apps/web/.env.production.local` et `apps/api/db.sqlite3`. **Leur contenu n’a pas été lu** ; ils sont exclus de la livraison. | Élevée | Renouveler les secrets s’ils sont réels ; ne jamais livrer `db.sqlite3`. |
| 15 | Autorité de protection : le skill dit « ARTCI », le dossier V3 cite un site dédié. | Faible | Texte public générique. **Confirmer l’appellation actuelle.** |

---

## 5. Compliance Matrix

| Élément | Nécessaire ? | Présent ? | Vérifié contre l’implémentation ? |
|---------|:---:|:---:|:---:|
| Mentions légales | ✓ | ✓ provisoire | Partiel — hébergeurs issus de `render.yaml` ; adresses et régions manquantes |
| Politique de confidentialité | ✓ | ✓ provisoire | ✓ lecture statique ; ✗ navigateur et staging ; durées et bases juridiques manquantes |
| CGU | ✓ | ✓ provisoire | ✓ rôles, accès, durées ; ✗ responsabilité, litiges, acceptation |
| Conditions de rattachement médecin | ✓ | ✓ (existante) | Non revue ici |
| CGV, livraison, remboursement | — | — | — |
| Politique cookies | ✓ | ✓ section | ✓ 3 cookies ; ✗ noms et durées sur le domaine de production |
| **Choix / consentement cookies** | **À trancher** | ✗ | ✓ le cookie de mesure existe ; **avis du juriste requis** |
| Crédits et remerciements | — | ✓ `/credits` | Hors périmètre juridique |

**Gate Recette #3 : NON OUVERTE.** 41 champs restent à compléter, aucun avis juridique n’a été rendu, le cookie de mesure n’est pas tranché, la recette navigateur et staging n’est pas faite.

---

## 6. Champs « À COMPLÉTER PAR LE CLIENT » (41)

Définis dans `FIELDS` (`apps/web/src/lib/legal/config.ts`) ; on saisit la valeur dans `FIELD_VALUES`, jamais dans les pages. Liste à jour : `node --experimental-strip-types -e 'const l=await import("./src/lib/legal/config.ts"); console.table(l.pendingFields())'` depuis `apps/web`.

| Groupe | Nombre | À fournir par |
|--------|:---:|---------------|
| Éditeur (dénomination, forme, RCCM, adresse, e-mail, direction de publication, titulaire des droits, conditions du nom et du logo) | 8 | Porteur du projet |
| Hébergement (coordonnées et région de Vercel, Render, Neon) | 6 | Technique |
| Confidentialité (responsable, rôles, contact, bases juridiques, formalités, accès du personnel, SMTP, journaux d’hébergeurs, transferts, droits, mineurs, aidant, incidents) | 13 | Porteur + juriste ; technique pour `staffAccess`, `smtpProvider`, `hostLogs` |
| Conservation (compte, santé, consultations, accès, audit, rattachements, pièces, sauvegardes, **statistiques de visites**) | 9 | Juriste + référent médical (A15) |
| CGU (acceptation, obligations de l’éditeur, responsabilité, clôture, juridiction) | 5 | Juriste ; décision produit pour l’acceptation |

**Redianice** : le nom est cité dans la page Crédits comme à l’origine de l’idée. **Redianice est-il l’éditeur légal du service ?** Si oui, `publisher.*` et `ip.holder` peuvent être renseignés. La page Crédits n’affirme pas qu’il l’est.

---

## 7. Questions pour le juriste (en plus du §5 du dossier V3)

1. **Cookie de mesure** `ecarnet_visitor` : information, opposition ou consentement préalable ? Un bandeau est-il requis ?
2. Formalité exacte pour des **données de santé** auprès de l’Autorité (déclaration, autorisation, transfert hors CEDEAO).
3. **Secret médical** : la clause « rôles et responsabilités » des CGU suffit-elle ?
4. **Photo de profil** stockée dans la base : régime applicable, notamment pour une personne mineure.
5. **Communication aux autorités** : aucune clause rédigée.
6. Mécanisme d’**acceptation** des CGU : information simple (actuel) ou case à cocher avec version et horodatage côté serveur ?
7. Statut d’une **adresse IP** conservée ≤ 1 h.
8. **Mineurs** et représentants légaux.
9. Droit applicable (« Côte d’Ivoire » par défaut) et juridiction.
10. **Cession des droits** sur le logo et la charte entre AKATech et l’éditeur ; recherche d’antériorité sur le nom.

---

## 8. Formulations de remplacement proposées (non appliquées)

| Où | Aujourd’hui | Proposition |
|----|-------------|-------------|
| `app/v1/page.tsx` | « V1 stable et utilisable — socle sécurisé… » | « Version de test en cours. Données fictives uniquement. Fonctionnalités et sécurité encore en validation. » |
| `app/page.tsx` | « autorisez un médecin en un scan » | « Le QR code lance une demande ; vous décidez ensuite. » |
| `app/page.tsx` | « révocable à tout moment », « la trace de chaque accès » | « Vous pouvez révoquer une autorisation depuis votre espace. Les actions sensibles sont enregistrées dans un journal. » |
| Connexion | « Des accès temporaires, visibles et révocables. » | « Vous choisissez qui peut consulter votre carnet, pour une durée limitée. » |

---

## 9. Ce qui a été fait dans l’application

| Demande | Réalisation |
|---------|-------------|
| Pages légales pour les **non-connectés**, **en pied de page** | `PublicShell` : bloc « Informations légales » (mentions légales, confidentialité, conditions d’utilisation) et lien Crédits. Page de connexion : même rangée de liens. Inscription : phrase d’information avec liens, sans case à cocher. |
| Pages légales pour les **connectés**, **dans les paramètres** | `SettingsMoreSection` (partagée par les paramètres patient, professionnel et établissement) : groupes « Aide et principes », « Informations légales » (CGU, confidentialité, mentions légales, conditions de rattachement) et « Remerciements ». L’ancien état « À venir » est supprimé. Aucun lien légal n’a été ajouté au pied des espaces connectés. |
| Page **Crédits et remerciements** | `/credits` (données dans `lib/credits.ts`) : Redianice et AKATech Studio à l’origine de l’idée, identité visuelle, remerciements aux testeurs, outils utilisés, contact. |
| **Aide** enrichie | `/faq` devient « Aide et questions fréquentes » : choix du profil, parcours pas à pas patient, professionnel et établissement, 17 questions, 6 dépannages, glossaire, contact. `/etablissement/aide` reprend ses 4 étapes et gagne questions, dépannage et glossaire. Formulations corrigées (« à tout moment », « vérifié »). |
| **Logo, ICO, favicon** | `BrandMark` à la place des sept anciennes marques ; `favicon.ico` 16/32/48 ; icônes PWA 192 et 512 ; `layout.tsx` et manifest. Détail dans `BRIEF-DIRECTION-ARTISTIQUE-v4.md` §4.7. |
| Retour | Bouton « Retour » sur les pages légales, crédits et aide (revient aux paramètres après un clic depuis « En savoir plus »). |

**Fichiers créés** : `lib/legal/config.ts`, `lib/credits.ts`, `components/public/{LegalDocument,BackLink,ContactLine}.tsx`, `components/help/{HelpCenter.tsx,helpContent.ts}`, `components/ui/{BrandMark,BrandLogo}.tsx`, `app/{mentions-legales,confidentialite,cgu,credits}/page.tsx`, `app/site-pages.css`, `public/favicon.ico`, `public/brand/*`, `tests/{legal,site}.test.mjs`.
**Fichiers modifiés** : `PublicShell`, `SpaceShell`, `AuthForms`, `SettingsMoreSection`, `EstablishmentHelp`, `app/faq/page`, `app/connexion/page`, `app/staff/layout`, `app/v1/page`, `app/layout`, `public/manifest.webmanifest`, `package.json`. **`globals.css` n’est pas modifié.**

### Ce qui a été vérifié, et ce qui ne l’a pas été

| État | Détail |
|------|--------|
| ✓ Testé | 20 tests `node --test` (13 ajoutés : cookie de mesure déclaré, aucun stockage navigateur, liens visiteurs et connectés, icônes déclarées existantes et de la bonne taille, aide sans promesse) ; types TypeScript stricts avec `noUnusedLocals` sur 20 fichiers ; rendu HTML de 8 pages avec le vrai CSS dans Chromium à 375 px et 1200 px (aucun id dupliqué, aucune ancre cassée, aucun débordement) ; extrait de `BrandMark` identique au pixel près au logo |
| ✗ Non fait | `npm ci`, `next build`, `eslint` (pas de `node_modules`, réseau désactivé) ; tests Python (backend non modifié) ; polices réelles ; lecteur d’écran ; inspection des cookies sur un déploiement ; test de la fenêtre de paramètres elle-même (seule la rubrique a été rendue) |
| ✗ Non déployé | Rien n’est en ligne |

## 10. Mise à jour fonctionnelle du 26/10/2026

Les nouveaux parcours doivent être ajoutés à la revue juridique avant toute ouverture à des données réelles :

- la délégation « proche de confiance » utilise un compte propre au proche et un mot de rattachement à usage unique ; elle est limitée à la fiche d’urgence en lecture seule et ne constitue pas une représentation légale ;
- les ouvertures locales par administrateur d’établissement sont motivées, temporaires, auditables et notifiées au patient ; elles ne donnent accès qu’aux soins de la structure concernée ;
- les adressages C1 et la portée C2 `care_history` sont soumis au consentement granulaire du patient, à un professionnel actif et à une durée limitée ; les structures sources sont choisies par le patient ;
- aucune copie inter-établissements n’est conservée en V1 ; C3 reste désactivé jusqu’à validation de la conservation, de la rectification et de l’effacement ;
- aucune recherche libre de patients ni accès administrateur au contenu d’une autre structure n’est prévu ; le bris de glace reste hors périmètre.

Les pages d’aide, de confidentialité, de CGU et de sécurité ont été actualisées le 26/10/2026. Elles restent marquées comme provisoires tant que les champs juridiques et la validation d’un juriste ivoirien ne sont pas complétés.
