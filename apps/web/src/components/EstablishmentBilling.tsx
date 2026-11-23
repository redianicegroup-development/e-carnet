"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiGet, apiPost } from "../infrastructure/api/client";
import { formatDay, formatWhen } from "./access/access-history";
import { Icon } from "./ui/Icon";
import { quoteRequestHref } from "../lib/quote-request";
import "./billing.css";

type Offer = { code: string; name: string; price_fcfa: number | null; capacity_label: string; max_practitioners: number | null; self_service: boolean; includes: string[] };
type InvoiceRow = { id: string; number: string; label: string; due_date: string; amount_fcfa: number; setup_fee_fcfa: number; status: "paid" | "pending" | "overdue" | "void"; paid_at: string | null; document_url: string };
type PaymentRow = { id: string; invoice_number: string; method_label: string; status: string; amount_fcfa: number; created_at: string; confirmed_at: string | null };
type Overview = {
  establishment: { id: string; name: string; status: string };
  offers: Offer[]; conditions: string; setup_fee_fcfa: number; payment_methods: { code: string; label: string }[]; practitioners: number;
  subscription: { offer_code: string; offer_name: string; next_offer_code: string; status: string; status_label: string; current_period_end: string | null } | null;
  notice: { level: "info" | "warning" | "danger"; message: string } | null;
  invoices: InvoiceRow[]; payments: PaymentRow[]; events: { kind: string; detail: string; created_at: string }[];
};
type PayResult = { reference: string; amount_fcfa: number; instructions: string; confirmation: string };

export const fcfa = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;
export const INVOICE_BADGE: Record<InvoiceRow["status"], string> = { paid: "verified", pending: "declared", overdue: "contested", void: "expired" };
export const INVOICE_LABEL: Record<InvoiceRow["status"], string> = { paid: "Payée", pending: "En attente", overdue: "En retard", void: "Annulée" };
export const EVENT_LABEL: Record<string, string> = { subscribed: "Souscription", plan_changed: "Changement d’offre", invoice_issued: "Facture émise", payment_confirmed: "Paiement confirmé", past_due: "Facture en retard", unpaid: "Facture impayée", suspended: "Accès suspendu", reactivated: "Accès rétabli", cancelled: "Souscription annulée", invoice_void: "Facture annulée" };
const SUB_BADGE: Record<string, string> = { active: "verified", pending_payment: "declared", past_due: "contested", unpaid: "contested", suspended: "contested", cancelled: "expired" };

/* Cartes de tarifs : ce que l'offre contient (coches) et, pour donner envie sans rien promettre de faux, ce que la seule offre du dessus ajoute (croix).
   Les lignes viennent de l'API : on n'invente aucune fonctionnalité. « Toute l'offre X » n'est pas une fonctionnalité, on ne la compte pas comme manquante. */
