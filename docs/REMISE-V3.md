# Remise de revue V3 — Mon Carnet Numérique

Révision effectuée le 10 octobre 2026 à partir de l’archive fournie et des sources publiques consultées le même jour.

## Documents ajoutés

- `DOSSIER-REVUE-JURIDIQUE-v3.md` et `E-Carnet_Dossier-revue-juridique_v3.docx` : état V1/V2, inventaire des principaux textes frontend, décisions prises et ouvertes, évaluation nuancée de Hodi et projets de rédaction pour les mentions légales, la confidentialité, les CGU et les cookies.
- `BRIEF-DIRECTION-ARTISTIQUE-v3.md` et `E-Carnet_Brief-direction-artistique_v3.docx` : recommandation visuelle simple, palette Sauge, polices, navigation, graphiques et livrables attendus.

Les documents V2 sont remplacés dans le paquet de remise par leurs versions V3 afin d’éviter la confusion. Ils restent présents dans l’archive source initiale mais ne sont pas inclus dans le ZIP nettoyé.

## Résultat de la revue

- Le projet reste **NO-GO pour l’ouverture publique et les données de santé réelles**, conformément aux rapports de recette fournis. Les tests locaux réussis ne valent pas recette du staging.
- Vercel/Render/Neon sont traités comme environnements d’essai. La région réelle et les flux de chaque compte/fournisseur ne sont pas établis par l’archive.
- Le lien Hodi fourni désigne l’offre Site Pro. Hodi annonce des sauvegardes européennes pour cette offre ; une localisation du serveur principal à Grand-Bassam ne suffit donc pas à affirmer que toutes les copies restent en Côte d’Ivoire. Les pages Hodi distinguent ce produit de ses VPS.
- Le code conserve Lagon et Unbounded comme valeurs par défaut. Sauge et Plus Jakarta Sans sont des recommandations à approuver, pas des modifications appliquées au frontend.

## Nettoyage du ZIP de remise

L’archive fournie contenait `apps/api/.env`, `apps/web/.env.production.local`, `apps/api/db.sqlite3`, des caches Python et une archive ZIP imbriquée (`akatech-v3.zip`). Le paquet de remise exclut ces éléments, ainsi que les deux DOCX V2 remplacés. Les fichiers d’exemple `.env.example` et `apps/api/.env.production.example` restent disponibles.

**Action de sécurité conseillée :** ne pas partager l’archive d’origine. Si les valeurs de `apps/api/.env` correspondaient à des secrets réels, renouveler ceux-ci (clé Django, accès de base de données et identifiants SMTP) et vérifier les copies ou dépôts où cette archive a été transmise. Aucune valeur de secret n’est reproduite dans cette note.
