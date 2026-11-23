"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiGet } from "../../infrastructure/api/client";
import type { PrescriptionSheetData } from "../../lib/care-records";
import { sealImageUrl } from "../ConsultationSealPanel";
import { Icon } from "../ui/Icon";
import { PrescriptionSheet, type SheetFormat } from "./PrescriptionSheet";
import "./prescription-sheet.css";

type State = { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: PrescriptionSheetData };

const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/* « Voir l'ordonnance » : l'ordonnance mise en page s'ouvre par-dessus le carnet (plein écran sur téléphone), avec Imprimer et PDF.
   Le contenu est demandé au serveur à l'ouverture (il compose l'en-tête de l'établissement, le prescripteur, le patient et les lignes) ;
   il est gardé tant que la page reste ouverte. Échap ferme, le focus est rendu au bouton, la tabulation reste dans la fenêtre.
   À l'impression, tout le reste de la page est masqué : seule la feuille sort, au format choisi. */
export function PrescriptionViewer({ sheetHref, pdfHref = null }: { sheetHref: string; pdfHref?: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: "idle" });
  const [format, setFormat] = useState<SheetFormat>("a5");
  const opener = useRef<HTMLButtonElement>(null);
  const viewer = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setState({ status: "loading" });
    apiGet<PrescriptionSheetData>(sheetHref)
      .then((data) => setState({ status: "ready", data }))
      .catch((error) => setState({ status: "error", message: error instanceof Error ? error.message : "Ordonnance indisponible." }));
  }, [sheetHref]);

  const close = useCallback(() => {
    setOpen(false);
    opener.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    viewer.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab" || !viewer.current) return;
      const items = Array.from(viewer.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKey); };
  }, [open, close]);

  function show() {
    setOpen(true);
    if (state.status === "idle" || state.status === "error") load();
  }

  const overlay = open ? createPortal(
    <div className="rx-viewer" role="dialog" aria-modal="true" aria-label="Ordonnance" ref={viewer}>
      <div className="rx-viewer__bar">
        <button type="button" className="button small" onClick={close} data-autofocus><Icon name="back" size={16} /> Fermer</button>
        <div className="rx-viewer__tools">
          <div className="rx-viewer__formats" role="group" aria-label="Format d’impression">
            {(["a5", "a4"] as const).map((value) => <button key={value} type="button" className={`rx-viewer__format${format === value ? " is-on" : ""}`} aria-pressed={format === value} onClick={() => setFormat(value)}>{value.toUpperCase()}</button>)}
          </div>
          <button type="button" className="button small primary" onClick={() => window.print()} disabled={state.status !== "ready"}>Imprimer</button>
          {pdfHref && <a className="button small" href={pdfHref} target="_blank" rel="noreferrer"><Icon name="download" size={16} /> PDF</a>}
        </div>
      </div>
      <div className="rx-viewer__body">
        {state.status === "loading" && <p className="rx-viewer__status" role="status">Chargement de l’ordonnance…</p>}
        {state.status === "error" && (
          <div className="rx-viewer__status" role="alert">
            <p>{state.message}</p>
            <button type="button" className="button small" onClick={load}>Réessayer</button>
          </div>
        )}
        {state.status === "ready" && (
          <div className="rx-print" data-format={format}>
            <PrescriptionSheet
              data={state.data}
              format={format}
              stampSrc={state.data.has_stamp ? sealImageUrl(state.data.consultation_id, "stamp") : null}
              signatureSrc={state.data.has_signature ? sealImageUrl(state.data.consultation_id, "signature") : null}
              establishmentStampSrc={state.data.has_establishment_stamp ? sealImageUrl(state.data.consultation_id, "establishment-stamp") : null}
              establishmentSignatureSrc={state.data.has_establishment_signature ? sealImageUrl(state.data.consultation_id, "establishment-signature") : null}
            />
          </div>
        )}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button type="button" className="button small" ref={opener} aria-haspopup="dialog" aria-expanded={open} onClick={show}><Icon name="document" size={16} /> Voir l’ordonnance</button>
      {overlay}
    </>
  );
}
