"use client";

export type SettingsNavItem = {
  id: string;
  title: string;
  description: string;
  icon: string;
};

type Props = {
  items: SettingsNavItem[];
  onLogout?: () => void;
  logoutDisabled?: boolean;
};

export function SettingsDirectory({ items, onLogout, logoutDisabled = false }: Props) {
  return (
    <nav className="settings-directory" aria-label="Rubriques des paramètres">
      <div className="setting-list">
        {items.map((item) => (
          <a className="setting-item" href={`#${item.id}`} key={item.id}>
            <span className="setting-item__icon" aria-hidden="true">{item.icon}</span>
            <span className="setting-item__meta">
              <strong>{item.title}</strong>
              <span>{item.description}</span>
            </span>
            <span className="setting-item__chevron" aria-hidden="true">›</span>
          </a>
        ))}
        {onLogout && (
          <button type="button" className="setting-item setting-item--danger" onClick={onLogout} disabled={logoutDisabled}>
            <span className="setting-item__icon" aria-hidden="true">↪</span>
            <span className="setting-item__meta"><strong>Se déconnecter</strong></span>
            <span className="setting-item__chevron" aria-hidden="true">›</span>
          </button>
        )}
      </div>
    </nav>
  );
}
