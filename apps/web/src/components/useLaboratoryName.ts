"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../infrastructure/api/client";

type Row = { name: string; is_laboratory?: boolean };

/** Nom du laboratoire du compte connecté (en-tête des écrans). Avant la réponse, ou sans réponse : « Laboratoire ». */
export function useLaboratoryName(): string {
  const [name, setName] = useState("Laboratoire");
  useEffect(() => {
    let active = true;
    apiGet<Row[]>("/api/v1/establishments/")
      .then((rows) => { const lab = rows.find((row) => row.is_laboratory) ?? rows[0]; if (active && lab?.name) setName(lab.name); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  return name;
}
