"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError, apiGet, apiPost } from "../infrastructure/api/client";
import { formatDay, formatWhen } from "./access/access-history";
import { useConfirm } from "./modal/ConfirmProvider";
import { EVENT_LABEL, INVOICE_BADGE, INVOICE_LABEL, fcfa } from "./EstablishmentBilling";
import { Profile, ProfileGrid, type ProfileStatus } from "./ui/Profile";
import "./billing.css";

type Row = { id: string; name: string; city: string; establishment_status: string; suspension_reason: string; offer_name: string; subscription_status: string; status_label: string; pending_count: number; pending_total_fcfa: number; oldest_due_date: string | null; days_overdue: number };
type Invoice = { id: string; number: string; label: string; due_date: string; amount_fcfa: number; status: "paid" | "pending" | "overdue" | "void" };
type Detail = {
  establishment: { id: string; name: string; status: string; suspension_reason?: string };
  payment_methods: { code: string; label: string }[];
  invoices: Invoice[]; payments: { id: string; invoice_number: string; method_label: string; status: string; amount_fcfa: number; confirmed_at: string | null; created_at: string }[];
  events: { kind: string; detail: string; created_at: string }[];
};
const TONE: Record<string, ProfileStatus["tone"]> = { active: "ok", pending_payment: "warn", past_due: "warn", unpaid: "warn", suspended: "off", cancelled: "off", none: "off" };

/* Console → Facturation : suivi des abonnements et confirmation des paiements reçus hors ligne (virement, mobile money).
   La confirmation exige une référence de transaction ; elle active l'abonnement et lève une suspension pour impayé, jamais une autre. */
export function AdminBillingClient() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    try { setRows(await apiGet<Row[]>("/api/v1/billing/staff/subscriptions/")); setError(""); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Impossible de charger la facturation."); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial depuis l’API.
  useEffect(() => { void loadList(); }, [loadList]);

  async function open(id: string) {
    setError(""); setReference("");
    try { setDetail(await apiGet<Detail>(`/api/v1/billing/staff/establishments/${id}/`)); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Détail indisponible."); }
  }

  async function confirmPayment(event: FormEvent, invoice: Invoice) {
    event.preventDefault();
    setBusy(true); setError("");
    try { setDetail(await apiPost<Detail>(`/api/v1/billing/staff/invoices/${invoice.id}/confirm-payment/`, { method, provider_reference: reference })); setReference(""); await loadList(); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Confirmation impossible."); }
    finally { setBusy(false); }
  }

  async function voidInvoice(invoice: Invoice) {
    if (!(await confirm({ title: `Annuler la facture ${invoice.number} ?`, message: "Elle ne sera plus à régler. L’annulation reste dans l’historique.", confirmLabel: "Annuler la facture", tone: "danger" }))) return;
    try { setDetail(await apiPost<Detail>(`/api/v1/billing/staff/invoices/${invoice.id}/void/`, {})); await loadList(); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Annulation impossible."); }
  }

  return (
    <div className="billing stack-lg">
      {error && <p className="notice" role="alert">{error}</p>}
      <section className="card stack">
        <h2>Facturation des établissements</h2>
        <p className="muted">Le patient ne paie jamais. Une suspension pour impayé ne touche que l’espace professionnel de l’établissement : les patients gardent leur carnet.</p>
        {!rows && !error && <p className="muted">Chargement…</p>}
        {rows && rows.length === 0 && <p className="empty">Aucun établissement.</p>}
        {rows && rows.length > 0 && <ProfileGrid label="Établissements et abonnements">
          {rows.map((row) => <Profile
            key={row.id} name={row.name} label={row.name} subtitle={row.offer_name || "Pas d’offre"}
            status={{ label: row.status_label, tone: TONE[row.subscription_status] ?? "warn" }}
            rows={[
              { label: "Ville", value: row.city || "—" },
              { label: "Offre", value: row.offer_name || "Pas d’offre" },
              { label: "Abonnement", value: row.status_label },
              { label: "Établissement", value: row.establishment_status === "suspended" ? `Suspendu${row.suspension_reason ? ` (${row.suspension_reason})` : ""}` : "Actif" },
              { label: "À régler", value: row.pending_count > 0 ? `${row.pending_count} facture(s), ${fcfa(row.pending_total_fcfa)}` : "Rien à régler" },
              ...(row.pending_count > 0 && row.oldest_due_date ? [{ label: "Plus ancienne échéance", value: `${formatDay(row.oldest_due_date)}${row.days_overdue > 0 ? ` (${row.days_overdue} jours de retard)` : ""}` }] : []),
            ]}
            actions={[{ label: "Voir le détail", tone: "primary", onClick: async ({ close }) => { close(); await open(row.id); window.setTimeout(() => document.getElementById("billing-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); } }]}
          />)}
        </ProfileGrid>}
      </section>

      {detail && (
        <section className="card stack" id="billing-detail" aria-label={`Détail de ${detail.establishment.name}`}>
          <div className="billing__line"><h3>{detail.establishment.name}</h3><button type="button" className="button" onClick={() => setDetail(null)}>Fermer</button></div>
          <h4>Factures</h4>
          {detail.invoices.length === 0 && <p className="muted">Aucune facture.</p>}
          <ul className="billing__list">
            {detail.invoices.map((invoice) => (
              <li key={invoice.id}>
                <div className="billing__line"><strong>{invoice.number}</strong><span className={`badge ${INVOICE_BADGE[invoice.status]}`}>{INVOICE_LABEL[invoice.status]}</span></div>
                <p>{fcfa(invoice.amount_fcfa)}. Échéance : {formatDay(invoice.due_date)}.</p>
                {(invoice.status === "pending" || invoice.status === "overdue") && (
                  <form className="billing__pay stack" onSubmit={(event) => void confirmPayment(event, invoice)}>
                    <label className="field">Moyen de paiement reçu
                      <select value={method} onChange={(event) => setMethod(event.target.value)}>{detail.payment_methods.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select>
                    </label>
                    <label className="field">Référence de la transaction (obligatoire)
                      <input value={reference} onChange={(event) => setReference(event.target.value)} minLength={3} required placeholder="Numéro de transaction ou de virement" />
                    </label>
                    <div className="row">
                      <button type="submit" className="button primary" disabled={busy}>{busy ? "Enregistrement…" : "Confirmer la réception"}</button>
                      <button type="button" className="button" onClick={() => void voidInvoice(invoice)}>Annuler la facture</button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <h4>Paiements</h4>
          {detail.payments.length === 0 && <p className="muted">Aucun paiement.</p>}
          <ul className="billing__list">{detail.payments.map((payment) => <li key={payment.id}><strong>{payment.invoice_number}</strong><p className="muted">{payment.method_label}, {fcfa(payment.amount_fcfa)}, {payment.status === "confirmed" ? `confirmé le ${formatWhen(payment.confirmed_at ?? payment.created_at)}` : "en attente"}</p></li>)}</ul>
          <h4>Historique (souscriptions, retards, suspensions, réactivations)</h4>
          <ul className="billing__list">{detail.events.map((event, index) => <li key={index}><strong>{EVENT_LABEL[event.kind] ?? event.kind}</strong><p className="muted">{formatWhen(event.created_at)}. {event.detail}</p></li>)}</ul>
        </section>
      )}
    </div>
  );
}
