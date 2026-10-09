# Projet de conditions de rattachement médecin — V1

**Version enregistrée dans le code : `2026-10-08-v1`**  
**Statut : projet fonctionnel à valider par un conseil juridique avant tout usage contractuel réel.**  
**Date de rédaction : 8 octobre 2026.**

> Ce document matérialise les engagements que le médecin doit accepter dans son espace avant d’envoyer le code d’accès remis par l’établissement. Il ne constitue pas, à lui seul, un contrat complet entre l’établissement et le médecin. Les parties, les obligations, les sanctions éventuelles, les règles applicables aux données de santé et les modalités de signature doivent être confirmées par un juriste compétent.

## Engagements proposés du médecin

En saisissant le code médecin, le professionnel confirme avoir lu et accepté la présente version des conditions de rattachement et s’engage à :

1. **Protéger les informations non publiques de l’établissement** auxquelles il accède dans le cadre de son activité et ne pas les divulguer à des personnes non autorisées, sauf obligation légale ou autorisation documentée.
2. **Préserver la confidentialité des patients** et n’accéder à leurs informations que dans le cadre de sa mission, avec les autorisations et consentements exigés par le service.
3. **Saisir des informations médicales de bonne foi et exactes**, distinguer les déclarations du patient des constatations professionnelles, ne pas inventer, altérer ou falsifier un diagnostic, une consultation, une attestation ou un dossier.
4. **Protéger ses moyens d’accès**, ne pas transmettre son compte, son mot de passe ou ses codes personnels et signaler toute compromission présumée.
5. Comprendre que l’établissement peut mettre fin à son rattachement et que le médecin peut également y mettre fin depuis son espace privé. La fin du rattachement bloque les nouveaux accès cliniques dépendant de cette affiliation.
6. Comprendre que la fin du rattachement **n’efface pas** les événements d’audit ni les documents et consultations déjà constitués : leur conservation et leur accès ultérieur restent soumis aux règles légales, à la politique de conservation à approuver et aux contrôles d’accès applicables.

## Preuve d’acceptation prévue

Au moment où le médecin soumet son code dans son espace professionnel, le serveur enregistre : l’identifiant du médecin, l’établissement, l’identifiant du rattachement, la version des conditions, la date et l’heure UTC et l’événement d’audit correspondant. Sans acceptation explicite de la version actuellement applicable, le code n’est pas consommé et aucune demande de rattachement n’est créée.

L’acceptation ne confère aucun accès automatique à un dossier patient. Le rattachement doit ensuite être approuvé par l’établissement et chaque accès clinique reste conditionné aux autorisations professionnelles, aux périmètres permis et au consentement requis du patient.

## Points à faire valider avant signature réelle

- identité et pouvoir du signataire pour l’établissement ;
- articulation avec le contrat de travail/prestation et la responsabilité professionnelle du médecin ;
- définition des informations confidentielles, exceptions et durée de confidentialité ;
- obligations de sécurité, notification d’incident, conservation et preuve ;
- exigences applicables en Côte d’Ivoire et dans les pays d’exploitation, notamment aux données de santé ;
- durée de conservation des dossiers et traces après la fin du rattachement ;
- éventuelles clauses de sanction, responsabilité, résolution de litige et signature électronique.

---

## Journal des modifications

| Version | Date | Changement |
|---|---|---|
| `2026-10-08-v1` | 2026-10-08 | Engagements initiaux : confidentialité de l’établissement et des patients, intégrité des informations médicales, non-partage des accès, résiliation possible par l’établissement ou le médecin, conservation de l’historique. |
