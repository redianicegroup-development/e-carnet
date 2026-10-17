import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "../../components/ui/BrandMark";

export const metadata = { robots: { index: false, follow: false } };

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <main className="shell">
      <header className="topbar">
        <span className="brand"><BrandMark /><span className="brand-text"><strong>Mon E-Carnet</strong><small>Console équipe</small></span></span>
        <nav className="header-links" aria-label="Console équipe"><Link className="button small" href="/staff/etablissements">Établissements</Link><Link className="button small" href="/staff/medecins">Médecins</Link></nav>
      </header>
      {children}
    </main>
  );
}
