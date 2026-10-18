import Link from "next/link";
import { CookieSettingItem } from "./CookieSettingItem";
import { Icon, type IconName } from "./ui/Icon";

type MoreItem = { href: string; icon: IconName; title: string; description: string };
type MoreGroup = { title: string; items: MoreItem[] };

/** Rubrique « En savoir plus » des paramètres (patient, professionnel, établissement) : aide, informations légales, crédits. */
const GROUPS: MoreGroup[] = [
  {
    title: "Aide et principes",
    items: [
      { href: "/aide", icon: "help", title: "Aide et questions fréquentes", description: "Guides pas à pas, réponses et dépannage." },
      { href: "/a-propos", icon: "sparkle", title: "À propos", description: "Comprendre le principe et le fonctionnement de Mon E‑Carnet." },
      { href: "/securite", icon: "shield", title: "Sécurité et données", description: "Consulter les principes de sécurité du service." },
    ],
  },
  {
    title: "Informations légales",
    items: [
      { href: "/cgu", icon: "document", title: "Conditions générales d’utilisation", description: "Les règles d’utilisation du service." },
      { href: "/confidentialite", icon: "lock", title: "Confidentialité", description: "Données traitées, cookies et vos droits." },
      { href: "/mentions-legales", icon: "building", title: "Mentions légales", description: "Éditeur, hébergeurs et statut du service." },
      { href: "/conditions-rattachement", icon: "check", title: "Conditions de rattachement", description: "Les règles applicables aux rattachements professionnels." },
    ],
  },
  {
    title: "Remerciements",
    items: [
      { href: "/credits", icon: "heart", title: "Crédits et remerciements", description: "Les personnes et les équipes derrière Mon E‑Carnet." },
    ],
  },
];

export function SettingsMoreSection() {
  return (
    <section className="settings-more-content" aria-label="Ressources Mon E-Carnet">
      <p className="muted">Aide, informations légales et remerciements de Mon E‑Carnet.</p>
      {GROUPS.map((group) => (
        <div className="settings-more-group" key={group.title} role="group" aria-label={group.title}>
          <h3>{group.title}</h3>
          <div className="settings-more-list">
            {group.items.map((item) => (
              <Link className="setting-item" href={item.href} key={item.href}>
                <span className="setting-item__icon" aria-hidden="true"><Icon name={item.icon} /></span>
                <span className="setting-item__meta"><strong>{item.title}</strong><span>{item.description}</span></span>
                <span className="setting-item__chevron" aria-hidden="true">↗</span>
              </Link>
            ))}
            {group.title === "Informations légales" && <CookieSettingItem />}
          </div>
        </div>
      ))}
    </section>
  );
}
