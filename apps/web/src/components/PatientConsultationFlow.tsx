"use client";

import { useState } from "react";
import { Icon } from "./ui/Icon";
import { PatientAccessGrants } from "./PatientAccessGrants";
import { PatientPreconsultations } from "./PatientPreconsultations";
import "./consultation-flow.css";

/* Consultations du patient, en deux étapes.
   1. Pré-consultation : le motif, les symptômes, les constantes.
   2. Accès temporaire : le QR de 5 minutes à présenter au professionnel. Il n'apparaît qu'une fois la pré-consultation enregistrée,
      car le professionnel qui scanne ce QR vient lire cette pré-consultation. */
export function PatientConsultationFlow() {
  const [hasDraft, setHasDraft] = useState(false);
  return (
    <div className="stack-lg">
      <section className="stack" aria-labelledby="flow-step1">
        <span className="eyebrow">Étape 1</span>
        <h2 id="flow-step1">Pré-consultation</h2>
        <PatientPreconsultations onDraftChange={setHasDraft} />
      </section>
      <section className="stack" aria-labelledby="flow-step2">
        <span className="eyebrow">Étape 2</span>
        <h2 id="flow-step2">Accès temporaire pour le professionnel</h2>
        {hasDraft
          ? <PatientAccessGrants part="qr" />
          : <p className="card muted flow-locked" role="note"><Icon name="lock" size={18} /> Disponible dès que votre pré-consultation est enregistrée : le professionnel scanne ce QR pour la lire, avec votre accord.</p>}
      </section>
    </div>
  );
}
