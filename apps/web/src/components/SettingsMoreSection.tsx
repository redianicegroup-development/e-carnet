import Link from "next/link";

const available = [
  { href: "/faq", icon: "?", title: "Aide et questions fréquentes", description: "Trouver des réponses sur l’utilisation du carnet." },
  { href: "/a-propos", icon: "i", title: "À propos", description: "Comprendre le principe et le fonctionnement d’E‑Carnet." },
  { href: "/securite", icon: "▣", title: "Sécurité et données", description: "Consulter les principes de sécurité du service." },
  { href: "/conditions-rattachement", icon: "✓", title: "Conditions de rattachement", description: "Lire les règles applicables aux rattachements professionnels." },
];
const comingSoon = ["Conditions générales d’utilisation", "Confidentialité", "Mentions légales", "Crédits"];

export function SettingsMoreSection() {
  return (
    <section className="settings-more-content" aria-label="Ressources E-Carnet">
      <p className="muted">Les ressources disponibles et les pages d’information prévues pour E‑Carnet.</p>
      <div className="settings-more-list">
        {available.map((item) => (
          <Link className="setting-item" href={item.href} key={item.href}>
            <span className="setting-item__icon" aria-hidden="true">{item.icon}</span>
            <span className="setting-item__meta"><strong>{item.title}</strong><span>{item.description}</span></span>
            <span className="setting-item__chevron" aria-hidden="true">↗</span>
          </Link>
        ))}
        {comingSoon.map((title) => (
          <div className="setting-item setting-item--upcoming" key={title} aria-disabled="true">
            <span className="setting-item__icon" aria-hidden="true">…</span>
            <span className="setting-item__meta"><strong>{title}</strong><span>Cette page sera ajoutée prochainement.</span></span>
            <span className="badge pending">À venir</span>
          </div>
        ))}
      </div>
    </section>
  );
}
