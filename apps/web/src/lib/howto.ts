import type { TourSpace, TourStep } from "./tour";

/* « Comment ça marche ? » : le guide pas à pas du parcours de chaque espace (patient, professionnel, établissement, laboratoire).
   Différence avec la visite guidée (lib/tour.ts) : la visite explique à quoi sert chaque onglet ; ce guide suit le parcours dans l'ordre,
   d'une page à l'autre (une étape peut ouvrir la page où se passe l'action, `href`).
   Il se lance tout seul pour les deux premières utilisations de l'espace, puis seulement à la demande (menu du compte).
   Ce fichier ne contient ni React ni accès au DOM (hors `Storage` passé en paramètre) : il se teste seul. */

export const HOWTO_VERSION = 1;
/** Nombre d'utilisations (connexions) pendant lesquelles le guide se lance tout seul. */
export const HOWTO_MAX_RUNS = 2;
/** Deux lancements automatiques ne peuvent pas se suivre de moins de 30 minutes : recharger la page ne consomme pas une utilisation. */
export const HOWTO_MIN_GAP_MS = 30 * 60 * 1000;
/** Événement qui rouvre le guide de l'espace affiché (entrée « Comment ça marche ? » du menu du compte). */
export const HOWTO_RESTART_EVENT = "ecarnet:howto-restart";

/** Une étape du guide : une étape de la visite guidée, avec en plus la page à ouvrir. */
export type HowToStep = TourStep & { href?: string };

/** Étape qui n'a de sens qu'avec un rattachement actif (médecin) : sinon elle reste affichée, sans ouvrir la page ni désigner de repère. */
type RawStep = HowToStep & { clinical?: { locked: string } };

const ACCOUNT_STEP: RawStep = {
  id: "account", target: "account", icon: "help", tag: "À retrouver", title: "Revoir ce guide à tout moment",
  text: "Ouvrez le menu de votre compte, puis « Comment ça marche ? » : le guide reprend depuis le début.",
};

const STEPS: Record<TourSpace, RawStep[]> = {
  patient: [
    { id: "prepare", href: "/patient/consultations", target: "howto-preconsult", icon: "stethoscope", tag: "Préparer", title: "Remplir la pré-consultation", text: "Ouvrez l’onglet Consultations (le bouton surélevé au centre) et passez votre téléphone à l’infirmier ou au médecin : il remplit le formulaire avec vous. Seul le motif est obligatoire ; symptômes et constantes sont facultatifs. Touchez « Enregistrer le brouillon »." },
    { id: "share", href: "/patient/consultations", target: "howto-qr", icon: "qr", tag: "Partager", title: "Montrer le QR au professionnel", text: "Dès que le brouillon est enregistré, l’étape 2 génère votre QR temporaire. Montrez-le au professionnel : il expire au bout de 5 minutes et, dès qu’il est scanné, le professionnel lit votre carnet pendant 2 h (lecture seule), un seul à la fois. Le bouton « Partager en QR » de l’accueil en génère un aussi." },
    { id: "history", href: "/patient/historique", target: "nav-historique", icon: "clock", tag: "Retrouver", title: "Voir tout ce qui s’est passé", text: "Dans Historique, « Accès à mes données » montre qui a ouvert votre carnet, quand et pour combien de temps : vous pouvez prolonger ou retirer l’accès. « Mes consultations » garde les consultations signées, avec leur compte rendu et leur sceau." },
    ACCOUNT_STEP,
  ],
  professional: [
    { id: "attach", href: "/professionnel/acces", target: "howto-attach", icon: "building", tag: "Se rattacher", title: "Saisir votre code médecin", text: "Saisissez le code remis par votre établissement (valable 48 h), acceptez les conditions et envoyez votre demande. L’administrateur la confirme ensuite : les onglets Patients et Suivi apparaissent alors." },
    { id: "credentials", href: "/professionnel/parametres", target: "settings-professionnel", icon: "pencil", tag: "Signature", title: "Vérifier votre signature et votre cachet", text: "Dans Moi (ou « Profil et paramètres » du menu du compte), ouvrez « Informations professionnelles » : ajoutez votre cachet ou votre signature s’ils manquent. Il en faut au moins un pour valider une consultation ; ils restent attachés pour toujours à chaque consultation validée." },
    { id: "scan", href: "/professionnel", target: "howto-scan", icon: "qr", tag: "Scanner", title: "Scanner le QR du patient", text: "Sur l’Accueil, touchez « Scanner un QR » puis scannez le QR présenté par le patient (valable 5 minutes). Vous lisez sa pré-consultation pendant 2 h, avec son accord.", clinical: { locked: "Ce bouton apparaît sur l’Accueil dès que votre rattachement est confirmé." } },
    { id: "consult", href: "/professionnel/consultations", target: "nav-consultations", icon: "stethoscope", tag: "Consulter", title: "Faire la consultation", text: "Après le scan, vous arrivez directement dans l’onglet Suivi : la pré-consultation du patient s’affiche. Complétez-la, puis « Terminer et signer » : la signature clôt la consultation et ferme l’accès. Si vous demandez un examen, attendez le résultat du laboratoire avant de signer.", clinical: { locked: "Cet onglet s’ouvre dès que votre rattachement est confirmé." } },
    ACCOUNT_STEP,
  ],
  establishment: [
    { id: "codes", href: "/etablissement/medecins", target: "nav-equipe", icon: "users", tag: "Inviter", title: "Générer un code médecin", text: "Dans l’onglet Médecins, ouvrez « Codes médecin » et générez un code : il est à usage unique et valable 48 h. Remettez-le au médecin, qui le saisit dans son espace professionnel." },
    { id: "approve", href: "/etablissement/demandes", target: "nav-demandes", icon: "document", tag: "Valider", title: "Confirmer le rattachement", text: "Le médecin qui saisit votre code apparaît dans Demandes. Après vos vérifications, confirmez ou refusez : une fois confirmé, il peut consulter. C’est aussi là que vous ajoutez le responsable de votre laboratoire (Laboratoires)." },
    { id: "records", href: "/etablissement/dossiers", target: "nav-dossiers", icon: "folder", tag: "Dossiers", title: "Voir les dossiers, avec un motif", text: "Dans Dossiers, choisissez un patient puis le motif d’ouverture (obligatoire). L’accès est limité à votre établissement, tracé, et le patient en est notifié. Clôturez le dossier quand vous avez fini." },
    ACCOUNT_STEP,
  ],
  laboratory: [
    { id: "scan", href: "/laboratoire/scanner", target: "howto-lab-scan", icon: "qr", tag: "Scanner", title: "Scanner le QR d’examen", text: "Le patient vous montre son QR d’examen. Scannez-le, ou saisissez son code (EXQ1…) si la caméra n’est pas disponible. Vous ne voyez que son nom, sa date de naissance et les examens demandés." },
    { id: "deposit", href: "/laboratoire/scanner", icon: "document", tag: "Déposer", title: "Vérifier la personne, puis déposer", text: "Confirmez que le nom et la date de naissance correspondent à la personne présente, puis déposez un PDF par examen. Un second dépôt remplace le premier, qui reste conservé comme version remplacée." },
    { id: "history", href: "/laboratoire/depots", target: "nav-depots", icon: "clock", tag: "Retrouver", title: "Retrouver vos dépôts", text: "L’onglet Dépôts liste chaque résultat déposé, remplacé ou abandonné par le médecin. Le contenu des fichiers n’est jamais relu." },
    ACCOUNT_STEP,
  ],
};

