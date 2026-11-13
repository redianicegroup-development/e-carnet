# Modifications du 11/11/2026 — Paramètres (langue, partage, version), déconnexion globale, historique des consultations et signature obligatoire

Archive complète : e-carnet_V1_10.zip (V1.9 + ces changements). Version `1.6.0` (racine et `@ecarnet/web`).

## 1. Paramètres des trois espaces (patient, professionnel, établissement)

Un groupe « Application » est ajouté dans Paramètres (`components/app/AppSettingsGroup.tsx`), sur le modèle de l'image 1.

- **Langue** : Français (par défaut), English, العربية. Anglais et arabe passent par **Google Translate** (traduction automatique du texte affiché). L'arabe bascule l'écran en lecture de droite à gauche. Le choix reste sur l'appareil. Avant le premier envoi à Google, une confirmation explique que le texte des pages ouvertes lui est transmis. En français, rien n'est chargé ni envoyé.
- **Partager l'application** : menu de partage du téléphone (WhatsApp, Facebook, SMS, etc.) ou boutons WhatsApp, Facebook, Telegram, X, e-mail, SMS et copie du lien. Le lien est `/installer`.
- **`/installer`** (page publique) : au clic sur le lien partagé, la page propose **Installer l'application**. Chrome et Edge sur Android : installation en un appui. iPhone : explication « Partager › Sur l'écran d'accueil ». Navigateurs intégrés à Facebook, WhatsApp, Instagram, etc. (qui ne savent pas installer) : bouton pour ouvrir dans Chrome ou copier le lien. Un navigateur impose toujours un appui de l'utilisateur : une installation sans geste est impossible.
- **Version de l'application** : numéro de version, état « À jour » ou « Mise à jour disponible », bouton pour vérifier et pour mettre à jour (rechargement de l'application). Le serveur répond `/api/app-version` ; la comparaison se fait sur l'**identifiant de build** figé au déploiement.

Fichiers : `lib/language.ts`, `lib/app-info.ts`, `lib/install-environment.ts`, `components/app/*`, `app/installer/page.tsx`, `app/api/app-version/route.ts`, `next.config.ts` (variables de version et CSP pour Google Translate), `app/layout.tsx`, icône `globe`.

## 2. « Se déconnecter de tous les appareils »

Déplacé dans **Sécurité et connexion** (patient, professionnel, établissement), avec confirmation et message d'erreur dans la fenêtre. « Me déconnecter » reste dans la liste. Composant : `components/LogoutAllSetting.tsx`. Le texte d'aide renvoie vers Paramètres › Sécurité et connexion.

## 3. Historique des consultations (les trois espaces)

- **Une seule carte** pour le patient, le professionnel et l'établissement (`components/consultation/ConsultationCard.tsx`) : date, motif, médecin et lieu, puis « Voir le compte rendu » et « Ouvrir le sceau ».
- **Débordement corrigé** : « Consultation médicale validée » retourne à la ligne au lieu de sortir de la carte ; les tuiles de constantes se répartissent selon la largeur sans être coupées. Même correction pour les cartes de rendez-vous et de pré-consultation de l'historique. Vérifié dans un navigateur à 320, 390 et 768 px : aucun élément ne dépasse.
- **Compte rendu** structuré : constantes (relevées avant la consultation / mesurées par le médecin), symptômes en puces, examen clinique, diagnostic, observations, conclusion, conduite à tenir, ordonnance numérotée (avec « Imprimer / PDF » côté patient), examens demandés avec leur état, mention de validation.
- **Signature et cachet** du médecin visibles dans le sceau et au pied du compte rendu, pour le patient et pour le médecin signataire. L'établissement voit seulement « Signature apposée · Cachet apposé » (le serveur ne lui sert pas les images).

## 4. Signature ou cachet obligatoire pour valider

