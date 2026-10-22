/* Lecture du QR du patient par la caméra : classement des erreurs de caméra et nettoyage du texte lu.
   Fichier pur (sans React ni navigateur) pour pouvoir être testé. */

export type CameraProblem = "denied" | "no-camera" | "busy" | "insecure" | "unsupported" | "unknown";

/** Le navigateur sait-il ouvrir une caméra ? (faux sur certains navigateurs intégrés et en HTTP). */
export function hasCameraSupport(nav: { mediaDevices?: { getUserMedia?: unknown } } | undefined | null): boolean {
  return typeof nav?.mediaDevices?.getUserMedia === "function";
}

export function classifyCameraError(error: unknown, secureContext: boolean): CameraProblem {
  if (!secureContext) return "insecure";
  const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name: unknown }).name) : "";
  if (["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(name)) return "denied";
  if (["NotFoundError", "DevicesNotFoundError", "OverconstrainedError"].includes(name)) return "no-camera";
  if (["NotReadableError", "TrackStartError", "AbortError"].includes(name)) return "busy";
  if (name === "TypeError") return "unsupported";
  return "unknown";
}

export const CAMERA_MESSAGES: Record<CameraProblem, string> = {
  denied: "L’accès à la caméra est refusé. Autorisez la caméra pour ce site dans les réglages du navigateur, puis réessayez.",
  "no-camera": "Aucune caméra n’a été trouvée sur cet appareil.",
  busy: "La caméra est utilisée par une autre application. Fermez-la, puis réessayez.",
  insecure: "La caméra ne fonctionne que sur une connexion sécurisée (https).",
  unsupported: "Ce navigateur ne permet pas d’ouvrir la caméra.",
  unknown: "La caméra n’a pas pu démarrer.",
};

/** Le QR du patient contient directement le jeton. On retire les espaces et retours à la ligne que certains lecteurs ajoutent. */
export function cleanScannedToken(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, "");
}
