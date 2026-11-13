"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { isLabFeatureOff, listLabHistory, type LabHistory } from "../application/lab-results";
import { KIND_LABEL, LAB_STATUSES, STATUS_LABEL, STATUS_PLURAL, groupByDay, periodStart, timeLabel, whoLine } from "../lib/lab-history";
import { matchesQuery } from "../lib/list-filter";
import { ListSearchBar } from "./list/ListSearchBar";
import { useListFilter } from "./list/useListFilter";
import { PageHeader } from "./ui/PageHeader";
import { useLaboratoryName } from "./useLaboratoryName";
import "./lab-results.css";

/* PRO-21 — onglet « Dépôts » de l'espace laboratoire : l'activité du laboratoire, jamais le contenu des résultats.
   Chaque ligne dit l'examen, son type, son statut (déposé, remplacé par une version corrigée, abandonné par le médecin), les initiales et
   l'année de naissance du patient, l'heure. Le nom complet n'est jamais affiché. La période est filtrée par l'API (dates) ; le statut et la
   recherche filtrent les lignes déjà reçues. */

export function LaboratoryDeposits() {
  const name = useLaboratoryName();
  const { state: filter, patch, reset, filtered } = useListFilter();
  const [history, setHistory] = useState<LabHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [off, setOff] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    listLabHistory({ from: periodStart(filter.period) })
      .then((data) => { if (active) setHistory(data); })
      .catch((failure: unknown) => {
        if (!active) return;
        if (isLabFeatureOff(failure)) setOff(true);
        else setError(failure instanceof Error ? failure.message : "Historique indisponible.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filter.period]);

  const items = history?.items ?? [];
  const visible = useMemo(() => items.filter((item) => (!filter.status || item.status === filter.status)
    && matchesQuery([item.exam_label, item.original_name, item.patient_initials, KIND_LABEL[item.exam_kind], STATUS_LABEL[item.status]], filter.query)), [items, filter.status, filter.query]);
  const groups = useMemo(() => groupByDay(visible), [visible]);
  const statusOptions = LAB_STATUSES.map((status) => ({ value: status, label: `${STATUS_PLURAL[status]} (${history?.counts[status] ?? 0})` }));

  if (off) return <section className="notice" role="status"><strong>Espace laboratoire non activé.</strong> Cette fonction n’est pas encore ouverte pour votre structure.</section>;

  return <div className="stack-lg">
    <PageHeader eyebrow={name} title="Mes dépôts" lead="Les résultats que vous avez déposés, remplacés ou dont le médecin a renoncé. Le contenu des fichiers n’est jamais relu." />
    <section className="card stack" aria-labelledby="lab-deposits-title">
      <h2 id="lab-deposits-title" className="sr-only">Historique des dépôts</h2>
      <ListSearchBar
        label="Rechercher un examen ou un patient (initiales)" placeholder="Examen, type, initiales…" state={filter} onChange={patch} onReset={reset}
        shown={visible.length} total={items.length} filtered={filtered} statusLabel="Statut" statusOptions={statusOptions} showPeriod
      />
      {error && <p className="status" role="alert">{error}</p>}
      {loading && !history && <p className="muted" role="status">Chargement…</p>}
      {history && items.length === 0 && !loading && <div className="empty stack">
        <p>{filter.period === "all" ? "Aucun dépôt pour le moment." : "Aucun dépôt sur cette période."}</p>
        <div className="actions"><Link className="button small" href="/laboratoire">Scanner un QR d’examen</Link></div>
      </div>}
      {history && items.length > 0 && visible.length === 0 && <p className="empty">Aucun résultat pour cette recherche.</p>}
      {groups.map((group) => <div className="lab-day" key={group.day}>
        <h3 className="lab-day__title">{group.label}</h3>
        <ul className="lab-deposits">
          {group.items.map((item) => <li className="lab-deposit" key={`${item.status}-${item.id}`}>
            <div className="lab-deposit__head">
              <strong>{item.exam_label || item.original_name || "Examen"}</strong>
              <span className={`badge lab-status lab-status--${item.status}`}>{STATUS_LABEL[item.status]}</span>
            </div>
            <p className="muted lab-deposit__meta">{[KIND_LABEL[item.exam_kind], whoLine(item), timeLabel(item.occurred_at)].filter(Boolean).join(" · ")}</p>
            {item.status === "replaced" && <p className="muted">Une version corrigée a remplacé ce fichier ; l’ancien reste conservé.</p>}
            {item.status === "abandoned" && <p className="muted">Le médecin a renoncé à cet examen : aucun résultat n’est attendu.</p>}
          </li>)}
        </ul>
      </div>)}
      {history?.truncated && <p className="muted">Seules les lignes les plus récentes sont affichées : choisissez une période plus courte pour affiner.</p>}
      <p className="muted">Seuls l’examen, les initiales, l’année de naissance et la date sont affichés ici : le nom complet et le contenu des résultats ne sont jamais montrés.</p>
    </section>
  </div>;
}
