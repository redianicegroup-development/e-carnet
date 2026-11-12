/* Où s'ouvre le lien d'installation : navigateur capable d'installer, iPhone/iPad, ou navigateur intégré d'un réseau social
   (Facebook, Instagram, WhatsApp, TikTok…), qui ne peut pas installer une application et doit d'abord être quitté. */

export type InstallEnvironment = { ios: boolean; android: boolean; inApp: boolean; standalone: boolean };

const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Snapchat|TikTok|musical_ly|Messenger|Twitter|LinkedInApp|MicroMessenger|Telegram/i;

export function detectInstallEnvironment(userAgent: string, standalone: boolean, maxTouchPoints = 0): InstallEnvironment {
  // iPadOS se présente comme un Mac : seul le tactile le distingue.
  const ios = /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
  const android = /Android/i.test(userAgent);
  return { ios, android, inApp: IN_APP.test(userAgent) || (android && /; wv\)/.test(userAgent)), standalone };
}

/** Sous Android, un lien « intent » rouvre la page dans Chrome (accepté par la plupart des navigateurs intégrés). */
export function chromeIntentUrl(location: Pick<Location, "host" | "pathname" | "search">): string {
  return `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end`;
}