const MAX_MISSING = 3;
export function missingFeatures(offers: Offer[], index: number): string[] {
  const own = new Set(offers[index].includes);
  const next = offers[index + 1];
  return next ? next.includes.filter((line) => !own.has(line) && !/^toute l[’']offre/i.test(line)).slice(0, MAX_MISSING) : [];
}
const amountLabel = (value: number) => new Intl.NumberFormat("fr-FR").format(value);

/* Paramètres de l'établissement → Facturation. Le patient ne paie jamais. Le navigateur ne déclare jamais une facture payée :
   « Régler » donne les instructions et la référence, la confirmation vient du serveur (équipe ou prestataire de paiement). */
export function EstablishmentBilling({ establishmentId }: { establishmentId: string }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [choice, setChoice] = useState<Offer | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<PayResult | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await apiGet<Overview>(`/api/v1/billing/establishment/?establishment=${establishmentId}`)); setError(""); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Impossible de charger la facturation."); }
  }, [establishmentId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial depuis l’API.
  useEffect(() => { void load(); }, [load]);

  async function subscribe() {
    if (!choice) return;
    setBusy(true); setError("");
    try { setData(await apiPost<Overview>("/api/v1/billing/establishment/subscribe/", { offer: choice.code, establishment: establishmentId })); setChoice(null); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Souscription impossible."); }
    finally { setBusy(false); }
  }

  async function pay(invoice: InvoiceRow, method: string) {
    setBusy(true); setError("");
    try { setInstructions(await apiPost<PayResult>(`/api/v1/billing/invoices/${invoice.id}/pay/`, { method })); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Paiement indisponible."); }
    finally { setBusy(false); }
  }

  if (!data) return <p className={error ? "notice" : "muted"} role={error ? "alert" : undefined}>{error || "Chargement de la facturation…"}</p>;
  const subscription = data.subscription;
  const pendingChange = subscription?.next_offer_code ? data.offers.find((offer) => offer.code === subscription.next_offer_code) : null;

  return (
    <div className="billing stack">
      {data.notice && <p className={`notice billing__notice billing__notice--${data.notice.level}`} role={data.notice.level === "info" ? "status" : "alert"}>{data.notice.message}</p>}
      {error && <p className="notice" role="alert">{error}</p>}

      <section className="card stack" aria-labelledby="billing-current">
        <h3 id="billing-current">Abonnement actuel</h3>
        {subscription ? (
          <dl className="kv">
            <div><dt>Offre</dt><dd>{subscription.offer_name}</dd></div>
            <div><dt>État</dt><dd><span className={`badge ${SUB_BADGE[subscription.status] ?? "declared"}`}>{subscription.status_label}</span></dd></div>
            {subscription.current_period_end && <div><dt>Payé jusqu’au</dt><dd>{formatDay(subscription.current_period_end)}</dd></div>}
            <div><dt>Praticiens actifs</dt><dd>{data.practitioners}</dd></div>
            {pendingChange && <div><dt>Prochaine période</dt><dd>Passage à l’offre {pendingChange.name}</dd></div>}
          </dl>
        ) : <p className="muted">Aucun abonnement pour le moment. Choisissez une offre ci-dessous. Le patient ne paie jamais : seul l’établissement est facturé.</p>}
      </section>

      <section className="stack" aria-labelledby="billing-offers">
        <h3 id="billing-offers">Offres</h3>
        <div className="billing__offers">
          {data.offers.map((offer, index) => {
            const current = subscription?.offer_code === offer.code && !subscription.next_offer_code && subscription.status !== "cancelled";
            const upcoming = pendingChange?.code === offer.code;
            const missing = missingFeatures(data.offers, index);
            return (
              <article key={offer.code} className="billing__offer" data-tone={index % 3} data-current={current}>
                {(current || upcoming) && <span className="billing__sticker">{current ? "Offre actuelle" : "Prochaine période"}</span>}
                <header className="billing__offer-head">
                  <h4>{offer.name}</h4>
                  <p className="billing__capacity">{offer.capacity_label}</p>
                </header>
                <p className="billing__price">
                  {offer.price_fcfa === null ? <strong className="billing__amount billing__amount--quote">Sur devis</strong> : <><strong className="billing__amount">{amountLabel(offer.price_fcfa)}</strong><span className="billing__unit">FCFA / mois</span></>}
                </p>
                <ul className="billing__features" aria-label={`Ce que contient l’offre ${offer.name}`}>
                  {offer.includes.map((line) => <li key={line} data-included="true"><Icon name="check" size={18} /><span>{line}</span></li>)}
                  {missing.map((line) => <li key={line} data-included="false"><Icon name="close" size={18} /><span><span className="sr-only">Non inclus : </span>{line}</span></li>)}
                </ul>
                {!offer.self_service ? <div className="billing__quote"><p>Contactez l’équipe <span className="notranslate" translate="no">Mon E‑Carnet</span> pour un devis.</p><a className="billing__cta billing__cta--primary" href={quoteRequestHref({ establishmentName: data.establishment.name, offerName: offer.name, practitioners: data.practitioners })}>Demander un devis</a></div>
                  : current ? <button type="button" className="billing__cta" disabled>Offre actuelle</button>
                  : <button type="button" className="billing__cta billing__cta--primary" onClick={() => { setChoice(offer); setInstructions(null); }}>Choisir cette offre</button>}
              </article>
            );
          })}
        </div>
      </section>

      {choice && (
        <section className="card stack" aria-labelledby="billing-recap">
          <h3 id="billing-recap">Récapitulatif</h3>
          <dl className="kv">
            <div><dt>Offre</dt><dd>{choice.name}</dd></div>
            <div><dt>Tarif</dt><dd>{choice.price_fcfa === null ? "Sur devis" : `${fcfa(choice.price_fcfa)} par mois`}</dd></div>
            <div><dt>Capacité</dt><dd>{choice.capacity_label}</dd></div>
            {data.setup_fee_fcfa > 0 && !subscription && <div><dt>Frais de mise en service</dt><dd>{fcfa(data.setup_fee_fcfa)}, une seule fois</dd></div>}
            <div><dt>Praticiens actifs</dt><dd>{data.practitioners}</dd></div>
          </dl>
          {choice.max_practitioners !== null && data.practitioners > choice.max_practitioners && <p className="notice" role="alert">Vous avez plus de {choice.max_practitioners} praticiens actifs : cette offre ne convient pas.</p>}
          <p className="muted">{data.conditions}</p>
          {subscription && subscription.status !== "pending_payment" && subscription.status !== "cancelled" && <p className="muted">Le changement prendra effet à la prochaine période, sans nouvelle facture immédiate.</p>}
          <div className="row">
            <button type="button" className="button primary" disabled={busy} onClick={() => void subscribe()}>{busy ? "Enregistrement…" : "Confirmer cette offre"}</button>
            <button type="button" className="button" onClick={() => setChoice(null)}>Annuler</button>
          </div>
        </section>
      )}

      <section className="card stack" aria-labelledby="billing-invoices">
        <h3 id="billing-invoices">Factures</h3>
        {data.invoices.length === 0 && <p className="muted">Aucune facture pour le moment.</p>}
        <ul className="billing__list">
          {data.invoices.map((invoice) => (
            <li key={invoice.id}>
              <div className="billing__line"><strong>{invoice.number}</strong><span className={`badge ${INVOICE_BADGE[invoice.status]}`}>{INVOICE_LABEL[invoice.status]}</span></div>
              <p className="muted">{invoice.label}</p>
              <p>{fcfa(invoice.amount_fcfa)}{invoice.setup_fee_fcfa > 0 ? `, dont ${fcfa(invoice.setup_fee_fcfa)} de mise en service` : ""}. Échéance : {formatDay(invoice.due_date)}.</p>
              <div className="row">
                <a className="button" href={invoice.document_url} target="_blank" rel="noopener noreferrer">Voir la facture</a>
                {(invoice.status === "pending" || invoice.status === "overdue") && <button type="button" className="button primary" onClick={() => { setPayingId(payingId === invoice.id ? null : invoice.id); setInstructions(null); }}>Régler</button>}
              </div>
              {payingId === invoice.id && (
                <div className="billing__pay stack">
                  <p className="muted">Choisissez un moyen de paiement :</p>
                  <div className="row">{data.payment_methods.map((method) => <button key={method.code} type="button" className="button" disabled={busy} onClick={() => void pay(invoice, method.code)}>{method.label}</button>)}</div>
                  {instructions && <div className="notice" role="status"><p>{instructions.instructions}</p><p className="muted">{instructions.confirmation}</p></div>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card stack" aria-labelledby="billing-payments">
        <h3 id="billing-payments">Paiements</h3>
        {data.payments.length === 0 && <p className="muted">Aucun paiement enregistré.</p>}
        <ul className="billing__list">
          {data.payments.map((payment) => <li key={payment.id}><div className="billing__line"><strong>{payment.invoice_number}</strong><span className="muted">{payment.method_label}</span></div><p>{fcfa(payment.amount_fcfa)}. {payment.status === "confirmed" ? `Confirmé le ${formatWhen(payment.confirmed_at ?? payment.created_at)}.` : "En attente de confirmation par notre équipe."}</p></li>)}
        </ul>
      </section>

      {data.events.length > 0 && (
        <section className="card stack" aria-labelledby="billing-history">
          <h3 id="billing-history">Historique</h3>
          <ul className="billing__list">{data.events.map((event, index) => <li key={index}><strong>{EVENT_LABEL[event.kind] ?? event.kind}</strong><p className="muted">{formatWhen(event.created_at)}. {event.detail}</p></li>)}</ul>
        </section>
      )}
    </div>
  );
}
