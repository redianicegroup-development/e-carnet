import { CREDITS_ORIGINS, CREDITS_TEAM } from "../../../lib/credits";
import { Figure, Line, Node, Packet, Svg, wrapText } from "./parts";

/* Schémas de la page Crédits. Les rôles et les structures viennent de lib/credits.ts : aucun nom de personne n'est dessiné (seuls les rôles sont confirmés). */

/** Organigramme : Redianice porte le projet ; quatre rôles ; le développeur de l'équipe est le fondateur d'AKATech Studio. */
export function CreditsTeamFigure() {
  const redianice = CREDITS_ORIGINS.find((entry) => entry.id === "redianice");
  const akatech = CREDITS_ORIGINS.find((entry) => entry.id === "akatech");
  const slot = { "chef-de-projet": [0, 92], juridique: [188, 92], "identite-visuelle": [0, 196], developpement: [188, 196] } as const;
  return (
    <Figure
      label="Schéma : Redianice porte le projet. L’équipe réunit un chef de projet, un juriste, deux graphistes pour l’identité visuelle et le développeur, qui est le fondateur d’AKATech Studio."
    >
      <Svg viewBox="0 0 360 368">
        <Line d="M180 52 V72" />
        <Line d="M86 72 H274" />
        <Line d="M86 72 V92" />
        <Line d="M274 72 V92" />
        <Line d="M86 176 V196" />
        <Line d="M274 176 V196" />
        <Line d="M274 280 V304" dashed />
        {redianice && <Node x={60} y={0} w={240} h={52} title={redianice.name} sub="startup porteuse du projet" tone="accent" />}
        {CREDITS_TEAM.map((member) => {
          const [x, y] = slot[member.id as keyof typeof slot] ?? [0, 92];
          return <Node key={member.id} x={x} y={y} w={172} h={84} pad={46} icon={member.icon} title={wrapText(member.role, 14)} sub={wrapText(member.org, 18)} tone={member.id === "developpement" ? "soft" : "plain"} />;
        })}
        {akatech && <Node x={188} y={304} w={172} h={56} title={akatech.name} sub={akatech.role} tone="ghost" />}
      </Svg>
    </Figure>
  );
}

/** Les trois couches du service : interface, API, base de données (les mêmes technologies que la liste « Construit avec »). */
export function CreditsStackFigure() {
  const layers = [
    { title: "Interface", sub: "Next.js · React", icon: "sidebar" as const },
    { title: "API", sub: "Django · Django REST framework", icon: "sliders" as const },
    { title: "Base de données", sub: "PostgreSQL", icon: "folder" as const },
  ];
  return (
    <Figure label="Schéma : l’interface (Next.js et React) dialogue avec l’API (Django et Django REST framework), qui lit et écrit dans la base de données PostgreSQL.">
      <Svg viewBox="0 0 360 232">
        <path data-path="stack" className="fg-track" d="M180 62 V170" />
        <Packet name="stack" />
        {layers.slice(1).map((_, index) => <Line key={index} d={`M180 ${62 + index * 84} V${84 + index * 84}`} />)}
        {layers.map((layer, index) => <Node key={layer.title} x={20} y={index * 84} w={320} h={62} icon={layer.icon} title={layer.title} sub={layer.sub} tone={index === 1 ? "soft" : "plain"} />)}
      </Svg>
    </Figure>
  );
}

/** Le signe de la marque (un carnet relié et un interrupteur), tracé comme dans BrandLogo ; le bouton glisse d'un bout à l'autre. */
export function BrandSwitchFigure() {
  return (
    <figure className="fig brand-switch" data-figure>
      <svg className="fig__svg" viewBox="8 6 80 84" role="img" aria-label="Le signe de Mon E‑Carnet : un carnet relié dont la reliure est un interrupteur" focusable="false">
        <path className="fg-pop" d="M25 10.04 A12 12 0 0 0 14 22 V74 A12 12 0 0 0 25 85.96 Z" fill="var(--brand-spine, #2C3A33)" />
        <path className="fg-pop" d="M31 10 H74 A12 12 0 0 1 86 22 V74 A12 12 0 0 1 74 86 H31 A3 3 0 0 1 28 83 V13 A3 3 0 0 1 31 10 Z M48.0 37 H66.0 A11.0 11.0 0 0 1 66.0 59 H48.0 A11.0 11.0 0 0 1 48.0 37 Z" fill="var(--brand-cover, #597C66)" fillRule="evenodd" />
        <circle className="fg-switch-knob" cx="66" cy="48" r="7" fill="var(--brand-cover, #597C66)" data-from="48" />
      </svg>
    </figure>
  );
}
