"use client";

import { useSyncExternalStore } from "react";
import { PageHeader } from "./ui/PageHeader";
import { CollapsibleSection } from "./ui/CollapsibleSection";
import { PatientAccessGrants } from "./PatientAccessGrants";
import { PatientConsultations } from "./PatientConsultations";
import { Vaccinations } from "./Vaccinations";
import { HealthMeasurements } from "./HealthMeasurements";

/* 4e onglet du patient : l'historique de tout. Les consultations validées, les vaccins, les mesures, et surtout qui a eu accès
   à ses données (avec les demandes qui attendent encore une réponse). Ajouter ou corriger se fait dans « Mon carnet ».
   `#acces` (notification, lien d'une ancienne page) ouvre directement la tuile des accès. */
const subscribeToHash = (onChange: () => void) => { window.addEventListener("hashchange", onChange); return () => window.removeEventListener("hashchange", onChange); };

export function PatientHistory() {
  // Le fragment de l'URL (#acces) est lu comme une source externe : rien n'est écrit dans l'état pendant le rendu, et le serveur voit toujours « fermé ».
  const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash, () => "");
  const openAccess = hash === "#acces";
  return (
    <div className="stack-lg">
      <PageHeader eyebrow="Historique" title="Tout ce qui s’est passé" lead="Vos consultations, vos vaccins, vos mesures et les accès donnés à vos données. Pour ajouter ou corriger, ouvrez Mon carnet." />
      <div className="section-grid" id="acces">
        <CollapsibleSection key={openAccess ? "acces-ouvert" : "acces-ferme"} title="Accès à mes données" solo icon="eye" hint="Qui, quand, combien de temps" initiallyOpen={openAccess}><PatientAccessGrants part="log" /></CollapsibleSection>
        <CollapsibleSection title="Mes consultations" icon="stethoscope" hint="Validées par un professionnel"><PatientConsultations /></CollapsibleSection>
        <CollapsibleSection title="Mes vaccins" solo icon="drop" hint="Déclarés et confirmés"><Vaccinations /></CollapsibleSection>
        <CollapsibleSection title="Mes mesures de santé" icon="chart" hint="Évolution dans le temps"><HealthMeasurements /></CollapsibleSection>
      </div>
    </div>
  );
}
