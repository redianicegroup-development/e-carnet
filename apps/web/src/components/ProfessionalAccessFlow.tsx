"use client";

import { useEffect, useState } from "react";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";

type Grant = {
  id: string;
  professional_name: string;
  facility_label: string;
  scope: string[];
  status: string;
  starts_at: string | null;
  expires_at: string | null;
  patient_id?: string;
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, { credentials: "include", cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? "Service indisponible.");
  return payload.data as T;
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const csrfResponse = await primeCsrf();
  const token = readCsrfToken();

  const response = await fetch(`${API}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": token,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  if (!csrfResponse.ok || !response.ok) throw new Error(payload.message ?? "Action impossible.");
  return payload.data as T;
}

const scopeLabels: Record<string, string> = {
  preconsultation: "Pré-consultation",
  declarations: "Déclarations",
  consultations: "Consultations",
};

export function ProfessionalAccessFlow() {
  const [items, setItems] = useState<Grant[]>([]);
  const [message, setMessage] = useState("Chargement des demandes d’accès…");
  const [form, setForm] = useState({ patient_id: "", scope: "preconsultation" });

  async function refresh() {
    const grants = await get<Grant[]>("/api/v1/patient/care/professional/access-grants/");
    setItems(grants);
    setMessage("Autorisations du professionnel chargées.");
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const grants = await get<Grant[]>("/api/v1/patient/care/professional/access-grants/");
        if (!active) return;
        setItems(grants);
        setMessage("Autorisations du professionnel chargées.");
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Impossible de charger les accès.");
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function requestAccess(event: React.FormEvent) {
    event.preventDefault();
    try {
      await post<Grant>("/api/v1/patient/care/professional/access-grants/", {
        patient_id: form.patient_id,
        scope: [form.scope],
      });
      setForm({ patient_id: "", scope: "preconsultation" });
      setMessage("Demande d’AccessGrant envoyée au patient pour validation.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "La demande d’accès n’a pas pu être créée.");
    }
  }

  return (
    <section className="hero-page">
      <span className="eyebrow">AccessGrant · V1</span>
      <h1>Demander un accès au dossier patient</h1>
      <p className="muted">
        Avant consentement, aucune donnée médicale n’est renvoyée. Le patient valide ou refuse la demande, avec durée et périmètre visibles.
      </p>
      <p className="notice" role="status" aria-live="polite">{message}</p>

      <form className="card" onSubmit={requestAccess} style={{ marginTop: 20 }}>
        <h2>Nouvelle demande d’accès</h2>
        <label className="field">
          <span>ID patient</span>
          <input
            required
            value={form.patient_id}
            onChange={(event) => setForm({ ...form, patient_id: event.target.value })}
            placeholder="UUID du patient"
          />
        </label>
        <label className="field">
          <span>Périmètre</span>
          <select value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })}>
            <option value="preconsultation">Pré-consultation</option>
            <option value="declarations">Déclarations</option>
            <option value="consultations">Consultations</option>
          </select>
        </label>
        <button type="submit" className="button primary">Demander l’accès</button>
      </form>

      <section className="card" style={{ marginTop: 24 }}>
        <h2>Demandes en cours</h2>
        {items.length === 0 ? <p className="empty">Aucune demande d’accès pour le moment.</p> : (
          <div className="stack">
            {items.map((item) => (
              <article key={item.id} className="record">
                <div>
                  <strong>{item.professional_name}</strong>
                  <p className="muted">{item.facility_label}</p>
                  <p className="muted">Périmètre : {item.scope.map((scope) => scopeLabels[scope] ?? scope).join(", ")}</p>
                  <p className="muted">Statut : {item.status}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
