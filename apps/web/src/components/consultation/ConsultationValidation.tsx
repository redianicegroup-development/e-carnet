"use client";

import { useId, useState } from "react";
import { carnetDate, consultationReference, type ConsultationRecord } from "../../lib/care-records";
import { sealImageUrl, type SealImageKind } from "../ConsultationSealPanel";

const FULL_DATE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

/** Longueur maximale du nom sur le pourtour du cachet : au-delà, il est tronqué plutôt que de déborder du cercle. */
const SEAL_NAME_MAX = 34;

/** Cachet électronique de l'établissement : cercle à double filet, nom en haut, ville en bas, « VALIDÉ » + date au centre.
    Dessiné à partir des données de la consultation (rien à téléverser) ; il se lit comme le cachet rond du carnet papier.
    L'encre est le bleu « mesuré » de la charte, fixe : le cachet ne change pas de couleur avec le thème choisi par la personne. */
export function EstablishmentSeal({ name, city, validatedAt, size = 104, className = "" }: { name: string; city?: string; validatedAt: string; size?: number; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const label = (name || "Établissement").trim().toUpperCase();
  const top = label.length > SEAL_NAME_MAX ? `${label.slice(0, SEAL_NAME_MAX - 1).trimEnd()}…` : label;
  const topSize = Math.max(5.2, Math.min(9, 170 / top.length));
  const bottom = (city || "").trim().toUpperCase() || "MON E‑CARNET";
  const bottomSize = Math.max(5.2, Math.min(8, 120 / bottom.length));
  return (
    <svg className={`consult-valid__seal${className ? ` ${className}` : ""}`} width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={`Cachet électronique de ${name || "l’établissement"}, validé le ${carnetDate(validatedAt)}`}>
      <defs>
        <path id={`${uid}-top`} d="M 20,60 A 40,40 0 0 1 100,60" />
        <path id={`${uid}-bottom`} d="M 10,60 A 50,50 0 0 0 110,60" />
      </defs>
      <g fill="none" stroke="currentColor">
        <circle cx="60" cy="60" r="57" strokeWidth="2.4" />
        <circle cx="60" cy="60" r="52" strokeWidth=".9" />
        <circle cx="60" cy="60" r="37" strokeWidth="1.2" />
      </g>
      <g fill="currentColor" fontWeight="800" textAnchor="middle" letterSpacing=".6">
        <text fontSize={topSize}><textPath href={`#${uid}-top`} startOffset="50%">{top}</textPath></text>
        <text fontSize={bottomSize}><textPath href={`#${uid}-bottom`} startOffset="50%">{bottom}</textPath></text>
        <text x="60" y="58" fontSize="11.5" letterSpacing="1">VALIDÉ</text>
        <text x="60" y="72" fontSize="9" fontWeight="700" letterSpacing=".4">{carnetDate(validatedAt)}</text>
      </g>
      <path d="M52 41l5 5 11-12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="21" cy="60" r="1.6" fill="currentColor" />
      <circle cx="99" cy="60" r="1.6" fill="currentColor" />
    </svg>
  );
}

function SealPhoto({ id, kind, label }: { id: string; kind: SealImageKind; label: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="consult-valid__missing">Image indisponible</span>;
  // eslint-disable-next-line @next/next/no-img-element -- image privée servie par l'API, avec cookie de session
  return <img src={sealImageUrl(id, kind)} alt={label} loading="lazy" onError={() => setFailed(true)} />;
}

type Props = {
  item: ConsultationRecord;
  /** Les images de signature et de cachet ne sont servies qu'au patient et au professionnel signataire. */
  images?: boolean;
};

/* Bas de page du carnet : la ligne de signature. Comme sur le carnet papier, le médecin appose son cachet et sa signature, et
   l'établissement son cachet rond. Deux emplacements, chacun sur sa ligne avec sa légende :
   — cachet de l'établissement : toujours présent (cachet électronique généré, il porte la date de validation) ;
   — cachet et signature du médecin : les images figées à la validation, l'une sous l'autre sur un téléphone, côte à côte sur un grand écran ;
     à défaut, ses titre, spécialité et n° d'ordre en texte.
   Une consultation signée avant l'ajout des images n'a ni cachet ni signature : le bloc l'écrit en toutes lettres, il ne reste jamais vide.
   Dans l'espace établissement les images ne sont pas servies (sealImages=false) : un repère « apposé » les remplace. */
export function ConsultationValidation({ item, images = true }: Props) {
  const date = new Date(item.validated_at);
  const hasMarks = Boolean(item.has_stamp || item.has_signature);
  // Dans l'espace établissement (images=false) les scans ne sont pas servis : le cachet électronique reste affiché.
  const showEstablishmentStamp = images && Boolean(item.has_establishment_stamp);
  const signatory = item.signatory;
  const identity = [signatory?.title, signatory?.specialty].filter(Boolean).join(" · ");
  const establishmentName = item.establishment?.name || item.facility_label;

  return (
    <footer className="consult-valid" aria-label="Validation de la consultation">
      <p className="consult-valid__text">
        Validée et signée électroniquement dans Mon E‑Carnet par <strong>{item.professional_name}</strong>, le <time dateTime={item.validated_at}>{FULL_DATE.format(date)}</time>
        {" · "}réf. <code>{consultationReference(item.id)}</code>.
      </p>
      <div className="consult-valid__slots">
        {/* Cachet de l'établissement : le scan déposé dans « Informations administratives » (figé à la validation) ; à défaut, le cachet électronique. */}
        {showEstablishmentStamp ? (
          <figure className="consult-valid__slot consult-valid__slot--pro">
            <div className="consult-valid__marks">
              <div className="consult-valid__mark consult-valid__mark--stamp"><SealPhoto id={item.id} kind="establishment-stamp" label={`Cachet de ${establishmentName}`} /></div>
            </div>
            <figcaption>Cachet de l’établissement</figcaption>
          </figure>
        ) : (
          <figure className="consult-valid__slot consult-valid__slot--seal">
            <div className="consult-valid__mark consult-valid__mark--seal"><EstablishmentSeal name={establishmentName} city={item.establishment?.city} validatedAt={item.validated_at} /></div>
            <figcaption>Cachet de l’établissement</figcaption>
          </figure>
        )}
        {images && item.has_establishment_signature && (
          <figure className="consult-valid__slot consult-valid__slot--pro">
            <div className="consult-valid__marks">
              <div className="consult-valid__mark consult-valid__mark--signature"><SealPhoto id={item.id} kind="establishment-signature" label={`Signature de ${establishmentName}`} /></div>
            </div>
            <figcaption>Signature de l’établissement</figcaption>
          </figure>
        )}

        {hasMarks ? (
          <figure className="consult-valid__slot consult-valid__slot--pro">
            <div className="consult-valid__marks">
              {item.has_stamp && (
                <div className="consult-valid__mark consult-valid__mark--stamp">
                  {images ? <SealPhoto id={item.id} kind="stamp" label={`Cachet de ${item.professional_name}`} /> : <span className="consult-valid__flag">Cachet apposé</span>}
                </div>
              )}
              {item.has_signature && (
                <div className="consult-valid__mark consult-valid__mark--signature">
                  {images ? <SealPhoto id={item.id} kind="signature" label={`Signature de ${item.professional_name}`} /> : <span className="consult-valid__flag">Signature apposée</span>}
                </div>
              )}
            </div>
            <figcaption>{item.has_stamp && item.has_signature ? "Cachet et signature du médecin" : item.has_stamp ? "Cachet du médecin" : "Signature du médecin"}</figcaption>
          </figure>
        ) : (
          <figure className="consult-valid__slot consult-valid__slot--pro">
            <div className="consult-valid__marks">
              <div className="consult-valid__mark consult-valid__mark--identity">
                <strong>{item.professional_name}</strong>
                {identity && <span>{identity}</span>}
                {signatory?.order_number && <span>N° d’ordre : {signatory.order_number}</span>}
              </div>
            </div>
            <figcaption>Signataire</figcaption>
          </figure>
        )}
      </div>
    </footer>
  );
}
