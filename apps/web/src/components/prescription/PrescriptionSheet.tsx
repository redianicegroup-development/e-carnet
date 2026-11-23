"use client";

import type { PrescriptionSheetData } from "../../lib/care-records";
import { EstablishmentSeal } from "../consultation/ConsultationValidation";
import "./prescription-sheet.css";

export type SheetFormat = "a5" | "a4";

const LONG_DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const SIGNED_AT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

/** Initiales du monogramme affiché quand l'établissement n'a pas (encore) de logo : deux premiers mots utiles du nom. */
export function monogram(name: string): string {
  const words = name.replace(/[’']/g, " ").split(/\s+/).filter((word) => word.length > 2 || /^[A-Z]/.test(word)).filter((word) => !/^(de|du|des|la|le|les|et)$/i.test(word));
  return (words.slice(0, 2).map((word) => word[0]).join("") || name.slice(0, 2)).toUpperCase();
}

type Props = {
  data: PrescriptionSheetData;
  /** A5 (défaut, le format des carnets d'ordonnances) ou A4 : même mise en page, plus de place pour les lignes. */
  format?: SheetFormat;
  /** Images servies par l'API : signature et cachet du professionnel, cachet et signature de l'établissement. Absentes : l'emplacement reste vide
      (ligne de signature comprise) ; sans scan du cachet de l'établissement, un cachet électronique est dessiné à sa place. */
  stampSrc?: string | null;
  signatureSrc?: string | null;
  establishmentStampSrc?: string | null;
  establishmentSignatureSrc?: string | null;
  /** Aperçu dans les réglages de l'établissement : exemple de contenu, bandeau « Aperçu » hors impression. */
  sample?: boolean;
};

/* Ordonnance de l'établissement, prête à lire et à imprimer — le modèle simple d'une ordonnance papier :
   logo en haut à gauche, en-tête au centre, coordonnées de la structure à droite ; nom du patient ; « ORDONNANCE MÉDICALE » encadré ; les médicaments ;
   en bas, la signature du professionnel et le cachet de l'établissement, puis le pied de page.
   Tout ce qui décrit la structure (logo, nom, type, adresse, téléphone, e-mail, cachet, signature) vient de sa fiche ; le modèle ne fournit que
   l'en-tête et le pied de page. Le médecin reste seul responsable du contenu et de la validation de chaque ligne.
   Toute la feuille est dimensionnée en « em » à partir de sa largeur (unités de conteneur) : elle garde ses proportions de feuille A5 ou A4
   sur un téléphone comme à l'impression, sans calcul en JavaScript. Les couleurs sont fixes : un document ne change pas avec le thème. */
export function PrescriptionSheet({ data, format = "a5", stampSrc = null, signatureSrc = null, establishmentStampSrc = null, establishmentSignatureSrc = null, sample = false }: Props) {
  const { establishment: place, prescriber, patient } = data;
  const issued = new Date(`${data.issued_on}T12:00:00`);
  const identity = [prescriber.title, prescriber.specialty].filter(Boolean).join(" · ");
  const hasContact = Boolean(place.address || place.phone || place.email);
  const professionalMarks = [signatureSrc && { src: signatureSrc, alt: `Signature de ${prescriber.name}` }, stampSrc && { src: stampSrc, alt: `Cachet de ${prescriber.name}` }].filter(Boolean) as Array<{ src: string; alt: string }>;

  return (
    <div className="rx-wrap" data-format={format}>
      <article className="rx-sheet" aria-label={`Ordonnance du ${LONG_DATE.format(issued)}`}>
        {sample && <p className="rx-sheet__sample">Aperçu · exemple de contenu</p>}

        <header className="rx-sheet__letterhead" data-contact={hasContact || undefined}>
          {place.logo_url
            // eslint-disable-next-line @next/next/no-img-element -- logo de l'établissement (fiche de la structure : URL enregistrée par le serveur)
            ? <img className="rx-sheet__logo" src={place.logo_url} alt="" />
            : <span className="rx-sheet__monogram" aria-hidden="true">{monogram(place.name)}</span>}
          <div className="rx-sheet__identity">
            <h2>{place.name}</h2>
            {place.type && <p className="rx-sheet__type">{place.type}</p>}
            {place.header_text && <p className="rx-sheet__tagline">{place.header_text}</p>}
          </div>
          {hasContact && (
            <address className="rx-sheet__contact">
              {place.address && <span>{place.address}</span>}
              {place.phone && <span>Tél : {place.phone}</span>}
              {place.email && <span>{place.email}</span>}
            </address>
          )}
        </header>
        <div className="rx-sheet__rule" aria-hidden="true" />

        <p className="rx-sheet__date">{place.city ? `${place.city}, le ` : "Le "}<time dateTime={data.issued_on}>{LONG_DATE.format(issued)}</time></p>
        <p className="rx-sheet__patient"><span>Nom du patient :</span> <strong>{patient.name}</strong></p>

        <h3 className="rx-sheet__title">Ordonnance médicale</h3>
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

        <footer className="rx-sheet__signoff">
          <p className="rx-sheet__signed">
            Signée électroniquement dans Mon E‑Carnet par {prescriber.name}
            {data.signed_at ? ` le ${SIGNED_AT.format(new Date(data.signed_at))}` : ""} · réf. {data.reference}
          </p>
          <div className="rx-sheet__slots">
            <figure className="rx-sheet__slot">
              <div className="rx-sheet__mark">
                {professionalMarks.map((mark) => (
                  // eslint-disable-next-line @next/next/no-img-element -- image privée servie par l'API, avec cookie de session
                  <img key={mark.src} src={mark.src} alt={mark.alt} />
                ))}
              </div>
              <figcaption>Signature du professionnel</figcaption>
              <p className="rx-sheet__who"><b>{prescriber.name}</b>{identity && <span>{identity}</span>}{prescriber.order_number && <span>N° d’ordre : {prescriber.order_number}</span>}</p>
            </figure>
            <figure className="rx-sheet__slot">
              <div className="rx-sheet__mark">
                {establishmentStampSrc
                  // eslint-disable-next-line @next/next/no-img-element -- image privée servie par l'API, avec cookie de session
                  ? <img src={establishmentStampSrc} alt={`Cachet de ${place.name}`} />
                  : <EstablishmentSeal className="rx-sheet__seal" name={place.name} city={place.city} validatedAt={data.signed_at ?? `${data.issued_on}T12:00:00`} size={88} />}
                {establishmentSignatureSrc
                  // eslint-disable-next-line @next/next/no-img-element -- image privée servie par l'API, avec cookie de session
                  ? <img src={establishmentSignatureSrc} alt={`Signature de ${place.name}`} />
                  : null}
              </div>
              <figcaption>{establishmentSignatureSrc ? "Cachet et signature de l’établissement" : "Cachet de l’établissement"}</figcaption>
            </figure>
          </div>
        </footer>

        {place.footer_text && <p className="rx-sheet__foot">{place.footer_text}</p>}
        <p className="rx-sheet__origin">Document généré depuis <span className="notranslate" translate="no">Mon E‑Carnet</span> — contenu saisi et signé par le prescripteur.</p>
      </article>
    </div>
  );
}
