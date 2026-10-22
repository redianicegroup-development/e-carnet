"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet } from "../infrastructure/api/client";
import { useSealImage } from "./useSealImage";
import "./ink-capture.css";

type Credentials = { stamp_uploaded: boolean; signature_uploaded: boolean };

/** Rappel, juste avant de signer une consultation : ce qui sera apposé sur l'ordonnance (cachet, signature), ou comment l'ajouter. */
export function ConsultationSeal() {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  useEffect(() => {
    let active = true;
    apiGet<Credentials>("/api/v1/professionals/credentials/").then((loaded) => { if (active) setCredentials(loaded); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  const stamp = useSealImage("stamp", Boolean(credentials?.stamp_uploaded));
  const signature = useSealImage("signature", Boolean(credentials?.signature_uploaded));
  if (!credentials) return null;
  const any = credentials.stamp_uploaded || credentials.signature_uploaded;
  return <div className="seal-recap" aria-label="Cachet et signature de l’ordonnance">
    {any && <div className="seal-recap__items">
      {credentials.stamp_uploaded && <div className="seal-preview">{stamp ? <img src={stamp} alt="Votre cachet" /> : <span>Cachet…</span>}</div>}
      {credentials.signature_uploaded && <div className="seal-preview">{signature ? <img src={signature} alt="Votre signature" /> : <span>Signature…</span>}</div>}
    </div>}
    <p>{any
      ? "Ce cachet et cette signature seront ajoutés à l’ordonnance, avec la mention « Signé électroniquement dans Mon E‑Carnet »."
      : <>La signature électronique Mon E‑Carnet sera ajoutée à l’ordonnance. Vous pouvez aussi y faire figurer votre cachet et votre signature : <Link className="text-link" href="/professionnel/parametres">les ajouter dans mes paramètres</Link>.</>}
    </p>
  </div>;
}
