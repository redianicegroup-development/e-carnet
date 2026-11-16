import { APP_SLOGAN } from "../../lib/brand";

/** Le slogan de l'application, sous le titre d'une page d'information. */
export function AppSlogan({ className = "" }: { className?: string }) {
  return <p className={`app-slogan ${className}`.trim()}>{APP_SLOGAN}</p>;
}
