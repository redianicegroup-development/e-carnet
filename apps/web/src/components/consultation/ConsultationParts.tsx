"use client";

import { useState, type ReactNode } from "react";
import { isListed, numberOptions } from "../../lib/preconsult";
import { OTHER_VALUE } from "../../lib/consultation-options";
import { VITAL_FIELDS, type VitalKey, type VitalsForm } from "../../lib/vitals";
import "../preconsult-form.css";
import { Pictogram } from "../ui/Pictogram";
import { pictogramFor, type PictogramName } from "../../lib/pictograms";

/* Briques communes de la consultation du médecin : mêmes classes, mêmes gestes que la pré-consultation du patient
   (sections numérotées, puces à cocher, listes pour les constantes). Le médecin sélectionne ; « Autre » reste possible. */

export function FormSection({ num, title, hint, children }: { num: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="preconsult-section">
      <legend><span className="preconsult-section__num">{num}</span>{title}</legend>
      {hint && <p className="muted preconsult-section__hint">{hint}</p>}
      {children}
    </fieldset>
  );
}

/** Puces à cocher (comme les symptômes du patient) + texte libre « Autre ». */
export function ChipPicker({ label, options, selected, other, onSelected, onOther, otherLabel, otherPlaceholder, maxOther = 1500, rows = 2, pictograms }: {
  /** Pictogramme facultatif par option (PAT-20) : il accompagne le texte, il ne le remplace jamais. */
  pictograms?: Readonly<Record<string, PictogramName>>;
  label: string; options: readonly string[]; selected: string[]; other: string;
  onSelected: (next: string[]) => void; onOther: (next: string) => void; otherLabel: string; otherPlaceholder?: string; maxOther?: number; rows?: number;
}) {
  const toggle = (item: string) => onSelected(selected.includes(item) ? selected.filter((value) => value !== item) : [...selected, item]);
  return (
    <>
      <div className="symptom-grid" role="group" aria-label={label}>
        {options.map((item) => (
          <label key={item} className={`symptom-chip${selected.includes(item) ? " is-on" : ""}`}>
            <input type="checkbox" checked={selected.includes(item)} onChange={() => toggle(item)} />{pictograms && pictogramFor(pictograms, item) ? <Pictogram name={pictogramFor(pictograms, item) as PictogramName} size={18} decorative /> : null}<span>{item}</span>
          </label>
        ))}
      </div>
      <label className="field"><span>{otherLabel}</span><textarea maxLength={maxOther} rows={rows} value={other} onChange={(event) => onOther(event.target.value)} placeholder={otherPlaceholder} /></label>
    </>
  );
}

/** Constantes : exactement la grille du patient (listes pour poids, taille, température ; saisie pour le reste). */
export function VitalsPicker({ value, onChange }: { value: VitalsForm; onChange: (next: VitalsForm) => void }) {
  const set = (key: VitalKey, next: string) => onChange({ ...value, [key]: next });
  return (
    <div className="vitals-grid" role="group" aria-label="Constantes relevées">
      {VITAL_FIELDS.map((field) => (
        <label className="field" key={field.key}>
          <span>{field.label}{field.unit ? ` (${field.unit})` : ""}</span>
          {isListed(field.key)
            ? <select value={value[field.key]} onChange={(event) => set(field.key, event.target.value)}><option value="">—</option>{numberOptions(field.key, value[field.key]).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            : <input type={field.freeText ? "text" : "number"} inputMode={field.freeText ? "text" : "decimal"} autoComplete="off" maxLength={field.freeText ? 24 : undefined} step={field.freeText ? undefined : field.step} min={field.freeText ? undefined : field.min} max={field.freeText ? undefined : field.max} value={value[field.key]} onChange={(event) => set(field.key, event.target.value)} placeholder={field.placeholder} />}
        </label>
      ))}
      <p className="muted vitals-grid__hint">Tension et glycémie : saisissez la valeur comme elle apparaît sur le carnet, avec son unité si elle est indiquée.</p>
    </div>
  );
}

/** Liste déroulante avec une sortie « Autre (préciser) » : le médecin choisit, et n'écrit que ce qui n'est pas dans la liste. */
export function PickOrOther({ label, value, options, groups, onChange, maxLength = 160, emptyLabel = "Choisir…", otherLabel = "Autre (préciser)", wide = false }: {
  label: string; value: string; options?: readonly string[]; groups?: { group: string; items: string[] }[]; onChange: (next: string) => void;
  maxLength?: number; emptyLabel?: string; otherLabel?: string; wide?: boolean;
}) {
  const flat = groups ? groups.flatMap((entry) => entry.items) : options ?? [];
  const [forcedOther, setForcedOther] = useState(false);
  const isOther = forcedOther || (value !== "" && !flat.includes(value));
  return (
    <div className={`pick-or-other${wide ? " order-line__wide" : ""}`}>
      <label className="field">
        <span>{label}</span>
        <select value={isOther ? OTHER_VALUE : value} onChange={(event) => {
          const next = event.target.value;
          if (next === OTHER_VALUE) { setForcedOther(true); onChange(""); } else { setForcedOther(false); onChange(next); }
        }}>
          <option value="">{emptyLabel}</option>
          {groups
            ? groups.map((entry) => <optgroup key={entry.group} label={entry.group}>{entry.items.map((item) => <option key={item} value={item}>{item}</option>)}</optgroup>)
            : flat.map((item) => <option key={item} value={item}>{item}</option>)}
          <option value={OTHER_VALUE}>{otherLabel}</option>
        </select>
      </label>
      {isOther && <label className="field"><span className="sr-only">{label} : précision</span><input maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Précisez" autoFocus={forcedOther && value === ""} /></label>}
    </div>
  );
}
