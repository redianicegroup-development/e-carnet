import { Icon } from "./ui/Icon";

/* Logo d'un établissement : l'image si la structure en a une, sinon une pastille avec le pictogramme du bâtiment. */
export function EstablishmentLogo({ logo, name, size = 44 }: { logo?: string | null; name: string; size?: number }) {
  const style = { width: size, height: size };
  // eslint-disable-next-line @next/next/no-img-element -- logo fourni par la structure (URL Cloudinary ou route authentifiée)
  if (logo) return <img className="establishment-logo" style={style} src={logo} alt={`Logo de ${name}`} loading="lazy" referrerPolicy="no-referrer" />;
  return <span className="establishment-logo establishment-logo--empty" style={style} aria-hidden="true"><Icon name="building" size={Math.round(size * 0.5)} /></span>;
}
