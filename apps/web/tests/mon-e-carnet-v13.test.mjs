import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
function walk(dir, found = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(relative, found);
    else if (/\.(tsx?|css)$/.test(entry.name)) found.push(relative);
  }
  return found;
}

test("le produit s'appelle « Mon E‑Carnet » partout dans l'interface", () => {
  const leftovers = [];
  for (const file of walk("src")) {
    const source = read(file);
    for (const match of source.matchAll(/(?<!Mon )E[‑-][Cc]arnet|Mon Carnet Num/g)) leftovers.push(`${file}: …${source.slice(Math.max(0, match.index - 20), match.index + 24)}…`);
  }
  assert.deepEqual(leftovers, []);
  assert.match(read("src/app/layout.tsx"), /Mon E[‑-]Carnet/);
});

test("le logo de la connexion ramène à l'accueil, sans bouton « Retour », ni lien Crédits, ni bouton flottant de feedback", () => {
  const login = read("src/app/connexion/page.tsx");
  assert.match(login, /<Link href="\/" className="ax-brand" aria-label="[^"]*retour à la page d’accueil"/);
  assert.doesNotMatch(login, /Retour à l’accueil|ax-stage__home/);
  assert.doesNotMatch(login, /\/credits/);
  const widget = read("src/components/LandingFeedbackWidget.tsx");
  assert.match(widget, /onAuthPage = \/\^\\\/\(connexion\|inscription\)/);
  assert.match(widget, /!inWorkspace && !onAuthPage/);
  // le logo reste visible et cliquable sur mobile
  assert.doesNotMatch(read("src/app/connexion/auth-immersive.css"), /\.ax-stage__eyebrow, \.ax-stage__home|\.ax-brand, \.ax-stage__eyebrow/);
});

