// Fabrique favicon.ico (entrées PNG 16/32/48) à partir de favicon.svg ; chaque taille est rendue séparément pour rester nette.
const sharp = require("sharp"), fs = require("fs");
(async () => {
  const svg = fs.readFileSync(process.argv[2]);
  const sizes = [16, 32, 48];
  const pngs = [];
  for (const s of sizes) pngs.push(await sharp(svg, { density: 72 * (s >= 32 ? 12 : 24) }).resize(s, s, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toBuffer());
  const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let offset = 6 + 16 * sizes.length; const entries = [];
  sizes.forEach((s, i) => { const e = Buffer.alloc(16); e[0] = s; e[1] = s; e[2] = 0; e[3] = 0; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(offset, 12); entries.push(e); offset += pngs[i].length; });
  fs.writeFileSync(process.argv[3], Buffer.concat([head, ...entries, ...pngs]));
  console.log("ICO écrit :", process.argv[3], offset, "octets");
})();
