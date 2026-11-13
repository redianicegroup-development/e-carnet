"use client";

import { useCallback, useState } from "react";
import { EMPTY_FILTERS, hasActiveFilter, type ListFilterState } from "../../lib/list-filter";

/** État de recherche et de filtres d'une liste. Rien n'est conservé : la recherche repart à zéro à chaque visite (aucune donnée de patient dans le navigateur). */
export function useListFilter(initial: ListFilterState = EMPTY_FILTERS) {
  const [state, setState] = useState<ListFilterState>(initial);
  const patch = useCallback((change: Partial<ListFilterState>) => setState((current) => ({ ...current, ...change })), []);
  const reset = useCallback(() => setState(EMPTY_FILTERS), []);
  return { state, patch, reset, filtered: hasActiveFilter(state) };
}
