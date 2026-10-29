# PWA hors connexion — carte d’urgence publique

La version v1.1 ne met pas en cache les dossiers patients, les consultations, les documents, les espaces professionnels ou les réponses API privées.

Elle peut conserver uniquement une carte d’urgence publique déjà ouverte en ligne avec son QR :

- identité minimale et déclarations choisies par le titulaire ;
- groupe sanguin, ville, taille, poids, allergies, traitements et contact d’urgence lorsqu’ils sont déclarés ;
- provenance affichée : « Déclaré par le patient — non confirmé par un professionnel » ;
- date de dernière synchronisation ;
- avertissement visible lorsque l’affichage provient du cache.

Le stockage utilise IndexedDB dans le navigateur et expire après 24 heures. Le Service Worker peut également conserver la page `/urgence/<token>` déjà ouverte afin que sa coquille se recharge hors connexion. La carte ne peut pas être découverte hors connexion : il faut l’avoir consultée au moins une fois en ligne avec le même QR.

Aucune écriture n’est effectuée hors connexion. Une modification du patient, une confirmation professionnelle, une révocation ou une nouvelle consultation exige le réseau. La carte en cache peut donc être obsolète ; elle ne doit jamais être présentée comme une donnée actuelle.

Le modèle v1.1 ne possède pas encore de circuit de confirmation professionnelle pour `ClinicalDeclaration`. Les données sont donc explicitement marquées non confirmées. Quand ce circuit sera validé, l’API pourra renvoyer `professional_confirmed` par type de déclaration sans modifier le mécanisme de cache.

Cette fonctionnalité ne constitue pas un mode hors connexion du carnet médical complet et ne remplace pas les services d’urgence.
