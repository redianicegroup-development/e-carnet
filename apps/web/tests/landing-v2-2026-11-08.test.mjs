// Landing mise à jour depuis la maquette Mon_E-Carnet.html : sections reprises, héro / FAQ / contact / pied de page de l'app conservés, CSS isolé.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const page = read("src/app/page.tsx");
const css = read("src/app/landing-v2.css");

test("le héro d'origine est conservé tel quel", () => {
  assert.match(page, /<section className="lp-hero" aria-labelledby="hero-title" data-hero>/);
  assert.match(page, /\{HERO\.title\}/);
  assert.match(page, /data-hero-media/);
  assert.match(page, /HERO_IMAGE/);
});

test("les sections de la maquette sont dans l'ordre, avec les ancres de la navigation", () => {
  const order = ["ProblemSection", "SolutionSection", "ToolTiles", "DetailRows", "FlowSection", "RoleCards", "TrustCopy", "AccessDemo"].map((name) => page.indexOf(`<${name} />`));
  assert.ok(order.every((index) => index > 0), "section manquante");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "ordre des sections");
  for (const id of ["probleme", "solution", "fonctionnalites", "parcours", "profils"]) assert.match(page, new RegExp(`id="${id}"`));
});

test("la FAQ, le contact et le pied de page de l'application restent ceux d'origine", () => {
  assert.match(page, /<FaqSection \/>/);
  assert.match(page, /<ContactSection /);
  assert.match(page, /<PublicShell bleed>/);
  assert.doesNotMatch(css, /footer|\.lp2-fgrid|\.lp2-fbottom/);
});

