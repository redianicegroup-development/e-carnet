"use client";

import { formatDay } from "./access/access-history";
import { EstablishmentLogo } from "./EstablishmentLogo";
import { ProfileSheet } from "./ui/ProfileSheet";
import type { Membership } from "./ClinicalGate";

const STATUS_LABEL: Record<Membership["status"], string> = { pending: "En attente", active: "Actif", refused: "Refusé", suspended: "Suspendu", terminated: "Terminé" };
const EXPLAIN: Record<Membership["status"], string> = {
  pending: "Votre demande attend la confirmation de l’administrateur de l’établissement.",
  active: "Votre rattachement est actif : vous pouvez travailler pour cet établissement.",
  refused: "L’établissement a refusé cette demande de rattachement.",
  suspended: "Le rattachement est suspendu : vos accès cliniques à cet établissement sont bloqués jusqu’à sa réactivation.",
  terminated: "Le rattachement a pris fin : vos accès cliniques à cet établissement sont fermés. Un rattachement terminé ne se rouvre pas, une nouvelle demande est nécessaire.",
};

export function ProfessionalMembershipDetail({ membership, onClose }: { membership: Membership; onClose: () => void }) {
  return (
    <ProfileSheet
      name={membership.establishment_name}
      subtitle={membership.city}
      avatar={(size) => <EstablishmentLogo logo={membership.establishment_logo} name={membership.establishment_name} size={size} />}
      rows={[
        { label: "Établissement", value: membership.establishment_name },
        ...(membership.establishment_type ? [{ label: "Type", value: membership.establishment_type }] : []),
        { label: "Ville", value: membership.city || "—" },
        ...(membership.address ? [{ label: "Adresse", value: membership.address }] : []),
        { label: "Rattachement", value: STATUS_LABEL[membership.status] },
        { label: "Demandé le", value: formatDay(membership.requested_at) },
        ...(membership.reviewed_at ? [{ label: "Confirmé le", value: formatDay(membership.reviewed_at) }] : []),
        ...(membership.left_at ? [{ label: "Fin du rattachement", value: formatDay(membership.left_at) }] : []),
      ]}
      note={EXPLAIN[membership.status]}
      onClose={onClose}
    />
  );
}