test("« Récupérer mon compte » : lien dans la connexion, page au même cadre, demande adressée à l'équipe sans réinitialisation automatique", () => {
  assert.match(read("src/components/AuthForms.tsx"), /login && <p className="ax-forgot"[^>]*><Link href="\/connexion\/recuperation">Récupérer mon compte<\/Link>/);
  const page = read("src/app/connexion/recuperation/page.tsx");
  assert.match(page, /auth-immersive\.css/);
  assert.match(page, /className="ax-frame"/);
  assert.match(page, /className="ax-brand"/);
  assert.match(page, /robots: \{ index: false/);
  assert.doesNotMatch(page, /\/credits/);
  const form = read("src/components/auth/RecoveryRequestForm.tsx");
  assert.match(form, /apiPost\("\/api\/v1\/identity\/contact\/"/);
  assert.match(form, /subject: "problem"/);
  assert.match(form, /\[Récupération de compte\]/);
  assert.match(form, /ax-submit/);
  assert.match(form, /name="website"/); // leurre anti-robots, comme le formulaire de contact
  assert.doesNotMatch(form, /type="password"|autoComplete="(current|new)-password"/); // la demande ne collecte jamais de mot de passe
});

test("les trois paires de polices portent des noms courts, la première reste la valeur par défaut", () => {
  const themes = read("../../packages/ui/src/themes.ts");
  assert.match(themes, /label: "Sora and Bricolage"/);
  assert.match(themes, /label: "Mooli and Manrope"/);
  assert.match(themes, /label: "Fredoka and Quicksand"/);
  assert.doesNotMatch(themes, /Bricolage Grotesque \(texte\)|\(titres\)/);
  assert.match(read("src/components/ThemeSettingsClient.tsx"), /\(par défaut\)/);
});

test("la pré-consultation n'a plus d'établissement à choisir ni de clôture côté patient", () => {
  const patient = read("src/components/PatientPreconsultations.tsx");
  assert.doesNotMatch(patient, /establishment|catalog|useConfirm|\/close/i); // plus de choix d'établissement ni de clôture par le patient
  assert.match(patient, /apiPatch<Encounter>/);
  assert.match(patient, /apiPost<Encounter>\("\/api\/v1\/patient\/care\/encounters\/"/);
  assert.match(patient, /status: "draft" \| "closed"/);
  assert.match(patient, /Qui remplit avec le patient/);
  assert.match(patient, /href="\/patient\/acces"/);
  const pro = read("src/components/ProfessionalConsultations.tsx");
  assert.match(pro, /useConfirm\(\)/);
  assert.match(pro, /Terminer et signer/);
  assert.match(pro, /disabled=\{submitting \|\| !encounterId\}/);
  assert.match(read("src/application/professional-access-grants.ts"), /status: "draft" \| "closed"/);
});

test("les déclarations gardent un tampon de provenance indéformable et couvrent la ville et le contact d'urgence", () => {
  const carnet = read("src/components/PatientCarnet.tsx");
  assert.match(carnet, /city: "Ville", emergency_contact: "Contact d’urgence"/);
  assert.match(carnet, /SINGLETON: Kind\[\] = \["blood_group", "city", "emergency_contact"\]/);
  assert.match(carnet, /id="carte-urgence"|aria-labelledby="card-fields-title"/);
  assert.match(carnet, /className="badge declared stamp"/);
  assert.match(carnet, /new URLSearchParams\(window\.location\.search\)\.get\("ajouter"\)/);
  const skin = read("src/app/carnet-skin.css");
  assert.match(skin, /body \.badge \{ flex: none; max-width: 100%; white-space: nowrap; \}/);
  assert.match(skin, /body \.record\.declaration \{ flex-direction: column;/);
});

test("la peau « carnet » : chargée après globals.css, dérivée du thème, gooey borné et mouvement réduit respecté", () => {
  const layout = read("src/app/layout.tsx");
  assert.ok(layout.indexOf('import "./globals.css"') < layout.indexOf('import "./carnet-skin.css"'));
  assert.match(layout, /<GooeyFilters \/>/);
  const skin = read("src/app/carnet-skin.css");
  // tout est préfixé par body : la peau l'emporte sur les feuilles chargées plus tard, sans !important sur la mise en page
  const selectors = skin.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((line) => line.trim()).filter((line) => /^[.a-z]/.test(line) && line.includes("{"));
  assert.deepEqual(selectors.filter((line) => !/^(body|@)/.test(line) && !line.startsWith("0%")), []);
  assert.doesNotMatch(skin, /localStorage|@import|url\(["']?https?:/);
  assert.match(skin, /--leather: color-mix\(in srgb, var\(--primary\)/);
  assert.match(skin, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(skin, /filter: url\(#ecarnet-gooey\)/);
  assert.match(skin, /filter: url\(#ecarnet-gooey-soft\)/);
  const filters = read("src/components/ui/GooeyFilters.tsx");
  assert.equal([...filters.matchAll(/<filter id="/g)].length, 2);
  assert.match(filters, /aria-hidden="true"/);
  // le filtre ne touche que des calques décoratifs (aria-hidden), jamais du texte
  assert.match(read("src/components/shell/AppSidebar.tsx"), /className="sb__goo" aria-hidden="true"/);
  assert.match(read("src/components/shell/GooeyAccountMenu.tsx"), /className="gm__goo" aria-hidden="true"/);
});

test("le menu du compte en goutte est accessible au clavier et au toucher", () => {
  const menu = read("src/components/shell/GooeyAccountMenu.tsx");
  assert.match(menu, /aria-haspopup="menu"/);
  assert.match(menu, /aria-expanded=\{open\}/);
  assert.match(menu, /inert=\{!open\}/);
  assert.match(menu, /event\.key === "Escape"/);
  assert.match(menu, /pointerdown/);
  assert.match(menu, /ArrowDown/);
  assert.match(read("src/components/shell/SpaceShell.tsx"), /<GooeyAccountMenu account=/);
  // la goutte de la barre basse n'existe que sur mobile ; sur grand écran l'onglet actif garde son fond
  assert.match(read("src/app/carnet-skin.css"), /@media \(max-width: 919px\) \{\s*body \.sb__goo \{ display: block;/);
});
