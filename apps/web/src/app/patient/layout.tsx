import type { ReactNode } from "react";
import { DataSaverBanner } from "../../components/data-saver/DataSaverBanner";
import { SpaceShell } from "../../components/shell/SpaceShell";

export default function Layout({ children }: { children: ReactNode }) {
  return <SpaceShell space="patient"><DataSaverBanner />{children}</SpaceShell>;
}
