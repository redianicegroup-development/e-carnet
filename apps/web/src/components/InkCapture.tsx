"use client";

import { useEffect, useRef, useState } from "react";
import { cropToInk, extractInk, fitWithin, hasTransparency, INK_BLACK, INK_BLUE, type InkColor, type InkResult, type Pixels } from "../lib/ink-extract";
import "./ink-capture.css";

type Kind = "stamp" | "signature";
type Mode = "choose" | "camera" | "draw" | "preview";
type Props = { kind: Kind; onUse: (file: File) => void; onCancel: () => void };

const WORK_SIDE = 1400;
const OUTPUT_SIDES = [1000, 800, 600, 450];
const MAX_BYTES = 1_800_000; // l'API refuse au-delà de 2 Mo
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const NOUN: Record<Kind, { the: string; this: string }> = { stamp: { the: "le cachet", this: "ce cachet" }, signature: { the: "la signature", this: "cette signature" } };

/** Zone de la prise de vue, en fractions de l'image : c'est exactement ce que le cadre en pointillés montre à l'écran. */
function guideFor(kind: Kind, ratio: number) {
  if (kind === "stamp") {
    const side = 0.8 * Math.min(ratio, 1);
    return { w: side / ratio, h: side };
  }
  const widthUnits = 0.92 * ratio;
  return { w: 0.92, h: Math.min(0.8, widthUnits / 2.6) };
}

