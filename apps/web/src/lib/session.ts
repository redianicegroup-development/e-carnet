/**
 * Lecture de l'état de session, sans dépendance (testable en Node).
 *
 * L'API (Django REST, SessionAuthentication) répond 403 — et non 401 — à un visiteur anonyme, car elle n'envoie pas
 * d'en-tête WWW-Authenticate. Tester le seul 401 faisait afficher « Service momentanément indisponible » à quelqu'un
 * qui n'est simplement pas connecté, au lieu de le renvoyer vers la page de connexion.
 *
 * Le 403 n'est jamais un serveur endormi : cette distinction reste portée par SpaceShell (statuts 0, 502, 503, 504, réseau).
 */
function statusOf(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

/** L'API a répondu qu'il n'y a pas de session valide (401 ou 403). */
export function isSessionMissing(error: unknown): boolean {
  const status = statusOf(error);
  return status === 401 || status === 403;
}
