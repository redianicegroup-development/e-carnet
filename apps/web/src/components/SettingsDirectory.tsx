"use client";

import { useConfirm } from "./modal/ConfirmProvider";
import { clearGreetingSession } from "./modal/greeting";

export type SettingsNavItem = {
  id: string;
  title: string;
  description: string;
  icon: string;
};

type Props = {
  items: SettingsNavItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onLogout?: () => void;
  logoutDisabled?: boolean;
};

export function SettingsDirectory({ items, activeId, onSelect, onLogout, logoutDisabled = false }: Props) {
  const confirm = useConfirm();
  async function askLogout() {
    if (!onLogout) return;
    const ok = await confirm({ title: "Se déconnecter ?", message: "Vous allez être déconnecté de cet appareil.", note: "Vos données restent enregistrées dans votre compte.", confirmLabel: "Me déconnecter", cancelLabel: "Rester connecté", tone: "neutral", mood: "decision" });
    if (!ok) return;
    clearGreetingSession();
    onLogout();
  }

  return (
    <div className="settings-directory">
      <div className="setting-list" role="group" aria-label="Rubriques des paramètres">
        {items.map((item) => {
          const open = item.id === activeId;
          return (
            <button
              className={`setting-item${open ? " setting-item--active" : ""}`}
              type="button"
              key={item.id}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls="settings-modal"
              onClick={() => onSelect(item.id)}
            >
              <span className="setting-item__icon" aria-hidden="true">{item.icon}</span>
              <span className="setting-item__meta"><strong>{item.title}</strong><span>{item.description}</span></span>
              <span className="setting-item__chevron" aria-hidden="true">›</span>
            </button>
          );
        })}
      </div>
      {onLogout && (
        <button type="button" className="setting-item setting-item--danger" onClick={() => void askLogout()} disabled={logoutDisabled}>
          <span className="setting-item__icon" aria-hidden="true">↪</span>
          <span className="setting-item__meta"><strong>Se déconnecter</strong></span>
          <span className="setting-item__chevron" aria-hidden="true">›</span>
        </button>
      )}
    </div>
  );
}
