import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "../../components/public/PublicShell";

export const metadata: Metadata = { title: "À propos — Mon Carnet Numérique", description: "Comprendre le carnet de santé personnel contrôlé par le patient.", robots: { index: true, follow: true } };

export default function AboutPage() {
  return <PublicShell><article className="hero-page"><span className="eyebrow">Le principe</span><h1>Un carnet durable, sous le contrôle du patient.</h1><p className="lead">Mon Carnet Numérique aide le patient à préparer une consultation, garder l’historique de ses informations et autoriser un professionnel seulement dans un périmètre et une durée visibles.</p><div className="grid"><section className="card"><h2>Patient titulaire</h2><p className="muted">Le patient conserve ses déclarations, leur provenance et la décision d’autoriser ou non un accès.</p></section><section className="card"><h2>Accès limité</h2><p className="muted">Un professionnel ne lit rien sans vérification, rattachement, établissement actif et consentement explicite. Le MFA TOTP est reporté en V3.</p></section><section className="card"><h2>Historique visible</h2><p className="muted">Les pré-consultations et consultations gardent leur provenance. Les corrections sont historisées.</p></section></div></article><footer className="footer"><Link href="/securite">Sécurité</Link> · <Link href="/faq">Questions fréquentes</Link></footer></PublicShell>;
}
