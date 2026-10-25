# Compression PDF sans perte

## Périmètre

La compression s’applique uniquement aux PDF téléversés par un patient comme documents médicaux, avant le stockage Cloudinary ou local. Elle ne modifie ni les images envoyées séparément, ni les PDF d’ordonnance ou d’export générés par l’API. Les courbes de tension et de glycémie ne sont pas activées : les mesures doivent d’abord être normalisées en valeurs structurées avec unité, date, provenance et règles de validation.

## Fonctionnement

L’API valide d’abord l’extension et la signature réelle du fichier, puis impose le plafond de 10 MiB au fichier source. Si `qpdf` est disponible, elle demande la recompression des flux PDF (`--stream-data=compress`, `--recompress-flate`, niveau 9). Cela utilise des flux Flate réversibles : aucune image JPEG n’est réencodée avec perte. Le PDF produit est contrôlé par `qpdf --check` et n’est retenu que si sa taille est strictement inférieure à l’originale. Le quota patient et `size_bytes` reflètent les octets réellement stockés; le plafond de téléversement reste évalué sur l’original, avant traitement.

Le traitement conserve exactement les octets d’origine dans les cas suivants : document signé numériquement (présence de `ByteRange` ou signature détectée), PDF chiffré, fichier invalide/non reconnu, outil absent, délai dépassé, erreur/avertissement de qpdf, validation du résultat non réussie ou résultat plus gros/égal à l’original. La compression ne bloque donc pas l’ajout d’un document lorsque l’optimisation n’est pas sûre ou utile.

Les PDF signés restent intacts, car réécrire un PDF invaliderait leur signature cryptographique. Les PDF protégés par mot de passe restent également intacts afin de ne pas modifier leur protection. Les fichiers temporaires qpdf sont isolés dans un répertoire temporaire privé puis supprimés.

## Déploiement et tests

L’image API installe `qpdf`; le job CI l’installe aussi pour exercer le vrai parcours d’upload/download. Le test vérifie que le fichier téléchargé est plus petit, que sa structure est validée et que le texte d’origine subsiste après décompression des flux. D’autres tests vérifient le retour byte pour byte des PDF signés/chiffrés et le repli sur l’original si l’outil manque ou échoue.

```bash
python apps/api/manage.py test apps.care.test_pdf_compression apps.care.test_documents_v2
```
