import { ScreenLoader } from "../components/ui/ScreenLoader";

/* Même écran d'attente que celui de l'espace connecté : la transition entre les deux reste invisible. */
export default function Loading() {
  return <ScreenLoader label="Chargement…" />;
}
