/* Listes de choix de la consultation du médecin (11/2026).
   Le médecin SÉLECTIONNE, comme le patient dans sa pré-consultation : cases à cocher pour les constats, listes déroulantes pour l'ordonnance
   et les examens, avec toujours une sortie « Autre » (texte libre) pour ce qui n'est pas dans la liste.
   Fichier pur (sans React), testable. Aucun nouveau champ côté serveur : les choix sont rangés dans les champs texte existants. */
import type { ExamKind } from "./care-records";

export const CLINICAL_FINDINGS = [
  "Examen sans particularité", "Température élevée", "Pharynx rouge", "Auscultation pulmonaire normale", "Râles à l’auscultation",
  "Abdomen souple", "Douleur abdominale à la palpation", "Pâleur des conjonctives", "Signes de déshydratation", "Œdèmes des membres inférieurs",
  "Souffle cardiaque", "Douleur lombaire à la palpation", "Plaie ou lésion cutanée",
] as const;

export const DIAGNOSES = [
  "Paludisme simple", "Paludisme grave", "Infection respiratoire haute", "Infection respiratoire basse", "Gastro-entérite", "Infection urinaire",
  "Fièvre typhoïde", "Hypertension artérielle", "Diabète", "Anémie", "Lombalgie", "Céphalée", "Gastrite", "Parasitose intestinale", "Infection génitale",
  "Grossesse en cours, évolution normale", "Allergie", "Traumatisme", "Syndrome viral",
] as const;

export const CARE_PLAN_ITEMS = [
  "Repos", "Bonne hydratation", "Traitement symptomatique", "Régime adapté", "Surveillance à domicile", "Contrôle dans 48 h", "Contrôle dans 7 jours",
  "Revenir en urgence si aggravation", "Examens complémentaires demandés", "Orientation vers un spécialiste",
] as const;

export const CONCLUSION_ITEMS = [
  "Consultation sans gravité", "Traitement débuté", "Suivi à prévoir", "Examens en attente de résultats", "Hospitalisation recommandée", "Aucun traitement nécessaire",
] as const;

export const MEDICATION_GROUPS: { group: string; items: string[] }[] = [
  { group: "Douleur et fièvre", items: ["Paracétamol", "Ibuprofène", "Acide acétylsalicylique", "Diclofénac", "Tramadol", "Phloroglucinol"] },
  { group: "Antipaludiques", items: ["Artéméther-luméfantrine", "Artésunate-amodiaquine", "Dihydroartémisinine-pipéraquine", "Artésunate injectable", "Quinine", "Sulfadoxine-pyriméthamine"] },
  { group: "Antibiotiques", items: ["Amoxicilline", "Amoxicilline-acide clavulanique", "Azithromycine", "Ciprofloxacine", "Métronidazole", "Cotrimoxazole", "Ceftriaxone", "Céfixime", "Doxycycline", "Érythromycine", "Gentamicine"] },
  { group: "Antiparasitaires et antifongiques", items: ["Albendazole", "Mébendazole", "Ivermectine", "Fluconazole", "Nystatine"] },
  { group: "Digestif", items: ["Oméprazole", "Pantoprazole", "Sels de réhydratation orale", "Zinc", "Lopéramide", "Dompéridone", "Hydroxyde d’aluminium et de magnésium"] },
  { group: "Respiratoire et allergies", items: ["Salbutamol", "Loratadine", "Cétirizine", "Prednisolone", "Prednisone", "Ambroxol", "Carbocistéine"] },
  { group: "Cœur, tension, diabète", items: ["Amlodipine", "Hydrochlorothiazide", "Captopril", "Énalapril", "Aténolol", "Furosémide", "Metformine", "Glibenclamide"] },
  { group: "Grossesse et gynécologie", items: ["Acide folique", "Fer et acide folique", "Méthyldopa", "Misoprostol", "Clotrimazole ovule", "Métronidazole ovule"] },
  { group: "Vitamines et fer", items: ["Sulfate ferreux", "Vitamine C", "Vitamine B complexe", "Vitamine A"] },
];

export const DOSAGES = [
  "5 mg", "10 mg", "20 mg", "20/120 mg", "40 mg", "50 mg", "80 mg", "100 mg", "125 mg", "150 mg", "200 mg", "250 mg", "300 mg", "400 mg", "500 mg",
  "600 mg", "800 mg", "1 g", "1 mL", "5 mL", "10 mL", "1 sachet", "1 ampoule",
] as const;

export const POSOLOGIES = [
  "1 cp × 1/jour", "1 cp × 2/jour", "1 cp × 3/jour", "2 cp × 2/jour", "2 cp × 3/jour", "4 cp × 2/jour", "1 gélule × 2/jour", "1 gélule × 3/jour",
  "1 sachet × 1/jour", "1 sachet × 3/jour", "5 mL × 3/jour", "10 mL × 3/jour", "1 application × 2/jour", "1 ovule le soir", "1 injection par jour",
  "Toutes les 8 h", "Toutes les 12 h", "En cas de douleur (3 fois par jour au maximum)", "Dose unique",
] as const;

export const DURATIONS = ["Dose unique", "1 jour", "2 jours", "3 jours", "5 jours", "7 jours", "10 jours", "14 jours", "21 jours", "1 mois", "2 mois", "3 mois", "Traitement au long cours"] as const;

export const INSTRUCTIONS = ["Avant les repas", "Pendant les repas", "Après les repas", "À jeun", "Le matin", "Le soir", "Au coucher", "En cas de douleur", "Avec un grand verre d’eau", "Ne pas écraser"] as const;

export const EXAM_CHOICES: Record<ExamKind, readonly string[]> = {
  analysis: [
    "Numération formule sanguine (NFS)", "Goutte épaisse / TDR paludisme", "Glycémie à jeun", "Hémoglobine glyquée (HbA1c)", "Créatininémie", "Urée sanguine",
    "Bilan lipidique", "Bilan hépatique (ASAT, ALAT)", "CRP", "Vitesse de sédimentation (VS)", "Ionogramme sanguin", "ECBU (examen des urines)", "Examen des selles (KAOP)",
    "Sérologie VIH", "Sérologie hépatite B", "Test de grossesse (β-hCG)", "Groupe sanguin et rhésus", "Sérologie de Widal", "Prélèvement vaginal", "Bilan prénatal",
  ],
  imaging: [
    "Radiographie du thorax", "Radiographie du rachis", "Radiographie du bassin", "Radiographie d’un membre", "Échographie abdominale", "Échographie pelvienne",
    "Échographie obstétricale", "Échographie cardiaque", "Échographie des parties molles", "Scanner (TDM)", "IRM", "Mammographie",
  ],
  other: ["Électrocardiogramme (ECG)", "Spirométrie", "Frottis cervico-utérin", "Fibroscopie digestive", "Audiométrie", "Examen ophtalmologique"],
};

/** Texte enregistré pour un bloc à cocher : les choix gardent l'ordre de la liste (pas celui des clics), puis le texte libre sur une nouvelle ligne. */
export function buildPicked(selected: readonly string[], options: readonly string[], other: string): string {
  const known = options.filter((item) => selected.includes(item));
  const free = other.trim();
  return [known.join(", "), free].filter(Boolean).join("\n");
}

/** Liste pour une valeur mémorisée hors liste (jamais perdue) : renvoie les options avec la valeur ajoutée en tête si besoin. */
export function withCurrent(options: readonly string[], current: string): string[] {
  const value = current.trim();
  return value && !options.includes(value) ? [value, ...options] : [...options];
}

export const OTHER_VALUE = "__autre__";