- **Serveur** : la validation d'une consultation est refusée (400, message lisible) si le professionnel n'a ni signature ni cachet enregistré.
- **Écran du professionnel** : sous le formulaire, « Terminer et signer » reste fermé tant qu'il n'y a ni signature ni cachet. Le médecin les crée sur place : il **dessine sa signature** au doigt ou à la souris, ou **prend une photo** de sa signature ou de son cachet (l'encre est détourée en image transparente). L'image est enregistrée dans son profil et réutilisée pour toutes ses consultations et ordonnances.
- **Pour toujours** : à la validation, la signature et le cachet utilisés sont **figés sur la consultation** (migration `0029_consultation_seal_assets`). Si le médecin les remplace ou les supprime plus tard, les consultations déjà signées gardent ceux d'origine, et le serveur ne détruit jamais une image référencée.
- Si le médecin retire son dernier moyen de signer, l'application le prévient qu'il ne pourra plus valider.
- Textes mis à jour : Paramètres du professionnel et étape 3 de l'inscription (signature ou cachet requis avant la première validation).

## 5. Fermeture automatique de l'accès à la validation

Déjà en place dans le code, **non modifié** : à la signature, l'accès du médecin au carnet est fermé dans la même transaction, le patient est prévenu, et le médecin ne peut plus lire le carnet (même si le patient a oublié de révoquer). Les 5 tests de `test_auto_end_on_signature.py` le verrouillent ; le message de confirmation du médecin l'annonce avant la signature.

## Confidentialité et textes légaux

La politique de confidentialité déclare maintenant : Google Translate (prestataire tiers facultatif, texte envoyé seulement en anglais ou arabe), la langue conservée sur l'appareil, et le cookie `googtrans`. **À faire relire par la personne qui valide les textes juridiques** avant mise en ligne : la traduction envoie à Google le texte affiché, y compris des informations de santé.

## Tests

- Web : 435 tests, **432 verts**. Les 3 échecs (« un seul centre d'aide » et deux tests de la page hors connexion) existaient déjà dans la V1.9 et concernent des fichiers non touchés. Nouveau fichier : `tests/langue-partage-version-consultations-2026-11-11.test.mjs` (9 tests). Tests existants mis à jour : agenda, consultation-visite, historique-accès, ink-capture, maquettes, mon-e-carnet-v13, légal, CSRF (le cookie `googtrans` est écrit, jamais lu), en-têtes de sécurité (`connect-src` élargi).
- API : `apps.care` et `apps.professionals` (269 tests), `apps.identity` et `tests` verts ; 14 nouveaux tests dans `care/test_consultation_seal_required.py` et 5 dans `professionals/test_credentials.py`. `apps.establishments` : 101 verts sur 102 ; l'échec (`test_record_requires_same_user_current_admin_unexpired_opening…`) vient d'un écart déjà présent entre le test, qui attend une expiration de l'ouverture au bout de 31 minutes, et le réglage du projet `ECARNET_RECORD_OPENING_TTL_MINUTES=0` (jusqu'à clôture du motif). Cette app n'a pas été modifiée.
- `tsc --noEmit` propre ; lint : aucune erreur dans les fichiers modifiés.
- `next build` non lancé ici : à lancer avant déploiement.

## À faire au déploiement

1. **Migration** : `python manage.py migrate` (care `0029`).
2. **Cloudinary** doit être configuré : sans lui, aucun professionnel ne peut enregistrer de signature ni valider de consultation.
3. **Détection de mise à jour** : définir `ECARNET_BUILD_ID` (ou utiliser Vercel, qui fournit `VERCEL_GIT_COMMIT_SHA`) pour que chaque déploiement ait un identifiant différent. Sans identifiant, l'application affiche toujours « À jour ».
4. Relire la **CSP** en production (domaines Google Translate ajoutés, mode Report-Only).

## Points d'attention

- La signature dessinée est enregistrée en **image PNG transparente** (le mécanisme existant), pas en fichier SVG ; elle apparaît à l'identique sur la consultation et l'ordonnance.
- La traduction automatique peut se tromper : le texte de confidentialité conseille de se fier au français pour un médicament, une dose ou un résultat.
- Les consultations validées **avant** cette version n'ont ni signature ni cachet figés : seule la mention de validation s'affiche pour elles.
