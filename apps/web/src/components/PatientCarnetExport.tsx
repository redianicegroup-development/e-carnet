"use client";

import { useState } from "react";
import { ALL_SECTION_KEYS, EXPORT_SECTIONS, buildExportUrl, describeExportPeriod, describeExportSections, periodProblem, type ExportSectionKey } from "../lib/carnet-export";
import "./carnet-export.css";

/* Export du carnet (PAT-09) : on choisit la période et les rubriques, on lit l'avertissement, puis on télécharge en PDF ou en Excel.
   Les deux formats reçoivent les MÊMES paramètres (période, rubriques) et le serveur les filtre de la même façon.
   Le fichier est généré par le serveur, journalisé (format, période, rubriques — jamais le contenu), et n'est jamais mis en cache. */
const isoToday = () => new Date().toISOString().slice(0, 10);

export function PatientCarnetExport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sections, setSections] = useState<ExportSectionKey[]>([...ALL_SECTION_KEYS]);
  const [understood, setUnderstood] = useState(false);
  const problem = periodProblem(from, to);
  const noSection = sections.length === 0;
  const pdfUrl = buildExportUrl({ format: "pdf", from, to, sections });
  const xlsxUrl = buildExportUrl({ format: "xlsx", from, to, sections });
  const ready = understood && Boolean(pdfUrl) && Boolean(xlsxUrl);
  const allChecked = sections.length === ALL_SECTION_KEYS.length;

  function toggle(key: ExportSectionKey) {
    setSections((current) => ALL_SECTION_KEYS.filter((candidate) => (candidate === key ? !current.includes(candidate) : current.includes(candidate))));
  }

  return (
    <section className="card carnet-export" aria-labelledby="carnet-export-title">
      <div className="section-heading"><div><span className="eyebrow">Portabilité</span><h3 id="carnet-export-title">Exporter mon carnet</h3></div></div>
      <p className="muted">Choisissez la période et les rubriques à exporter, ou laissez tout tel quel pour exporter l’ensemble du carnet. Le PDF se lit et s’imprime ; le fichier Excel permet de trier et de calculer.</p>
      <div className="grid two">
        <label className="field"><span>Du</span><input type="date" value={from} max={to || isoToday()} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="field"><span>Au</span><input type="date" value={to} min={from || undefined} max={isoToday()} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      {problem ? <p className="notice notice--error" role="alert">{problem}</p> : null}
      <fieldset className="carnet-export__sections">
        <legend>Rubriques à exporter</legend>
        <label className="check carnet-export__all"><input type="checkbox" checked={allChecked} onChange={() => setSections(allChecked ? [] : [...ALL_SECTION_KEYS])} /> Tout sélectionner</label>
        <div className="carnet-export__grid">
          {EXPORT_SECTIONS.map((section) => <label className="check carnet-export__option" key={section.key}><input type="checkbox" checked={sections.includes(section.key)} onChange={() => toggle(section.key)} /><span><strong>{section.label}</strong><small className="muted">{section.hint}</small></span></label>)}
        </div>
      </fieldset>
      {noSection ? <p className="notice notice--error" role="alert">Cochez au moins une rubrique.</p> : null}
      <p className="muted carnet-export__summary" role="status">À exporter : {describeExportPeriod(from, to)} · {describeExportSections(sections)}.</p>
      <p className="notice" role="note">Ce fichier contient des informations de santé et n’est pas chiffré. Gardez-le en lieu sûr, ne l’envoyez que par un canal que vous maîtrisez et supprimez-le quand vous n’en avez plus besoin.</p>
      <label className="check"><input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} /> J’ai compris, je veux exporter mon carnet.</label>
      <div className="actions">
        <a className={`button primary${ready ? "" : " is-disabled"}`} href={ready ? (pdfUrl ?? undefined) : undefined} aria-disabled={!ready} role={ready ? undefined : "link"} onClick={(event) => { if (!ready) event.preventDefault(); }}>Télécharger en PDF</a>
        <a className={`button${ready ? "" : " is-disabled"}`} href={ready ? (xlsxUrl ?? undefined) : undefined} aria-disabled={!ready} role={ready ? undefined : "link"} onClick={(event) => { if (!ready) event.preventDefault(); }}>Télécharger en Excel</a>
      </div>
    </section>
  );
}
