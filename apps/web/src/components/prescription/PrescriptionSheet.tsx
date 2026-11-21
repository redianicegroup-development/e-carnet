"use client";

import type { PrescriptionSheetData } from "../../lib/care-records";
import { EstablishmentSeal } from "../consultation/ConsultationValidation";
import "./prescription-sheet.css";

export type SheetFormat = "a5" | "a4";

const LONG_DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const NEXT_DATE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });
const SEX_LABELS: Record<string, string> = { female: "Femme", male: "Homme" };

/** Initiales du monogramme affiché quand l'établissement n'a pas (encore) de logo : deux premiers mots utiles du nom. */
export function monogram(name: string): string {
  const words = name.replace(/[’']/g, " ").split(/\s+/).filter((word) => word.length > 2 || /^[A-Z]/.test(word)).filter((word) => !/^(de|du|des|la|le|les|et)$/i.test(word));
  return (words.slice(0, 2).map((word) => word[0]).join("") || name.slice(0, 2)).toUpperCase();
}

type Props = {
  data: PrescriptionSheetData;
  /** A5 (défaut, le format des carnets d'ordonnances) ou A4 : même mise en page, plus de place pour les lignes. */
  format?: SheetFormat;
  /** Images du cachet et de la signature du médecin (URL servies par l'API). Absentes : l'emplacement reste vide, ligne de signature comprise. */
  stampSrc?: string | null;
  signatureSrc?: string | null;
  /** Aperçu dans les réglages de l'établissement : exemple de contenu, bandeau « Aperçu » hors impression. */
  sample?: boolean;
};

/* Ordonnance de l'établissement, prête à lire et à imprimer. Les informations de l'établissement (logo, en-tête, adresse, téléphone,
   e-mail, pied de page) viennent de ses réglages ; le médecin reste seul responsable du contenu et de la validation de chaque ligne.
   Toute la feuille est dimensionnée en « em » à partir de sa largeur (unités de conteneur) : elle garde ses proportions de feuille A5 ou A4
   sur un téléphone comme à l'impression, sans calcul en JavaScript. Les couleurs sont fixes : un document ne change pas avec le thème. */
export function PrescriptionSheet({ data, format = "a5", stampSrc = null, signatureSrc = null, sample = false }: Props) {
  const { establishment: place, prescriber, patient } = data;
  const issued = new Date(`${data.issued_on}T12:00:00`);
  const identity = [prescriber.title, prescriber.specialty].filter(Boolean).join(" · ");
  const patientFacts: Array<[string, string]> = [];
  if (patient.age_years !== null) patientFacts.push(["Âge", `${patient.age_years} ${patient.age_years > 1 ? "ans" : "an"}`]);
  if (patient.sex && SEX_LABELS[patient.sex]) patientFacts.push(["Sexe", SEX_LABELS[patient.sex]]);
  if (patient.weight) patientFacts.push(["Poids", patient.weight]);
  const hasPhotos = Boolean(stampSrc || signatureSrc);

  return (
    <div className="rx-wrap" data-format={format}>
      <article className="rx-sheet" aria-label={`Ordonnance du ${LONG_DATE.format(issued)}`}>
        {sample && <p className="rx-sheet__sample">Aperçu · exemple de contenu</p>}

        <header className="rx-sheet__letterhead">
          <div className="rx-sheet__brand">
            {place.logo_url
              // eslint-disable-next-line @next/next/no-img-element -- logo de l'établissement (URL Cloudinary enregistrée dans ses réglages)
              ? <img className="rx-sheet__logo" src={place.logo_url} alt="" />
              : <span className="rx-sheet__monogram" aria-hidden="true">{monogram(place.name)}</span>}
            <div>
              <h2>{place.name}</h2>
              {place.type && <p className="rx-sheet__type">{place.type}</p>}
              {place.header_text && <p className="rx-sheet__tagline">{place.header_text}</p>}
            </div>
          </div>
          {(place.address || place.phone || place.email) && (
            <address className="rx-sheet__contact">
              {place.address && <span>{place.address}</span>}
              {place.phone && <span>Tél : {place.phone}</span>}
              {place.email && <span>{place.email}</span>}
            </address>
          )}
        </header>
        <div className="rx-sheet__rule" aria-hidden="true" />

        <section className="rx-sheet__meta" aria-label="Prescripteur et date">
          <div>
            <strong>{prescriber.name}</strong>
            {identity && <span>{identity}</span>}
            {prescriber.order_number && <span>N° d’ordre : {prescriber.order_number}</span>}
          </div>
          <div className="rx-sheet__meta-end">
            <span>{place.city ? `${place.city}, le ` : "Le "}<time dateTime={data.issued_on}>{LONG_DATE.format(issued)}</time></span>
            <span>Ordonnance n° <code>{data.reference}</code></span>
          </div>
        </section>

        <section className="rx-sheet__patient" aria-label="Patient">
          <p><span>Patient</span><strong>{patient.name}</strong></p>
          {patientFacts.length > 0 && <dl>{patientFacts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
        </section>

        <h3 className="rx-sheet__title">Ordonnance médicale</h3>
        <p className="rx-sheet__rp" aria-hidden="true">Rp/</p>
        <ol className="rx-sheet__lines">
          {data.lines.map((line, index) => (
            <li key={line.id}>
              <span className="rx-sheet__n" aria-hidden="true">{index + 1}</span>
              <div>
                <p className="rx-sheet__drug"><b>{line.drug_name}</b>{line.dosage && <span> · {line.dosage}</span>}</p>
                {(line.posology || line.duration) && <p className="rx-sheet__how">{[line.posology, line.duration].filter(Boolean).join(" — ")}</p>}
                {line.instructions && <p className="rx-sheet__note">{line.instructions}</p>}
              </div>
            </li>
          ))}
        </ol>

        {data.next_appointment && <p className="rx-sheet__next"><span>Prochain rendez-vous</span> {NEXT_DATE.format(new Date(data.next_appointment))}</p>}

        <footer className="rx-sheet__signoff">
          <p className="rx-sheet__signed">
            Signée électroniquement dans Mon E‑Carnet par {prescriber.name}
            {data.signed_at ? ` le ${NEXT_DATE.format(new Date(data.signed_at))}` : ""} · réf. {data.reference}
          </p>
          <div className="rx-sheet__slots">
            <figure>
              <div className="rx-sheet__mark"><EstablishmentSeal className="rx-sheet__seal" name={place.name} city={place.city} validatedAt={data.signed_at ?? `${data.issued_on}T12:00:00`} size={88} /></div>
              <figcaption>Cachet de l’établissement</figcaption>
            </figure>
            {stampSrc && (
              <figure>
                <div className="rx-sheet__mark">
                  {/* eslint-disable-next-line @next/next/no-img-element -- image privée servie par l'API, avec cookie de session */}
                  <img src={stampSrc} alt={`Cachet de ${prescriber.name}`} />
                </div>
                <figcaption>Cachet du médecin</figcaption>
              </figure>
            )}
            {signatureSrc && (
              <figure>
                <div className="rx-sheet__mark">
                  {/* eslint-disable-next-line @next/next/no-img-element -- image privée servie par l'API, avec cookie de session */}
                  <img src={signatureSrc} alt={`Signature de ${prescriber.name}`} />
                </div>
                <figcaption>Signature du médecin</figcaption>
              </figure>
            )}
            {!hasPhotos && (
              <figure>
                <div className="rx-sheet__mark" />
                <figcaption>Cachet et signature du médecin</figcaption>
              </figure>
            )}
          </div>
        </footer>

        {place.footer_text && <p className="rx-sheet__foot">{place.footer_text}</p>}
        <p className="rx-sheet__origin">Document généré depuis Mon E‑Carnet — contenu saisi et signé par le prescripteur.</p>
      </article>
    </div>
  );
}
