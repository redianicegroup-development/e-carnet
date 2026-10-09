"use client";

import { useEffect, useState } from "react";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";

type Establishment = { id: string; name: string; city: string; status: string };
type Membership = { id: string; status: "pending" | "active" | "refused" | "suspended" | "terminated"; professional_name?: string; professional_email?: string };
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, method = "GET", body?: Record<string, unknown>): Promise<T> {
  const csrf = method === "GET" ? null : await primeCsrf();
  if (csrf && !csrf.ok) throw new Error("Impossible d’établir la session de sécurité.");
  const response = await fetch(`${API}${path}`, { method, credentials: "include", cache: "no-store", headers: method === "GET" ? undefined : { "Content-Type": "application/json", "X-CSRFToken": readCsrfToken() }, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? "Espace établissement indisponible.");
  return payload.data as T;
}

export function EstablishmentAdminWorkspace() {
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [code, setCode] = useState<{ value: string; expires_at: string } | null>(null);
  const [message, setMessage] = useState("Chargement de votre espace établissement…");

  async function refresh() {
    const items = await request<Establishment[]>("/api/v1/establishments/");
    const selected = items[0] ?? null;
    setEstablishment(selected);
    if (selected) setMemberships(await request<Membership[]>(`/api/v1/establishments/${selected.id}/memberships/`));
    setMessage(selected ? "Espace établissement chargé." : "Aucun établissement administré par cette session.");
  }
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const items = await request<Establishment[]>("/api/v1/establishments/");
        if (!active) return;
        const selected = items[0] ?? null;
        setEstablishment(selected);
        if (selected) setMemberships(await request<Membership[]>(`/api/v1/establishments/${selected.id}/memberships/`));
        setMessage(selected ? "Espace établissement chargé." : "Aucun établissement administré par cette session.");
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Accès refusé.");
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function createCode() {
    if (!establishment) return;
    try {
      const result = await request<{ code: string; expires_at: string }>(`/api/v1/establishments/${establishment.id}/join-codes/`, "POST", {});
      setCode({ value: result.code, expires_at: result.expires_at });
      setMessage("Code généré. Il ne sera plus réaffiché après cette session.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Génération impossible."); }
  }
  async function decide(membershipId: string, decision: "approve" | "refuse") {
    if (!establishment) return;
    try { await request(`/api/v1/establishments/${establishment.id}/memberships/${membershipId}/decision/`, "POST", { decision }); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Décision impossible."); }
  }

  return <main className="hero-page"><span className="eyebrow">Espace privé établissement</span><h1>Administrer les rattachements, sans accéder aux dossiers</h1><p className="notice" role="status">{message}</p>{establishment && <><section className="card"><span className="eyebrow">{establishment.city}</span><h2>{establishment.name}</h2><p className="muted">Cet espace est administratif. Aucun dossier clinique n’est accessible depuis ce contexte.</p></section><section className="card" style={{ marginTop: 24 }}><h2>Émettre un code médecin</h2><p className="muted">Le code est à usage unique et expire dans 48 heures. Sa saisie crée une demande en attente ; elle ne rattache pas automatiquement le médecin.</p><button className="button primary" type="button" onClick={createCode}>Générer un code temporaire</button>{code && <div className="notice" style={{ marginTop: 16 }}><strong>{code.value}</strong><br />Expire le {new Date(code.expires_at).toLocaleString("fr-FR")}<br /><small>Transmettez-le directement au médecin. Ne l’inscrivez pas dans un ticket ou un audit.</small></div>}</section><section className="card" style={{ marginTop: 24 }}><h2>Demandes de rattachement</h2>{memberships.length === 0 ? <p className="empty">Aucune demande pour le moment.</p> : <div className="stack">{memberships.map((item) => <article className="record" key={item.id}><div><strong>{item.professional_name || "Médecin"}</strong><p className="muted">{item.professional_email || "Email non disponible"} · {item.status}</p></div>{item.status === "pending" && <div className="actions"><button className="button small" type="button" onClick={() => decide(item.id, "approve")}>Accepter</button><button className="button small" type="button" onClick={() => decide(item.id, "refuse")}>Refuser</button></div>}{item.status === "active" && <button className="button small danger" type="button" onClick={() => { if (window.confirm("Mettre fin au rattachement de ce médecin ? Ses accès futurs à l’établissement seront bloqués et les traces/dossiers existants conservés.")) void request(`/api/v1/establishments/${establishment.id}/memberships/${item.id}/terminate/`, "POST", {}).then(refresh).catch((error) => setMessage(error instanceof Error ? error.message : "Résiliation impossible.")); }}>Mettre fin au rattachement</button>}</article>)}</div>}</section></>}</main>;
}
