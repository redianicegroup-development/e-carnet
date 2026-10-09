"use client";

import { useState } from "react";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type FormState = { name: string; establishment_type: string; city: string; address: string; phone: string; email: string; responsible_name: string; responsible_email: string; responsible_first_name: string; responsible_last_name: string };
const initial: FormState = { name: "", establishment_type: "Clinique", city: "", address: "", phone: "", email: "", responsible_name: "", responsible_email: "", responsible_first_name: "", responsible_last_name: "" };

export function StaffEstablishmentConsole() {
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState("Cette console est réservée au staff E‑Carnet authentifié.");
  const [invite, setInvite] = useState<{ expires_at: string } | null>(null);
  function update(key: keyof FormState, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await primeCsrf();
    const csrf = readCsrfToken();
    const response = await fetch(`${API}/api/v1/establishments/startup/establishments/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": csrf }, body: JSON.stringify(form) });
    const payload = await response.json();
    if (!response.ok) { setInvite(null); setMessage(payload.message ?? "Création impossible."); return; }
    setInvite({ expires_at: payload.data.expires_at });
    setMessage("Structure validée. L’invitation nominative a été confiée au canal e-mail configuré. Vérifiez sa réception ; en local, consultez le terminal de l’API.");
    setForm(initial);
  }
  return <div className="hero-page"><span className="eyebrow">Console privée · E‑Carnet</span><h1>Vérifier une structure et créer son accès</h1><p className="notice" role="status">{message}</p><form className="card" onSubmit={submit}><div className="grid">{([['name','Nom de la structure'],['establishment_type','Type'],['city','Ville'],['phone','Téléphone'],['email','Email structure'],['responsible_name','Responsable déclaré'],['responsible_first_name','Prénom administrateur'],['responsible_last_name','Nom administrateur'],['responsible_email','Email nominatif administrateur']] as const).map(([key, label]) => <label className="field" key={key}><span>{label}</span><input required type={key.includes('email') || key === 'email' ? 'email' : 'text'} value={form[key]} onChange={(event) => update(key, event.target.value)} /></label>)}</div><label className="field"><span>Adresse</span><textarea required rows={3} value={form.address} onChange={(event) => update('address', event.target.value)} /></label><button className="button primary" type="submit">Valider et créer l’invitation</button></form>{invite && <section className="card" style={{ marginTop: 24 }}><h2>Invitation confiée au canal e-mail</h2><p className="muted">Le lien personnel, à usage unique, expire le {new Date(invite.expires_at).toLocaleString('fr-FR')}. Le jeton secret n’est jamais affiché dans la console. Vérifiez que le message est bien reçu avant de poursuivre.</p></section>}</div>;
}
