"use client";

import type { ProfessionalGrant } from "../application/professional-access-grants";
import { GRANT_STATUS_LABELS, scopeText } from "../lib/grant-labels";
import { formatWhen } from "./access/access-history";
import { EstablishmentLogo } from "./EstablishmentLogo";
import { PersonAvatar } from "./ui/PersonAvatar";
import { ProfileSheet } from "./ui/ProfileSheet";

const EXPLAIN: Record<string, string> = {
  active: "L’accès est ouvert. Il se ferme tout seul quand vous signez la consultation ou à l’expiration.",
  pending: "Le patient n’a pas encore répondu à cette demande.",
  expired: "L’accès est terminé. Un accès terminé ne se rouvre pas : faites une nouvelle demande.",
  revoked: "Le patient a retiré cet accès. Il ne se rouvre pas : une nouvelle demande est nécessaire.",
  declined: "Le patient a refusé cette demande.",
  refused: "Le patient a refusé cette demande.",
};

export function ProfessionalGrantDetail({ item, onClose }: { item: ProfessionalGrant; onClose: () => void }) {
  const name = item.patient_name || item.reference;
  const startsAt = (item as unknown as { starts_at?: string | null }).starts_at;
  return (
    <ProfileSheet
      name={name}
      subtitle={item.facility_label}
      avatar={(size) => <span className="request-row__avatars"><PersonAvatar src={item.patient_avatar} name={name} size={size} /><EstablishmentLogo logo={item.establishment_logo} name={item.facility_label} size={Math.round(size * 0.4)} /></span>}
      rows={[
        { label: "Patient", value: name },
        { label: "Établissement", value: item.facility_label || "—" },
        { label: "Périmètre", value: scopeText(item.scope) },
        { label: "Statut", value: GRANT_STATUS_LABELS[item.status] ?? item.status },
        ...(startsAt ? [{ label: "Début", value: formatWhen(startsAt) }] : []),
        ...(item.expires_at ? [{ label: "Fin", value: formatWhen(item.expires_at) }] : []),
        { label: "Référence", value: item.reference },
      ]}
      note={EXPLAIN[item.status]}
      onClose={onClose}
    />
  );
}
