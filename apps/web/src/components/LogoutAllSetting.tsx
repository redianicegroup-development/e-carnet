"use client";

import { useState } from "react";
import { useConfirm } from "./modal/ConfirmProvider";
import { clearGreetingSession } from "./modal/greeting";
import { Icon } from "./ui/Icon";
import { useLogoutAll } from "./useLogoutAll";

/** SEC-04, rangé dans « Sécurité et connexion » : ferme aussi les sessions des autres appareils. L'erreur s'affiche ici, dans la fenêtre ouverte. */
export function LogoutAllSetting({ disabled = false }: { disabled?: boolean }) {
  const confirm = useConfirm();
  const [error, setError] = useState("");
  const allDevices = useLogoutAll(setError);
  async function ask() {
    setError("");
    const ok = await confirm({ title: "Se déconnecter partout ?", message: "Toutes vos sessions seront fermées : ce téléphone, cet ordinateur et vos autres appareils.", note: "Utile si vous avez perdu un appareil ou utilisé un ordinateur partagé.", confirmLabel: "Tout fermer", cancelLabel: "Annuler", tone: "danger", mood: "farewell" });
    if (!ok) return;
    clearGreetingSession();
    void allDevices.logoutAll();
  }
  return (
    <div className="settings-subsection logout-all-setting">
      <h3>Appareils connectés</h3>
      <p className="muted">Si vous avez perdu un appareil ou utilisé un ordinateur partagé, fermez toutes vos sessions d’un seul geste. Vous devrez vous reconnecter partout, y compris ici.</p>
      {error && <p className="status" role="alert">{error}</p>}
      <div className="actions"><button type="button" className="button primary danger" onClick={() => void ask()} disabled={disabled || allDevices.busy}><Icon name="logout" size={18} /> Se déconnecter de tous les appareils</button></div>
    </div>
  );
}
