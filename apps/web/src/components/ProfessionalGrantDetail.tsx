"use client";

import type { ProfessionalGrant } from "../application/professional-access-grants";
import { GRANT_STATUS_LABELS, scopeText } from "../lib/grant-labels";
import { formatWhen } from "./access/access-history";
import { EstablishmentLogo } from "./EstablishmentLogo";
import { PersonAvatar } from "./ui/PersonAvatar";
import type { ProfileProps } from "./ui/Profile";

const EXPLAIN: Record<string, string> = {
  active: "L’accès est ouvert. Il se ferme tout seul quand vous signez la consultation ou à l’expiration.",
  pending: "Le patient n’a pas encore répondu à cette demande.",
  expired: "L’accès est terminé. Un accès terminé ne se rouvre pas : faites une nouvelle demande.",
  revoked: "Le patient a retiré cet accès. Il ne se rouvre pas : une nouvelle demande est nécessaire.",
  declined: "Le patient a refusé cette demande.",
  refused: "Le patient a refusé cette demande.",
};

const STATUS_TONE: Record<string, NonNullable<ProfileProps["status"]>["tone"]> = { active: "ok", pending: "warn" };

/* Ce que la tuile « Profil » d'une demande d'accès affiche : la photo du patient (avec le logo de l'établissement) seule dans la liste, puis, au toucher,
   la fiche avec le périmètre, le statut, les dates et l'action « Terminer l'accès », ajoutée par l'écran tant que l'accès est ouvert. */
export function grantProfile(item: ProfessionalGrant): Pick<ProfileProps, "name" | "label" | "subtitle" | "avatar" | "rows" | "note" | "status"> {
  const name = item.patient_name || item.reference;
  const startsAt = (item as unknown as { starts_at?: string | null }).starts_at;
  return {
    name,
    label: item.patient_name ? item.patient_name.trim().split(/\s+/)[0] : item.reference,
    subtitle: item.facility_label,
    avatar: (size) => <span className="request-row__avatars"><PersonAvatar src={item.patient_avatar} name={name} size={size} /><EstablishmentLogo logo={item.establishment_logo} name={item.facility_label} size={Math.round(size * 0.4)} /></span>,
    status: { label: GRANT_STATUS_LABELS[item.status] ?? item.status, tone: STATUS_TONE[item.status] ?? "off" },
    rows: [
      { label: "Patient", value: name },
      { label: "Établissement", value: item.facility_label || "—" },
      { label: "Périmètre", value: scopeText(item.scope) },
      { label: "Statut", value: GRANT_STATUS_LABELS[item.status] ?? item.status },
      ...(startsAt ? [{ label: "Début", value: formatWhen(startsAt) }] : []),
      ...(item.expires_at ? [{ label: "Fin", value: formatWhen(item.expires_at) }] : []),
      { label: "Référence", value: item.reference },
    ],
    note: EXPLAIN[item.status],
  };
}
