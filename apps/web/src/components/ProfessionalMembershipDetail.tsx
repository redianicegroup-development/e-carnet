import { formatDay } from "./access/access-history";
import { EstablishmentLogo } from "./EstablishmentLogo";
import type { ProfileProps } from "./ui/Profile";
import type { Membership } from "./ClinicalGate";

const STATUS_LABEL: Record<Membership["status"], string> = { pending: "En attente", active: "Actif", refused: "Refusé", suspended: "Suspendu", terminated: "Terminé" };
const STATUS_TONE: Record<Membership["status"], NonNullable<ProfileProps["status"]>["tone"]> = { pending: "warn", active: "ok", refused: "off", suspended: "off", terminated: "off" };
const EXPLAIN: Record<Membership["status"], string> = {
  pending: "Votre demande attend la confirmation de l’administrateur de l’établissement.",
  active: "Votre rattachement est actif : vous pouvez travailler pour cet établissement.",
  refused: "L’établissement a refusé cette demande de rattachement.",
  suspended: "Le rattachement est suspendu : vos accès cliniques à cet établissement sont bloqués jusqu’à sa réactivation.",
  terminated: "Le rattachement a pris fin : vos accès cliniques à cet établissement sont fermés. Un rattachement terminé ne se rouvre pas, une nouvelle demande est nécessaire.",
};

/* Ce que la tuile « Profil » d'un rattachement affiche : le logo de l'établissement seul dans la liste, puis, au toucher, la fiche avec le statut,
   les dates et les actions (définir comme actif, mettre fin au rattachement), ajoutées par l'écran. */
export function membershipProfile(membership: Membership, { isActive, severalActive }: { isActive: boolean; severalActive: boolean }): Pick<ProfileProps, "name" | "subtitle" | "avatar" | "rows" | "note" | "status"> {
  return {
    name: membership.establishment_name,
    subtitle: membership.city,
    avatar: (size) => <EstablishmentLogo logo={membership.establishment_logo} name={membership.establishment_name} size={size} />,
    status: { label: STATUS_LABEL[membership.status], tone: STATUS_TONE[membership.status] },
    rows: [
      { label: "Établissement", value: membership.establishment_name },
      ...(membership.establishment_type ? [{ label: "Type", value: membership.establishment_type }] : []),
      { label: "Ville", value: membership.city || "—" },
      ...(membership.address ? [{ label: "Adresse", value: membership.address }] : []),
      { label: "Rattachement", value: STATUS_LABEL[membership.status] },
      ...(isActive ? [{ label: "Consultations", value: "Établissement actif" }] : []),
      { label: "Demandé le", value: formatDay(membership.requested_at) },
      ...(membership.reviewed_at ? [{ label: "Confirmé le", value: formatDay(membership.reviewed_at) }] : []),
      ...(membership.left_at ? [{ label: "Fin du rattachement", value: formatDay(membership.left_at) }] : []),
      ...(membership.status === "terminated" && membership.terminated_by_establishment && membership.termination_reason ? [{ label: "Retrait", value: `Rattachement retiré par l’établissement. Motif : ${membership.termination_reason}` }] : []),
    ],
    note: membership.status === "active" && !isActive && severalActive ? `${EXPLAIN.active} Un seul établissement est actif à la fois pour les consultations.` : EXPLAIN[membership.status],
  };
}
