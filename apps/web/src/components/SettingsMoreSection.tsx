import Link from "next/link";

const resources = [
  { href: "/aide", icon: "?", title: "Centre d’aide", description: "Guides par espace et réponses pratiques." },
  { href: "/a-propos", icon: "i", title: "À propos", description: "Découvrir E‑Carnet." },
  { href: "/securite", icon: "▣", title: "Sécurité et confidentialité", description: "Comprendre les règles d’accès au carnet." },
  { href: "/conditions-rattachement", icon: "✓", title: "Rattachements professionnels", description: "Consulter les règles de rattachement." },
];

export function SettingsMoreSection() {
  return <section className="settings-more-content" aria-label="Ressources E-Carnet">
    <div className="settings-more-list">
      {resources.map((item) => <Link className="setting-item" href={item.href} key={item.href}>
        <span className="setting-item__icon" aria-hidden="true">{item.icon}</span>
        <span className="setting-item__meta"><strong>{item.title}</strong><span>{item.description}</span></span>
        <span className="setting-item__chevron" aria-hidden="true">↗</span>
      </Link>)}
    </div>
  </section>;
}
