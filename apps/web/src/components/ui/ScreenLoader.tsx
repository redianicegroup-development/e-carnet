import { BrandMark } from "./BrandMark";

export function ScreenLoader({ label = "Préparation de votre espace…" }: { label?: string }) {
  return <div className="screen-loader" role="status" aria-live="polite" aria-label={label}>
    <div className="screen-loader__orb"><span className="screen-loader__ring" aria-hidden="true" /><BrandMark /></div>
    <strong>Mon E‑Carnet</strong>
    <p>{label}</p>
  </div>;
}