test("le CSS de la maquette est isolé : chaque sélecteur commence par .lp2 ou :where(.lp2)", () => {
  const withoutKeyframes = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  const preludes = [...withoutKeyframes.matchAll(/(^|[}{])\s*([^{}@]+)\{/g)].map((match) => match[2].trim()).filter(Boolean);
  assert.ok(preludes.length > 100);
  for (const prelude of preludes) {
    for (const selector of prelude.split(/,(?![^(]*\))/).map((part) => part.trim())) {
      if (/^\d+%|^from$|^to$/.test(selector)) continue;
      assert.match(selector, /^(\.lp2|:where\(\.lp2\))/, `sélecteur non isolé : ${selector}`);
    }
  }
});

test("pas de thème sombre ni de police chargée depuis l'extérieur", () => {
  assert.doesNotMatch(css, /prefers-color-scheme|data-theme|fonts\.googleapis|@import/);
  assert.match(css, /--lp2-f-display:\s*var\(--font-heading/);
});

test("aucun contenu en dur n'a de promesse écartée par la revue juridique", () => {
  const banned = /à tout moment|100 ?%|garanti|sécurité absolue|infaillible|conforme à/i;
  const dir = new URL("../src/components/landing2/", import.meta.url);
  for (const file of readdirSync(dir)) assert.doesNotMatch(readFileSync(new URL(file, dir), "utf8"), banned, file);
});

test("les boutons d'inscription de la landing sont « Commencer » vers /connexion, suivis comme inscription", () => {
  const roleCta = read("src/components/landing2/RoleCta.tsx");
  assert.match(roleCta, /data-track=\{cta\.track\}/);
  assert.match(read("src/lib/landing-content.ts"), /cta: \{ href: "\/connexion", text: "Commencer", track: "signup" \}/);
});

test("le parcours en trois étapes est accessible : onglets, flèches, pause, animation réduite", () => {
  const flow = read("src/components/landing2/FlowSection.tsx");
  assert.match(flow, /role="tablist"/);
  assert.match(flow, /role="tab"/);
  assert.match(flow, /role="tabpanel"/);
  assert.match(flow, /ArrowDown/);
  assert.match(flow, /Mettre en pause l’animation/);
  assert.match(flow, /prefers-reduced-motion/);
});

test("la démonstration d'accès passe par autoriser, révoquer, rejouer et refuser", () => {
  const demo = read("src/components/landing2/AccessDemo.tsx");
  for (const label of ["Autoriser", "Révoquer", "Rejouer l’exemple", "Refuser"]) assert.ok(demo.includes(label), label);
  assert.match(demo, /Exemple illustré, sans donnée réelle/);
});

test("le faux QR code est déterministe", async () => {
  const source = read("src/components/landing2/FakeQr.tsx");
  assert.match(source, /state \* 9301 \+ 49297\) % 233280/);
  assert.doesNotMatch(source, /Math\.random/);
});

test("le message est le bon : un infirmier prépare depuis l'espace patient, sinon le médecin consulte directement par QR depuis son espace professionnel", () => {
  const dir = new URL("../src/components/landing2/", import.meta.url);
  for (const file of readdirSync(dir)) {
    const source = readFileSync(new URL(file, dir), "utf8");
    // le patient ne fait pas lui-même sa pré-consultation
    assert.doesNotMatch(source, /Préparez|Préparer mon rendez-vous|Ma consultation|Notez le motif|Préparez vos consultations/i, file);
  }
  const solution = read("src/components/landing2/SolutionSection.tsx");
  assert.match(solution, /infirmier/);
  assert.match(solution, /espace professionnel/);
  assert.match(solution, /préconisations/);
  const flow = read("src/components/landing2/flowParts.tsx");
  for (const title of ["L’infirmier prépare", "Le médecin scanne votre QR", "Vous retrouvez ses préconisations"]) assert.ok(flow.includes(`title: "${title}"`), title);
  const content = read("src/lib/landing-content.ts");
  assert.match(content, /Sans infirmier, le médecin consulte directement/);
  assert.doesNotMatch(content, /Préparez vos consultations|Notez le motif/);
});

test("la solution montre trois captures détourées (main et téléphone), responsives, sans écran fictif", () => {
  const solution = read("src/components/landing2/SolutionSection.tsx");
  const shots = [...solution.matchAll(/src: "(\/landing\/hand-[a-z-]+\.webp)"/g)].map((match) => match[1]);
  assert.equal(shots.length, 3);
  for (const src of shots) assert.ok(existsSync(new URL(`../public${src}`, import.meta.url)), src);
  assert.match(solution, /<Image/);
  assert.match(solution, /sizes="\(max-width: 900px\)/);
  assert.match(solution, /prefers-reduced-motion/);
  assert.doesNotMatch(solution, /lp2-phone|lp2-scr/);
  assert.match(css, /\.lp2-hand-stack \{width:min\(86vw,420px\)\}/);
});

test("la landing suit l'ordre problème, solution, bénéfices, fonctionnement, rôles, confiance, appel final, sans logos ni témoignages", () => {
  const ids = ["probleme", "solution", "fonctionnalites", "parcours", "profils"].map((id) => page.indexOf(`id="${id}"`));
  assert.deepEqual([...ids].sort((a, b) => a - b), ids);
  assert.ok(page.indexOf("<FaqSection />") > ids.at(-1));
  assert.ok(page.indexOf("<ContactSection ") > page.indexOf("<FaqSection />"));
  assert.doesNotMatch(page, /<Testimonials|<Logos|<Companies/);
});

test("textes de la landing 09/11 (2e passe) : titres concrets, appel final qui nomme l'action, accroche du hero alignée", () => {
  const content = read("src/lib/landing-content.ts");
  const all = [content, page, ...readdirSync(new URL("../src/components/landing2/", import.meta.url)).filter((file) => file.endsWith(".tsx")).map((file) => read(`src/components/landing2/${file}`))].join("\n");
  for (const old of ["Ce que votre carnet change, concrètement", "Le médecin sait d’où vient chaque information", "chacun à leur place", "Trois étapes, de votre carnet à ses préconisations", "Avant de vous lancer", "Vous gardez la main sur chaque accès", "Votre prochaine consultation peut commencer autrement"]) assert.ok(!all.includes(old), `ancien titre encore présent : ${old}`);
  assert.match(content, /primary: \{ href: "\/connexion\?mode=register", label: "Créer mon carnet" \}/, "l'appel final mène à la création de compte, avec le libellé de l'application");
  assert.doesNotMatch(content, /préparez vos consultations/, "le patient ne prépare pas sa consultation : c'est le travail du médecin ou de l'infirmier");
});

test("landing vitrine (3e passe) : quatre tuiles, aucun chiffre dans les étapes, une seule couche de réassurance avant l'appel final", () => {
  const tiles = read("src/components/landing2/ToolTiles.tsx");
  assert.equal((tiles.match(/className="lp2-tile lp2-rv"/g) ?? []).length, 4);
  const figure = /\d+ ?(minutes?|min\b|heures?|h\b|jours?)/i;
  const flow = read("src/components/landing2/flowParts.tsx");
  const steps = flow.slice(flow.indexOf("export const FLOW_STEPS"), flow.indexOf("export const FLOW_SCREENS"));
  assert.doesNotMatch(steps, figure, "les étapes ne portent pas de durées : elles sont dans la FAQ et la page Sécurité");
  assert.doesNotMatch(read("src/lib/landing-content.ts").slice(read("src/lib/landing-content.ts").indexOf("export const STEPS"), read("src/lib/landing-content.ts").indexOf("export type Profile")), figure);
  assert.doesNotMatch(page, /ObjectionCards/);
  assert.ok(page.indexOf("<TrustCopy />") < page.indexOf("<FaqSection />") && page.indexOf("<FaqSection />") < page.indexOf("<ContactSection "));
});
