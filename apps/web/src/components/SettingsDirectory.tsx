"use client";

import type { KeyboardEvent } from "react";

export type SettingsNavItem = {
  id: string;
  title: string;
  description: string;
  icon: string;
};

type Props = {
  items: SettingsNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onLogout?: () => void;
  logoutDisabled?: boolean;
};

export function SettingsDirectory({ items, activeId, onSelect, onLogout, logoutDisabled = false }: Props) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]"));
    const currentIndex = tabs.findIndex((tab) => tab.id === `settings-tab-${activeId}`);
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    tabs[nextIndex]?.focus();
    const item = items[nextIndex];
    if (item) onSelect(item.id);
  }

  return (
    <div className="settings-directory">
      <div className="setting-list" role="tablist" aria-label="Rubriques des paramètres" aria-orientation="vertical" onKeyDown={handleKeyDown}>
        {items.map((item) => {
          const selected = item.id === activeId;
          return (
            <button
              className={`setting-item${selected ? " setting-item--active" : ""}`}
              type="button"
              role="tab"
              id={`settings-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`settings-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              key={item.id}
              onClick={() => onSelect(item.id)}
            >
              <span className="setting-item__icon" aria-hidden="true">{item.icon}</span>
              <span className="setting-item__meta">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </span>
              <span className="setting-item__chevron" aria-hidden="true">›</span>
            </button>
          );
        })}
      </div>
      {onLogout && (
        <button type="button" className="setting-item setting-item--danger" onClick={onLogout} disabled={logoutDisabled}>
          <span className="setting-item__icon" aria-hidden="true">↪</span>
          <span className="setting-item__meta"><strong>Se déconnecter</strong></span>
          <span className="setting-item__chevron" aria-hidden="true">›</span>
        </button>
      )}
    </div>
  );
}
