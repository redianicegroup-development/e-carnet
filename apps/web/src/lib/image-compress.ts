/* Réduit une photo avant l'envoi (photo de la demande d'examen) : côté long 1 600 px, JPEG. Les téléphones fournissent souvent 4 à 8 Mo ;
   en réseau faible, l'envoi doit rester léger. En cas d'échec (navigateur sans canvas, image illisible), on garde le fichier d'origine. */
export const PROOF_MAX_BYTES = 10 * 1024 * 1024;

export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  if (typeof document === "undefined" || !file.type.startsWith("image/")) return file;
  try {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("image illisible"));
        element.src = url;
      });
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return file;
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob || blob.size >= file.size && scale === 1) return file;
      return new File([blob], "demande-examen.jpg", { type: "image/jpeg" });
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return file;
  }
}
