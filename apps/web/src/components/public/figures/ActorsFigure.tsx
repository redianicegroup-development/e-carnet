import { Arrow, Figure, Line, Node, Packet, Svg } from "./parts";

/* Qui fait quoi : l'établissement confirme le rattachement, le professionnel demande l'accès, le patient autorise ou refuse.
   Utilisé dans « À propos » (variante `about`) et dans la section « Rôles et responsabilités » des CGU (variante `terms`, avec l'éditeur).
   Chaque libellé reprend une phrase de la page où il est affiché. */

export function ActorsFigure({ variant }: { variant: "about" | "terms" }) {
  const terms = variant === "terms";
  return (
    <Figure
      className={terms ? undefined : "fig--card"}
      label={`Schéma : l’établissement confirme le rattachement du professionnel ; le professionnel demande l’accès ; le patient autorise ou refuse.${terms ? " L’éditeur fournit le service." : ""}`}
      caption={terms
        ? "L’éditeur fournit le service. Il ne remplace ni le patient, ni le professionnel, ni l’établissement dans leurs décisions."
        : "Le patient décide. Le professionnel ne consulte que ce que le patient a autorisé."}
    >
      <Svg viewBox={`0 0 360 ${terms ? 370 : 306}`}>
        {/* tracés et paquets d'abord : les cartes passent dessus */}
        <path data-path="request" className="fg-track" d="M160 180 V248" />
        <path data-path="answer" className="fg-track" d="M204 248 V180" />
        <Packet name="request" />
        <Packet name="answer" />

        <Line d="M180 56 V117" />
        <Arrow x={180} y={117} />
        <text className="fg-label fg-fade" x="192" y="92">confirme le rattachement</text>

        <Line d="M160 180 V241" />
        <Arrow x={160} y={241} />
        <text className="fg-label fg-fade" x="148" y="216" textAnchor="end">demande l’accès</text>

        <Line d="M204 248 V187" />
        <Arrow x={204} y={187} dir="up" />
        <text className="fg-label fg-fade" x="216" y="216">autorise ou refuse</text>

        <Node x={65} y={0} w={230} h={56} icon="building" title="Établissement" sub="gère les rattachements" />
        <Node x={65} y={124} w={230} h={56} icon="stethoscope" title="Professionnel" sub="consulte ce qui est autorisé" />
        <Node x={65} y={248} w={230} h={56} icon="user" title="Patient" sub="décide des accès" tone="accent" />

        {terms && <Node x={0} y={324} w={360} h={44} title="Éditeur : fournit le service" tone="ghost" />}
      </Svg>
    </Figure>
  );
}
