"use client";
import { useRef, useState } from "react";
type Props = { value: string; onChange: (value: string) => void; fallback: string; disabled?: boolean };
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_WEBP_BYTES = 250 * 1024;
export function AvatarPicker({ value, onChange, fallback, disabled = false }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  async function selectFile(file?: File) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) { setError("Choisissez un fichier image."); return; }
    if (file.size > MAX_FILE_BYTES) { setError("La photo doit faire moins de 5 Mo."); return; }
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("La photo n’a pas pu être traitée.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      let blob: Blob | null = null;
      for (const quality of [0.86, 0.76, 0.66, 0.56]) {
        blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", quality));
        if (blob && blob.size <= MAX_WEBP_BYTES) break;
      }
      if (!blob || blob.type !== "image/webp") throw new Error("Ce navigateur ne permet pas de préparer la photo. Essayez un autre navigateur.");
      if (blob.size > MAX_WEBP_BYTES) throw new Error("La photo est trop volumineuse. Choisissez une image plus petite.");
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" && onChange(reader.result);
      reader.onerror = () => setError("Impossible de lire cette photo.");
      reader.readAsDataURL(blob);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger cette photo.");
    }
  }
  return <div className="avatar-picker">
    <button type="button" className="avatar avatar--large avatar-picker__preview" aria-label="Choisir ou modifier la photo du profil" title="Choisir ou modifier la photo" disabled={disabled} onClick={() => input.current?.click()}>
      {value ? <img src={value} alt="Aperçu de votre photo de profil" /> : fallback}
      <span className="avatar-picker__camera" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></span>
    </button>
    <input ref={input} className="avatar-picker__input" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choisir une photo de profil" disabled={disabled} onChange={event => { void selectFile(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
    {value && <button type="button" className="avatar-picker__remove" disabled={disabled} onClick={() => { onChange(""); setError(""); }}>Retirer la photo</button>}
    {error && <p className="status avatar-picker__error" role="alert">{error}</p>}
  </div>;
}