export type HowToContext = {
  /** Médecin : le rattachement est actif (les onglets Patients et Suivi existent). Sans objet pour les autres espaces. */
  clinical: boolean;
};

/** Étapes du guide d'un espace. Un médecin pas encore rattaché garde toutes les étapes : celles qui exigent le rattachement s'affichent
    au centre, sans ouvrir de page ni désigner un bouton qui n'existe pas encore. Rend des copies. */
export function howToSteps(space: TourSpace, context: HowToContext): HowToStep[] {
  return STEPS[space].map(({ clinical, ...step }) => {
    if (!clinical || context.clinical) return { ...step };
    const locked: HowToStep = { ...step, text: `${step.text} ${clinical.locked}` };
    delete locked.href;
    delete locked.target;
    return locked;
  });
}

/* ---------- Mémoire « nombre d'utilisations » ----------
   Propre au compte et à l'espace, dans le navigateur de l'appareil (même point d'accès que la visite guidée : `deviceStorage`).
   Valeur : « <lancements>:<heure du dernier lancement en ms> ». Effacer les données du site la supprime : le guide reprend alors. */
export function howToStorageKey(accountId: string, space: TourSpace): string {
  return `ecarnet.howto.v${HOWTO_VERSION}.${accountId}.${space}`;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type HowToMemory = { runs: number; last: number };

/** `null` : la mémoire est inutilisable (navigation privée stricte) : on ne lance rien tout seul, pour ne pas rejouer le guide à chaque page. */
export function readHowTo(storage: StorageLike | null, accountId: string, space: TourSpace): HowToMemory | null {
  if (!storage) return null;
  let raw: string | null;
  try { raw = storage.getItem(howToStorageKey(accountId, space)); } catch { return null; }
  if (raw === null) return { runs: 0, last: 0 };
  const match = /^(\d{1,3}):(\d{1,15})$/.exec(raw);
  // Valeur illisible : on la traite comme « déjà fait » plutôt que de rejouer le guide.
  return match ? { runs: Number(match[1]), last: Number(match[2]) } : { runs: HOWTO_MAX_RUNS, last: 0 };
}

/** Le guide peut-il se lancer tout seul maintenant ? Oui si la visite guidée a déjà été vue (elle passe en premier), si les deux
    utilisations ne sont pas épuisées, et si le dernier lancement date d'au moins 30 minutes. */
export function shouldAutoStartHowTo(args: { storage: StorageLike | null; accountId: string; space: TourSpace; tourSeen: boolean; now: number }): boolean {
  if (!args.tourSeen) return false;
  const memory = readHowTo(args.storage, args.accountId, args.space);
  if (!memory) return false;
  return memory.runs < HOWTO_MAX_RUNS && args.now - memory.last >= HOWTO_MIN_GAP_MS;
}

/** Note un lancement automatique. Le lancement à la demande (menu du compte) ne passe pas par ici : il ne consomme rien. */
export function recordHowToRun(storage: StorageLike | null, accountId: string, space: TourSpace, now: number): void {
  const memory = readHowTo(storage, accountId, space);
  if (!storage || !memory) return;
  try { storage.setItem(howToStorageKey(accountId, space), `${memory.runs + 1}:${Math.floor(now)}`); } catch { /* mémoire indisponible : le guide pourra se rejouer */ }
}
