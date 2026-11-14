/* Textes des modals de résultat : accès accordé, demande envoyée, erreur. Fichier pur, sans React, pour être testé.
   Même vocabulaire partout : un accès « accordé » est immédiat ; une demande « envoyée » attend une confirmation. */

export type OutcomeCopy = { title: string; message: string; note?: string };

/** Ce que la connexion renvoie quand le mot de passe temporaire vient d'ouvrir un accès (`first_access` de /identity/me/). */
export type FirstAccess = { kind: "laboratory" | "establishment"; establishment_name: string; parent_name: string };

/** Modal de succès de la première connexion (laboratoire ou établissement) : de quelle structure l'accès vient d'être accordé. */
export function firstAccessCopy(access: FirstAccess): OutcomeCopy {
  const note = "Dernière étape : choisissez votre mot de passe personnel.";
  if (access.kind === "laboratory") {
    const parent = access.parent_name || access.establishment_name;
    return { title: "Accès accordé", message: `Vous pouvez administrer le laboratoire de l’établissement « ${parent} ».`, note };
  }
  return { title: "Accès accordé", message: `Vous pouvez administrer l’établissement « ${access.establishment_name} ».`, note };
}

/** Médecin : la saisie du code crée une DEMANDE, que l'établissement doit confirmer. Dire « accès accordé » serait faux. */
export function joinRequestSentCopy(establishmentName: string): OutcomeCopy {
  const name = establishmentName.trim();
  return {
    title: "Demande envoyée",
    message: name ? `Votre demande de rattachement à l’établissement « ${name} » a bien été envoyée.` : "Votre demande de rattachement a bien été envoyée.",
    note: "Vous pourrez exercer auprès de cet établissement dès que son administrateur l’aura confirmée. Vous la suivez dans « Mes rattachements ».",
  };
}

/** Proche de confiance : le mot saisi ouvre l'accès tout de suite (lecture seule). */
export function delegationAcceptedCopy(patientFirstName: string, patientLastName = ""): OutcomeCopy {
  const name = `${patientFirstName} ${patientLastName}`.trim();
  return {
    title: "Accès accordé",
    message: name ? `Vous êtes maintenant proche de confiance de ${name}.` : "Vous êtes maintenant proche de confiance de ce patient.",
    note: "Vous consultez son carnet en lecture seule (fiche d’urgence). Chaque consultation est journalisée.",
  };
}

/** Erreur : toujours un motif clair. Le message du serveur est gardé tel quel ; sans message, on explique ce qui s'est passé selon le statut. */
export function errorReason(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallback;
}

export const CODE_ERROR_FALLBACK = "Le code n’a pas pu être vérifié. Contrôlez-le, ou demandez-en un nouveau à la personne qui vous l’a remis.";
