"use client";

import { useState } from "react";
import { LandingFeedbackWidget } from "./LandingFeedbackWidget";
import { LinkedProvidersSettingsClient } from "./LinkedProvidersSettingsClient";
import { SettingsDirectory, type SettingsNavItem } from "./SettingsDirectory";
import { SettingsModal } from "./SettingsModal";
import { SettingsMoreSection } from "./SettingsMoreSection";
import { ThemeSettingsClient } from "./ThemeSettingsClient";

const sections: SettingsNavItem[] = [
  { id: "compte", title: "Paramètres du compte", description: "Personnaliser l’apparence de l’application.", icon: "sparkle" },
  { id: "securite", title: "Sécurité et connexion", description: "Gérer les fournisseurs liés au compte.", icon: "lock" },
  { id: "en-savoir-plus", title: "En savoir plus", description: "Aide, informations et documents Mon E‑Carnet.", icon: "help" },
  { id: "avis", title: "Votre avis", description: "Partager une suggestion ou signaler un problème.", icon: "pencil" },
];

type Props = { onLogout: () => void; logoutDisabled?: boolean };

export function AdminSettingsClient({ onLogout, logoutDisabled = false }: Props) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const title = sections.find((section) => section.id === activeSection)?.title ?? "Paramètres";
  return <div className="settings-page admin-settings-page">
    <section className="card"><span className="eyebrow">Console privée</span><h2>Paramètres</h2><p className="muted">Les mêmes préférences de compte et d’apparence sont disponibles dans les autres espaces.</p></section>
    <SettingsDirectory items={sections} activeId={activeSection} onSelect={setActiveSection} />
    <section className="card admin-settings-session"><div><span className="eyebrow">Session sécurisée</span><h2>Terminer la session administrateur</h2><p className="muted">La console reste protégée et demandera à nouveau une authentification.</p></div><button type="button" className="button" disabled={logoutDisabled} onClick={onLogout}>Déconnexion</button></section>
    {activeSection === "compte" && <SettingsModal title={title} onClose={() => setActiveSection(null)}><div className="settings-modal-section"><span className="eyebrow">Préférences personnelles</span><p className="muted">Votre thème est synchronisé avec votre compte et vos autres appareils.</p><ThemeSettingsClient compact space="professional" /></div></SettingsModal>}
    {activeSection === "securite" && <SettingsModal title={title} onClose={() => setActiveSection(null)}><div className="settings-modal-section"><span className="eyebrow">Accès au compte</span><LinkedProvidersSettingsClient nextPath="/admin/" /></div></SettingsModal>}
    {activeSection === "en-savoir-plus" && <SettingsModal title={title} onClose={() => setActiveSection(null)}><SettingsMoreSection /></SettingsModal>}
    {activeSection === "avis" && <SettingsModal title={title} onClose={() => setActiveSection(null)}><div className="settings-modal-section"><span className="eyebrow">Amélioration continue</span><p className="muted">N’indiquez aucune information personnelle ou médicale dans votre retour.</p><LandingFeedbackWidget inline /></div></SettingsModal>}
  </div>;
}
