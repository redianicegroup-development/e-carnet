# Revue juridique à confirmer — stockage Cloudinary

Cette note ne constitue pas une conclusion de conformité. Les conditions applicables au stockage des documents médicaux doivent être confirmées avant toute mise en production.

Questions ouvertes à faire valider par l’équipe juridique et, si nécessaire, par l’ARTCI :

- **Localisation** : dans quel pays et quelle région les fichiers, métadonnées et sauvegardes Cloudinary sont-ils effectivement hébergés ? La région utilisée par le compte n’est pas présumée ici et doit être documentée.
- **Transfert hors de Côte d’Ivoire** : un transfert ou un accès depuis l’extérieur de la Côte d’Ivoire intervient-il ? Quelles garanties, informations aux personnes et formalités sont requises ?
- **Durées** : quelles durées de conservation, de sauvegarde, de cache, de journaux et d’effacement effectif s’appliquent ? Comment démontrer la purge après suppression d’un document ou d’un compte ?
- **Sous-traitance** : quels sous-traitants, sous-traitants ultérieurs, personnels d’assistance et flux de support peuvent accéder aux données ou métadonnées ? Quels engagements contractuels et contrôles sont disponibles ?
- **Validation** : la qualification du traitement, les clauses contractuelles, les mesures de sécurité, la localisation, les transferts et les durées doivent être validés par l’ARTCI et/ou le conseil juridique compétent avant déploiement.

En attendant ces validations, l’application traite les assets comme privés, utilise les types de ressource et le type `private` exacts pour les destructions, et refuse de supprimer les références locales lorsque Cloudinary refuse une destruction. Ces mesures techniques ne valent pas validation juridique.
