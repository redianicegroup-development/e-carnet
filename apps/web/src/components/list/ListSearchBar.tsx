"use client";

import { useEffect, useId, useRef } from "react";
import { PERIOD_CHOICES, isPeriod, isSearchShortcut, resultsAnnouncement, type ListFilterState } from "../../lib/list-filter";
import "./list-search.css";

/* PRO-16 — Barre de recherche et filtres d'une liste DÉJÀ chargée (consultations, rendez-vous, adressages, patients récents).
   Elle ne lance aucun appel réseau : filtrer ne fait jamais apparaître un patient absent de la liste.
   Raccourci « / » sur grand écran (un seul champ par page l'active), Échap vide la recherche, le nombre de résultats est annoncé. */

type Choice = { value: string; label: string };

type Props = {
  label: string;
  placeholder: string;
  state: ListFilterState;
  onChange: (change: Partial<ListFilterState>) => void;
  onReset: () => void;
  shown: number;
  total: number;
  filtered: boolean;
  statusLabel?: string;
  statusOptions?: ReadonlyArray<Choice>;
  facilityOptions?: ReadonlyArray<string>;
  showPeriod?: boolean;
  /** Active le raccourci clavier « / » : à réserver à la liste principale de la page. */
  shortcut?: boolean;
};

export function ListSearchBar({ label, placeholder, state, onChange, onReset, shown, total, filtered, statusLabel = "État", statusOptions, facilityOptions, showPeriod = false, shortcut = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();

  useEffect(() => {
    if (!shortcut) return undefined;
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editing = Boolean(target?.isContentEditable) || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "");
      if (isSearchShortcut(event, editing, window.matchMedia("(min-width: 920px)").matches)) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === inputRef.current) {
        onChange({ query: "" });
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut, onChange]);

  const hasFilters = Boolean(statusOptions?.length || facilityOptions?.length || showPeriod);

  return <div className="list-search">
    <div className="list-search__row">
      <label className="professional-quick-search">
        <span className="sr-only">{label}</span>
        <input ref={inputRef} type="search" value={state.query} onChange={(event) => onChange({ query: event.target.value })} placeholder={placeholder} autoComplete="off" enterKeyHint="search" />
        {shortcut && <kbd aria-hidden="true">/</kbd>}
      </label>
      {filtered && <button type="button" className="button small" onClick={onReset}>Effacer les filtres</button>}
    </div>
    {hasFilters && <div className="list-search__filters" role="group" aria-label="Filtres">
      {statusOptions && statusOptions.length > 0 && <label><span>{statusLabel}</span><select value={state.status} onChange={(event) => onChange({ status: event.target.value })}><option value="">Tous</option>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
      {showPeriod && <label><span>Période</span><select value={state.period} onChange={(event) => onChange({ period: isPeriod(event.target.value) ? event.target.value : "all" })}>{PERIOD_CHOICES.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label>}
      {facilityOptions && facilityOptions.length > 1 && <label><span>Établissement</span><select value={state.facility} onChange={(event) => onChange({ facility: event.target.value })}><option value="">Tous</option>{facilityOptions.map((facility) => <option key={facility} value={facility}>{facility}</option>)}</select></label>}
    </div>}
    <p id={`${baseId}-count`} className="sr-only" role="status" aria-live="polite">{resultsAnnouncement(shown, total, filtered)}</p>
  </div>;
}
