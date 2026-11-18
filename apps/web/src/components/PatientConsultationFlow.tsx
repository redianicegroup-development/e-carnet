"use client";

import { Fragment, useState } from "react";
import { Icon } from "./ui/Icon";
import { PatientAccessGrants } from "./PatientAccessGrants";
import { PatientPreconsultations } from "./PatientPreconsultations";
import { PatientProfileChoice } from "./PatientProfileChoice";
import { PatientGuestProfessional } from "./PatientGuestProfessional";
import { PatientGuestConsultations } from "./PatientGuestConsultations";
import "./consultation-flow.css";
import "./guest-access.css";

/* Consultations du patient, en deux étapes, pour le profil choisi en tête (soi-même ou un enfant du compte : PatientProfileChoice).
   1. Pré-consultation : le motif, les symptômes, les constantes.
   2. Accès temporaire : le QR de 5 minutes à présenter au professionnel. Il n'apparaît qu'une fois la pré-consultation enregistrée,
      car le professionnel qui scanne ce QR vient lire cette pré-consultation. */
export function PatientConsultationFlow() {
  const [hasDraft, setHasDraft] = useState(false);
  // Mode invité : le médecin n'a pas son téléphone et écrit la consultation sur celui du patient (voir PatientGuestProfessional).
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestRefresh, setGuestRefresh] = useState(0);
  return (
    <div className="stack-lg">
      <PatientProfileChoice />
      <section className="stack" aria-labelledby="flow-step1">
        <div className="flow-step-head">
          <span className="eyebrow">Étape 1</span>
          <button type="button" className="button small" aria-expanded={guestOpen} onClick={() => setGuestOpen((open) => !open)}><Icon name="idcard" size={16} /> Mode invité</button>
        </div>
        <h2 id="flow-step1" data-tour="howto-preconsult">Pré-consultation</h2>
        {guestOpen && <PatientGuestProfessional onClose={() => setGuestOpen(false)} onSaved={() => setGuestRefresh((count) => count + 1)} />}
        <Fragment key={guestRefresh}><PatientPreconsultations onDraftChange={setHasDraft} /></Fragment>
      </section>
      <section className="stack" aria-labelledby="flow-step2">
        <span className="eyebrow">Étape 2</span>
        <h2 id="flow-step2" data-tour="howto-qr">Accès temporaire pour le professionnel</h2>
        {hasDraft
          ? <PatientAccessGrants part="qr" />
          : <p className="card muted flow-locked" role="note"><Icon name="lock" size={18} /> Disponible dès que votre pré-consultation est enregistrée : le professionnel scanne ce QR pour la lire, avec votre accord.</p>}
      </section>
      <PatientGuestConsultations refreshKey={guestRefresh} />
    </div>
  );
}
