/** Âge lisible (« 34 ans », « 8 mois ») d'après une date de naissance AAAA-MM-JJ ; chaîne vide si la date est absente ou invraisemblable.
    L'âge n'est jamais saisi : il se déduit de la date et reste donc juste dans le temps. */
export function ageLabel(value: string | null | undefined): string {
  if (!value) return "";
  const birth = new Date(`${value.slice(0, 10)}T00:00:00`);
  const today = new Date();
  if (Number.isNaN(birth.getTime()) || birth > today) return "";
  let years = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) years -= 1;
  if (years >= 130) return "";
  if (years >= 1) return `${years} an${years > 1 ? "s" : ""}`;
  const months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth() - (today.getDate() < birth.getDate() ? 1 : 0);
  return months >= 1 ? `${months} mois` : "Moins d’un mois";
}
