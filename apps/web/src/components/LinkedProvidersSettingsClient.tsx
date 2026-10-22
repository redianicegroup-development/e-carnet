"use client";

import { useEffect, useState } from "react";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";
import { useConfirm } from "./modal/ConfirmProvider";

type Provider = "google" | "facebook" | "apple";
type Identity = { provider: Provider; display_name: string; avatar_url: string };
type Account = { auth_identities: Identity[] };
type Props = { nextPath: string };

const API = "";
const providers: { id: Provider; label: string; hint: string }[] = [
  { id: "google", label: "Google", hint: "Compte Google" },
  { id: "facebook", label: "Facebook", hint: "Compte Facebook" },
  { id: "apple", label: "Apple", hint: "Compte Apple" },
];

export function LinkedProvidersSettingsClient({ nextPath }: Props) {
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);
  const [message, setMessage] = useState("Chargement des méthodes de connexion…");
  const confirm = useConfirm();

  async function load() {
    const response = await fetch(`${API}/api/v1/identity/me/`, { credentials: "include", cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Impossible de charger les méthodes de connexion.");
    const account = payload.data as Account;
    setIdentities(account.auth_identities ?? []);
  }

  useEffect(() => {
    let active = true;
    // Retour de Google : le serveur indique si la liaison a été refusée (autre adresse, adresse non confirmée…).
    const returned = new URLSearchParams(window.location.search);
    const returnedMessage = returned.get("oauth") ? returned.get("message") : null;
    fetch(`${API}/api/v1/identity/me/`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message ?? "Impossible de charger les méthodes de connexion.");
        if (active) setIdentities((payload.data as Account).auth_identities ?? []);
      })
      .then(() => { if (active) setMessage(returnedMessage || "Gérez les comptes externes associés à votre compte Mon E‑Carnet."); })
      .catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "Méthodes de connexion indisponibles."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function unlink(provider: Provider) {
    setBusyProvider(provider);
    try {
      const csrf = await primeCsrf();
      if (!csrf.ok) throw new Error("Impossible d’établir une session sécurisée.");
      const response = await fetch(`${API}/api/v1/identity/oauth/identities/${provider}/`, {
        method: "DELETE",
        credentials: "include",
        headers: { "X-CSRFToken": readCsrfToken() },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Déliaison impossible.");
      await load();
      setMessage(`${providers.find((item) => item.id === provider)?.label ?? provider} a été délié.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Déliaison impossible.");
    } finally {
      setBusyProvider(null);
    }
  }

  async function askUnlink(provider: Provider) {
    const label = providers.find((item) => item.id === provider)?.label ?? provider;
    const ok = await confirm({ title: `Délier ${label} ?`, message: `Vous ne pourrez plus vous connecter à Mon E‑Carnet avec ${label}.`, note: "Votre compte et vos données ne sont pas supprimés. Si c’est votre dernière méthode de connexion, ajoutez d’abord un mot de passe.", confirmLabel: "Délier", cancelLabel: "Garder", tone: "danger", mood: "decision" });
    if (ok) await unlink(provider);
  }

  const linked = new Set(identities.map((identity) => identity.provider));
  return (
    <div className="settings-subsection">
      <p className="muted">La liaison se fait depuis une session authentifiée. Mon E‑Carnet ne fusionne pas automatiquement deux comptes par adresse e-mail.</p>
      <div className="settings-provider-list">
        {providers.map((provider) => (
          <div className="record settings-provider" key={provider.id}>
            <div><strong>{provider.label}</strong><p className="muted">{loading ? "Vérification…" : linked.has(provider.id) ? "Lié à ce compte" : provider.hint}</p></div>
            {loading ? <span className="muted">Chargement…</span> : linked.has(provider.id) ? (
              <button type="button" className="button small" disabled={loading || busyProvider !== null} onClick={() => void askUnlink(provider.id)}>
                {busyProvider === provider.id ? "Déliaison…" : "Délier"}
              </button>
            ) : (
              <a className="button small" aria-disabled={busyProvider !== null} href={`${API}/api/v1/identity/oauth/${provider.id}/start/?intent=link&next=${encodeURIComponent(nextPath)}`}>
                Lier
              </a>
            )}
          </div>
        ))}
      </div>
      <p className="status" role="status" aria-live="polite">{message}</p>
    </div>
  );
}
