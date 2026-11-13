/* PAT-20 — Mode économie de données. Logique pure (aucun React), testée dans tests/classe-a-2026-11-12.test.mjs.
   Décision retenue (à confirmer par le comité produit) : « Automatique » s'active quand le navigateur demande d'économiser les données
   (Save-Data) ou annonce un réseau 3G ou plus lent. Le patient peut forcer « Toujours » ou « Jamais ».
   Ce mode ne change QUE le poids des pages : jamais le consentement, l'authentification, le QR, les accès ni l'audit. */

export const DATA_SAVER_KEY = "ecarnet-data-saver";
export const DATA_SAVER_EVENT = "ecarnet:data-saver-change";

export type DataSaverSetting = "auto" | "always" | "never";

export const DATA_SAVER_CHOICES: ReadonlyArray<{ value: DataSaverSetting; label: string; hint: string }> = [
  { value: "auto", label: "Automatique", hint: "S’active tout seul quand votre réseau est lent ou que votre téléphone demande d’économiser les données." },
  { value: "always", label: "Toujours", hint: "Photos plus légères, courbes à la demande, polices du téléphone, pas d’animations." },
  { value: "never", label: "Jamais", hint: "Affichage complet, même sur un réseau lent." },
];

export function isDataSaverSetting(value: unknown): value is DataSaverSetting {
  return value === "auto" || value === "always" || value === "never";
}

/** Valeur lue dans le stockage : tout ce qui n'est pas un choix connu retombe sur « Automatique ». */
export function parseDataSaverSetting(value: unknown): DataSaverSetting {
  return isDataSaverSetting(value) ? value : "auto";
}

/** Ce que le navigateur sait de la connexion (`navigator.connection`, absent sur Safari et Firefox : on n'active alors rien tout seul). */
export type ConnectionInfo = { saveData?: boolean; effectiveType?: string };

const SLOW_TYPES: ReadonlySet<string> = new Set(["slow-2g", "2g", "3g"]);

export function connectionWantsSaving(info: ConnectionInfo | null | undefined): boolean {
  if (!info) return false;
  return info.saveData === true || (typeof info.effectiveType === "string" && SLOW_TYPES.has(info.effectiveType));
}

export function isDataSaverActive(setting: DataSaverSetting, info: ConnectionInfo | null | undefined): boolean {
  if (setting === "always") return true;
  if (setting === "never") return false;
  return connectionWantsSaving(info);
}

/** Pourquoi le mode est actif : une phrase simple pour le bandeau et le réglage. Chaîne vide si le mode est inactif. */
export function dataSaverReason(setting: DataSaverSetting, info: ConnectionInfo | null | undefined): string {
  if (!isDataSaverActive(setting, info)) return "";
  if (setting === "always") return "Vous l’avez activé.";
  if (info?.saveData === true) return "Votre téléphone demande d’économiser les données.";
  return "Votre réseau est lent.";
}

/** Instantané « réglage|saveData|type » : une simple chaîne, comparable par useSyncExternalStore sans recréer d'objet à chaque lecture. */
export function encodeSnapshot(setting: DataSaverSetting, info: ConnectionInfo | null | undefined): string {
  return `${setting}|${info?.saveData === true ? "1" : "0"}|${info?.effectiveType ?? ""}`;
}

export function decodeSnapshot(snapshot: string): { setting: DataSaverSetting; info: ConnectionInfo } {
  const [setting, saveData, effectiveType] = snapshot.split("|");
  return { setting: parseDataSaverSetting(setting), info: { saveData: saveData === "1", effectiveType: effectiveType || undefined } };
}

export const SERVER_SNAPSHOT = encodeSnapshot("auto", null);

/** Réglage d'envoi des photos. Mode normal : exactement l'ancien comportement (1 600 px, qualité 0,82). */
export type ImageProfile = { maxSide: number; quality: number };
export const IMAGE_PROFILE_NORMAL: ImageProfile = { maxSide: 1600, quality: 0.82 };
export const IMAGE_PROFILE_SAVER: ImageProfile = { maxSide: 1024, quality: 0.7 };

export function imageProfile(active: boolean): ImageProfile {
  return active ? IMAGE_PROFILE_SAVER : IMAGE_PROFILE_NORMAL;
}

export const DATA_SAVER_BANNER_TITLE = "Mode économie de données activé";
export const DATA_SAVER_BANNER_TEXT = "Photos plus légères, courbes à afficher à la demande, pas d’animations. Vos accès et votre sécurité ne changent pas.";
