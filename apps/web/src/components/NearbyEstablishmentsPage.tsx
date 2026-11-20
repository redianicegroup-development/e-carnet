import Link from "next/link";
import { NearbyEstablishments } from "./NearbyEstablishments";
import { PageHeader } from "./ui/PageHeader";

/* « Établissements proches de moi » : une PAGE à part entière (et non plus un modal des paramètres), pour la carte, la recherche et la liste.
   Même contenu pour le patient, le professionnel et l'établissement ; seul le lien de retour change. La position de la personne n'est jamais
   envoyée ni enregistrée (voir NearbyEstablishments). */
export function NearbyEstablishmentsPage({ backHref }: { backHref: string }) {
  return (
    <div className="stack-lg">
      <div><Link className="button small" href={backHref}>← Paramètres</Link></div>
      <PageHeader eyebrow="Partenaires Mon E‑Carnet" title="Établissements proches de moi" lead="Hôpitaux, cliniques et centres de santé partenaires, sur la carte et dans la liste. Votre position n’est ni envoyée ni enregistrée." />
      <NearbyEstablishments />
    </div>
  );
}
