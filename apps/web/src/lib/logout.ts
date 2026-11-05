import { purgeOfflineCache } from "./offline-cache";
import { purgeOfflineSnapshot } from "./offline-snapshot";
import { unsubscribeFromPush } from "./push";

const CLEANUP_BUDGET_MS = 5000;

/**
 * À appeler AVANT l'appel d'API de déconnexion (le désabonnement push a besoin de la session et du jeton CSRF) :
 *  - désabonne cet appareil des notifications push (navigateur + serveur), pour qu'un autre compte connecté ensuite sur le même
 *    appareil ne reçoive pas les rappels du précédent ;
 *  - efface les copies locales : l'ancienne copie en clair des déclarations et la copie chiffrée des lectures (entrées ET clés).
 * Plafonné à 5 s et jamais bloquant : hors connexion, la copie locale est tout de même effacée et la déconnexion suit son cours.
 */
export async function cleanUpBeforeLogout(): Promise<void> {
  const work = Promise.allSettled([
    unsubscribeFromPush().catch(() => undefined),
    purgeOfflineSnapshot().catch(() => undefined),
    purgeOfflineCache().catch(() => undefined),
  ]);
  await Promise.race([work, new Promise((resolve) => window.setTimeout(resolve, CLEANUP_BUDGET_MS))]);
}
