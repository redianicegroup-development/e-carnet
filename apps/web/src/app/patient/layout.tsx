import type { ReactNode } from "react";
import { SpaceShell } from "../../components/shell/SpaceShell";

export default function Layout({ children }: { children: ReactNode }) {
  return <SpaceShell space="patient">{children}</SpaceShell>;
}