function framePixels(source: CanvasImageSource, width: number, height: number, crop?: { x: number; y: number; w: number; h: number }): Pixels {
  const area = crop ?? { x: 0, y: 0, w: width, h: height };
  const size = fitWithin(Math.round(area.w), Math.round(area.h), WORK_SIDE);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("L’image n’a pas pu être traitée par ce navigateur.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, size.width, size.height);
  context.imageSmoothingQuality = "high";
  context.drawImage(source, area.x, area.y, area.w, area.h, 0, 0, size.width, size.height);
  const image = context.getImageData(0, 0, size.width, size.height);
  return { data: image.data, width: size.width, height: size.height };
}

function pixelsToCanvas(pixels: Pixels) {
  const canvas = document.createElement("canvas");
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("L’aperçu n’a pas pu être créé.");
  context.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
  return canvas;
}

/** PNG transparent de 2 Mo maximum, d'au moins 32 px de côté (limites de l'API), en réduisant au besoin. */
async function toPngBlob(pixels: Pixels): Promise<Blob> {
  const full = pixelsToCanvas(pixels);
  for (const side of OUTPUT_SIDES) {
    const size = fitWithin(pixels.width, pixels.height, side);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(32, size.width);
    canvas.height = Math.max(32, size.height);
    const context = canvas.getContext("2d");
    if (!context) continue;
    context.imageSmoothingQuality = "high";
    context.drawImage(full, Math.floor((canvas.width - size.width) / 2), Math.floor((canvas.height - size.height) / 2), size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  throw new Error("L’image est trop lourde. Reprenez la photo en cadrant plus près.");
}

type Stroke = { x: number; y: number; w: number }[];

/** Signature dessinée au doigt ou à la souris : traits lissés, épaisseur selon la vitesse, fond transparent. */
function SignaturePad({ onDone, onCancel }: { onDone: (pixels: Pixels) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const last = useRef({ x: 0, y: 0, t: 0, w: 3 });
  const colorRef = useRef<string>(`rgb(${INK_BLACK.join(",")})`);
  const [color, setColor] = useState<"black" | "blue">("black");
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");

  function paint(context: CanvasRenderingContext2D, scale: number) {
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = colorRef.current;
    context.fillStyle = colorRef.current;
    for (const stroke of strokes.current) {
      if (stroke.length === 1) {
        context.beginPath();
        context.arc(stroke[0].x * scale, stroke[0].y * scale, (stroke[0].w * scale) / 1.6, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      for (let index = 1; index < stroke.length; index += 1) {
        const from = stroke[index - 1];
        const to = stroke[index];
        const before = index > 1 ? { x: (stroke[index - 2].x + from.x) / 2, y: (stroke[index - 2].y + from.y) / 2 } : from;
        const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
        context.beginPath();
        context.lineWidth = to.w * scale;
        context.moveTo(before.x * scale, before.y * scale);
        context.quadraticCurveTo(from.x * scale, from.y * scale, middle.x * scale, middle.y * scale);
        context.stroke();
      }
      const tail = stroke[stroke.length - 1];
      const beforeTail = stroke[stroke.length - 2];
      context.beginPath();
      context.lineWidth = tail.w * scale;
      context.moveTo(((beforeTail.x + tail.x) / 2) * scale, ((beforeTail.y + tail.y) / 2) * scale);
      context.lineTo(tail.x * scale, tail.y * scale);
      context.stroke();
    }
  }

  function render() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const ratio = window.devicePixelRatio || 1;
    const box = canvas.getBoundingClientRect();
    if (canvas.width !== Math.round(box.width * ratio) || canvas.height !== Math.round(box.height * ratio)) {
      canvas.width = Math.round(box.width * ratio);
      canvas.height = Math.round(box.height * ratio);
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    paint(context, ratio);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const observer = new ResizeObserver(() => render());
    observer.observe(canvas);
    render();
    return () => observer.disconnect();
  }, []);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  function down(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = point(event);
    current.current = [{ x, y, w: 3 }];
    last.current = { x, y, t: performance.now(), w: 3 };
    strokes.current.push(current.current);
    render();
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!current.current) return;
    const events = typeof event.nativeEvent.getCoalescedEvents === "function" ? event.nativeEvent.getCoalescedEvents() : [];
    const list = events.length ? events : [event.nativeEvent];
    const box = event.currentTarget.getBoundingClientRect();
    for (const item of list) {
      const x = item.clientX - box.left;
      const y = item.clientY - box.top;
      const now = performance.now();
      const distance = Math.hypot(x - last.current.x, y - last.current.y);
      if (distance < 1.2) continue;
      const speed = distance / Math.max(1, now - last.current.t);
      const target = event.pointerType === "pen" && item.pressure > 0 ? 1.5 + item.pressure * 3 : Math.min(3.6, Math.max(1.5, 3.6 - 2.2 * speed));
      const width = last.current.w * 0.7 + target * 0.3;
      current.current.push({ x, y, w: width });
      last.current = { x, y, t: now, w: width };
    }
    render();
  }

  function up() {
    if (!current.current) return;
    current.current = null;
    setCount(strokes.current.length);
    setError("");
  }

  function recolor(next: "black" | "blue") {
    setColor(next);
    colorRef.current = `rgb(${(next === "blue" ? INK_BLUE : INK_BLACK).join(",")})`;
    render();
  }

  function undo() { strokes.current.pop(); setCount(strokes.current.length); render(); }
  function clear() { strokes.current = []; setCount(0); render(); }

  function finish() {
    const canvas = canvasRef.current;
    if (!canvas || strokes.current.length === 0) { setError("Dessinez d’abord votre signature."); return; }
    const box = canvas.getBoundingClientRect();
    const scale = 3; // tracé refait en haute définition : bord net, même sur un petit écran
    const out = document.createElement("canvas");
    out.width = Math.round(box.width * scale);
    out.height = Math.round(box.height * scale);
    const context = out.getContext("2d", { willReadFrequently: true });
    if (!context) { setError("Ce navigateur ne permet pas de préparer la signature."); return; }
    paint(context, scale);
    const image = context.getImageData(0, 0, out.width, out.height);
    const cropped = cropToInk({ data: image.data, width: out.width, height: out.height }, 0.06);
    if (!cropped) { setError("Le tracé est trop petit. Signez plus grand."); return; }
    onDone(cropped);
  }

  return <div className="ink-capture">
    <h4>Dessinez votre signature</h4>
    <p className="muted">Signez avec le doigt, le stylet ou la souris. Elle sera apposée sur vos ordonnances, avec la mention « Signé électroniquement dans Mon E‑Carnet ».</p>
    <canvas ref={canvasRef} className={count === 0 ? "ink-pad ink-pad--empty" : "ink-pad"} role="img" aria-label="Zone de signature" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
    <div className="ink-controls"><fieldset><legend>Couleur du trait</legend>
      <label className="ink-chip"><input type="radio" name="pad-color" checked={color === "black"} onChange={() => recolor("black")} /><span className="ink-chip__dot" style={{ background: `rgb(${INK_BLACK.join(",")})` }} />Noir</label>
      <label className="ink-chip"><input type="radio" name="pad-color" checked={color === "blue"} onChange={() => recolor("blue")} /><span className="ink-chip__dot" style={{ background: `rgb(${INK_BLUE.join(",")})` }} />Bleu</label>
    </fieldset></div>
    {error && <p className="status" role="alert">{error}</p>}
    <div className="ink-capture__actions">
      <button type="button" className="button primary" onClick={finish} disabled={count === 0}>Voir le résultat</button>
      <button type="button" className="button" onClick={undo} disabled={count === 0}>Annuler le dernier trait</button>
      <button type="button" className="button" onClick={clear} disabled={count === 0}>Effacer</button>
      <button type="button" className="button" onClick={onCancel}>Retour</button>
    </div>
  </div>;
}

export function InkCapture({ kind, onUse, onCancel }: Props) {
  const noun = NOUN[kind];
  const [mode, setMode] = useState<Mode>("choose");
  const [source, setSource] = useState<Pixels | null>(null);
  const [direct, setDirect] = useState<Pixels | null>(null);
  const [result, setResult] = useState<InkResult | null>(null);
  const [sensitivity, setSensitivity] = useState(1);
  const [color, setColor] = useState<InkColor>(kind === "stamp" ? "original" : "black");
  const [onPaper, setOnPaper] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [ratio, setRatio] = useState(4 / 3);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const final: Pixels | null = direct ?? (result?.status === "ok" ? result.pixels : null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }

  // La caméra et le minuteur ne survivent jamais au composant (sinon le voyant de la caméra reste allumé).
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    window.clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (mode !== "camera" || !video) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  }, [mode, stream]);

  useEffect(() => {
    const canvas = previewRef.current;
    if (mode !== "preview" || !canvas || !final) return;
    canvas.width = final.width;
    canvas.height = final.height;
    canvas.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(final.data), final.width, final.height), 0, 0);
  }, [mode, final]);

  async function openCamera(nextFacing: "environment" | "user" = facing) {
    setError("");
    stopStream();
    if (!navigator.mediaDevices?.getUserMedia) { setError("Ce navigateur ne permet pas d’ouvrir la caméra. Choisissez une photo à la place."); return; }
    try {
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: nextFacing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = next;
      setStream(next);
      setFacing(nextFacing);
      setMode("camera");
    } catch (cause) {
      setError(cause instanceof DOMException && cause.name === "NotAllowedError" ? "La caméra est refusée. Autorisez-la dans votre navigateur, ou choisissez une photo." : "Caméra indisponible. Choisissez une photo à la place.");
    }
  }

  function process(pixels: Pixels, nextSensitivity: number, nextColor: InkColor) {
    setBusy(true);
    window.clearTimeout(timer.current);
    // Laisse l'écran afficher « Traitement… » avant le calcul (quelques centaines de ms sur un téléphone).
    timer.current = window.setTimeout(() => {
      setResult(extractInk(pixels, { sensitivity: nextSensitivity, color: nextColor }));
      setBusy(false);
    }, 40);
  }

  function takeSource(pixels: Pixels) {
    setError("");
    if (hasTransparency(pixels)) {
      const cropped = cropToInk(pixels);
      if (!cropped) { setError("Cette image est vide."); setMode("choose"); return; }
      setSource(null); setResult(null); setDirect(cropped); setMode("preview");
      return;
    }
    setDirect(null); setSource(pixels); setResult(null); setSensitivity(1); setMode("preview");
    process(pixels, 1, color);
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { setError("La caméra n’est pas encore prête."); return; }
    const guide = guideFor(kind, video.videoWidth / video.videoHeight);
    const crop = { x: ((1 - guide.w) / 2) * video.videoWidth, y: ((1 - guide.h) / 2) * video.videoHeight, w: guide.w * video.videoWidth, h: guide.h * video.videoHeight };
    try { takeSource(framePixels(video, video.videoWidth, video.videoHeight, crop)); } catch (cause) { setError(cause instanceof Error ? cause.message : "La photo n’a pas pu être traitée."); return; }
    stopStream();
  }

  async function chooseFile(file?: File) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) { setError("Choisissez un fichier image (photo ou PNG)."); return; }
    if (file.size > MAX_FILE_BYTES) { setError("Cette image dépasse 20 Mo. Choisissez-en une plus légère."); return; }
    try {
      const bitmap = await createImageBitmap(file);
      const pixels = framePixels(bitmap, bitmap.width, bitmap.height);
      bitmap.close();
      takeSource(pixels);
    } catch {
      setError("Impossible de lire cette image. Essayez une photo JPG ou PNG.");
    }
  }

  function changeSensitivity(value: number) {
    setSensitivity(value);
    if (source) process(source, value, color);
  }

  function changeColor(value: InkColor) {
    setColor(value);
    if (source) process(source, sensitivity, value);
  }

  function restart() {
    stopStream();
    window.clearTimeout(timer.current);
    setSource(null); setDirect(null); setResult(null); setError(""); setBusy(false); setMode("choose");
  }

  async function confirm() {
    if (!final) return;
    setBusy(true);
    setError("");
    try {
      const blob = await toPngBlob(final);
      onUse(new File([blob], `${kind}.png`, { type: "image/png" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L’image n’a pas pu être préparée.");
    } finally {
      setBusy(false);
    }
  }

  const input = <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => { void chooseFile(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />;

  if (mode === "draw") return <SignaturePad onCancel={() => setMode("choose")} onDone={(pixels) => { setSource(null); setResult(null); setDirect(pixels); setMode("preview"); }} />;

  if (mode === "camera") {
    const guide = guideFor(kind, ratio);
    return <div className="ink-capture">
      <h4>Photographiez {noun.the}</h4>
      <div className="ink-camera" style={{ aspectRatio: String(ratio) }}>
        <video ref={videoRef} muted playsInline autoPlay aria-label="Aperçu de la caméra" onLoadedMetadata={(event) => setRatio(event.currentTarget.videoWidth / (event.currentTarget.videoHeight || 1) || 4 / 3)} />
        <div className="ink-camera__guide" style={{ left: `${((1 - guide.w) / 2) * 100}%`, top: `${((1 - guide.h) / 2) * 100}%`, width: `${guide.w * 100}%`, height: `${guide.h * 100}%` }} />
        <span className="ink-camera__hint">{kind === "stamp" ? "Placez le cachet dans le cadre, sur du papier blanc." : "Placez la signature dans le cadre, sur du papier blanc."}</span>
      </div>
      {error && <p className="status" role="alert">{error}</p>}
      <div className="ink-capture__actions">
        <button type="button" className="button primary" onClick={capture}>Prendre la photo</button>
        <button type="button" className="button" onClick={() => void openCamera(facing === "environment" ? "user" : "environment")}>Changer de caméra</button>
        <button type="button" className="button" onClick={restart}>Retour</button>
      </div>
    </div>;
  }

  if (mode === "preview") {
    const message = result?.status === "empty" ? `Aucun trait détecté. Photographiez sur une feuille blanche bien éclairée, en cadrant uniquement ${noun.the}.`
      : result?.status === "dark" ? "Le fond de la photo est trop sombre. Posez le papier blanc sur une surface claire et rephotographiez."
      : "";
    return <div className="ink-capture">
      <h4>{direct && !source ? `Aperçu de ${noun.the}` : "Aperçu : fond retiré"}</h4>
      <div className={onPaper ? "seal-preview seal-preview--large seal-preview--paper" : "seal-preview seal-preview--large"} aria-live="polite">
        {busy && !final ? <span className="seal-preview--empty">Traitement…</span> : final ? <canvas ref={previewRef} role="img" aria-label={`Aperçu ${noun.the} sans fond`} /> : <span className="seal-preview--empty">Aucun résultat</span>}
      </div>
      {message && <p className="status" role="alert">{message}</p>}
      {direct && !source && <p className="muted">Le fond est déjà transparent : l’image est conservée telle quelle, simplement recadrée.</p>}
      {source && <div className="ink-controls">
        <fieldset><legend>Couleur du trait</legend>
          {(kind === "stamp" ? (["original", "black", "blue"] as InkColor[]) : (["black", "blue", "original"] as InkColor[])).map((value) => <label className="ink-chip" key={value}><input type="radio" name="ink-color" checked={color === value} onChange={() => changeColor(value)} /><span className="ink-chip__dot" style={{ background: value === "original" ? "linear-gradient(135deg, #d33 0 33%, #36c 33% 66%, #111 66%)" : `rgb(${(value === "blue" ? INK_BLUE : INK_BLACK).join(",")})` }} />{value === "original" ? "Couleur d’origine" : value === "blue" ? "Bleu" : "Noir"}</label>)}
        </fieldset>
        <div><label className="field"><span>Netteté du trait</span><input type="range" min={0.6} max={1.6} step={0.05} value={sensitivity} onChange={(event) => changeSensitivity(Number(event.target.value))} aria-valuetext={sensitivity < 0.9 ? "moins de détails" : sensitivity > 1.15 ? "plus de détails" : "automatique"} /></label><div className="ink-controls__scale"><span>Moins de bruit</span><span>Plus de détails</span></div></div>
      </div>}
      <label className="ink-chip"><input type="checkbox" checked={onPaper} onChange={(event) => setOnPaper(event.target.checked)} />Voir sur papier blanc</label>
      {error && <p className="status" role="alert">{error}</p>}
      <div className="ink-capture__actions">
        <button type="button" className="button primary" onClick={() => void confirm()} disabled={!final || busy}>{busy ? "Préparation…" : `Utiliser ${noun.this}`}</button>
        <button type="button" className="button" onClick={restart}>Reprendre</button>
        <button type="button" className="button" onClick={onCancel}>Annuler</button>
      </div>
    </div>;
  }

  return <div className="ink-capture">
    <h4>{kind === "stamp" ? "Ajouter votre cachet" : "Ajouter votre signature"}</h4>
    <ul className="ink-capture__tips">
      {kind === "stamp"
        ? <><li>Tamponnez sur une feuille blanche unie.</li><li>Bonne lumière, sans ombre de la main ni du téléphone.</li><li>Cadrez uniquement l’empreinte : le fond est retiré automatiquement.</li></>
        : <><li>Signez au stylo noir ou bleu sur une feuille blanche.</li><li>Bonne lumière, téléphone bien à plat au-dessus du papier.</li><li>Pas de papier à portée ? Dessinez la signature à l’écran.</li></>}
    </ul>
    <div className="ink-capture__choices">
      <button type="button" className="button primary" onClick={() => void openCamera()}>Prendre une photo</button>
      <button type="button" className="button" onClick={() => fileRef.current?.click()}>Choisir une image</button>
      {kind === "signature" && <button type="button" className="button" onClick={() => { setError(""); setMode("draw"); }}>Dessiner à l’écran</button>}
    </div>
    {error && <p className="status" role="alert">{error}</p>}
    <div className="ink-capture__actions"><button type="button" className="button" onClick={onCancel}>Annuler</button></div>
    {input}
  </div>;
}
