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

test("« Récupérer mon compte » : lien dans la connexion, page au même cadre, réinitialisation par question secrète en deux étapes", () => {
  assert.match(read("src/components/AuthForms.tsx"), /login && <p className="ax-forgot"[^>]*><Link href="\/connexion\/recuperation">Récupérer mon compte<\/Link>/);
  const page = read("src/app/connexion/recuperation/page.tsx");
  assert.match(page, /auth-immersive\.css/);
  assert.match(page, /className="ax-frame"/);
  assert.match(page, /className="ax-brand"/);
  assert.match(page, /<RecoveryFlow \/>/);
  assert.match(page, /robots: \{ index: false/);
  assert.doesNotMatch(page, /\/credits/);
  const flow = read("src/components/auth/RecoveryFlow.tsx");
  // étape 1 : la question ; étape 2 : la réponse + un nouveau mot de passe
  assert.match(flow, /apiPost<\{ question: string \}>\("\/api\/v1\/identity\/recovery\/question\/"/);
  assert.match(flow, /apiPost\("\/api\/v1\/identity\/recovery\/reset\/", \{ email: email\.trim\(\), answer, new_password: password \}\)/);
  assert.match(flow, /autoComplete="new-password"/);
  assert.match(flow, /MIN_PASSWORD = 12/);
  assert.match(flow, /Les deux mots de passe ne sont pas identiques/);
  assert.match(flow, /error\.status === 429/);
  // le mot de passe et la réponse ne restent pas en mémoire une fois la réinitialisation faite
  assert.match(flow, /setAnswer\(""\); setPassword\(""\); setConfirm\(""\);/);
  // l'écran ne dit jamais si un compte existe : il affiche la question reçue, quelle qu'elle soit
  assert.doesNotMatch(flow, /compte introuvable|aucun compte|n’existe pas/i);
  // dernier recours : écrire à l'équipe, avec l'ancien formulaire (leurre anti-robots, sujet « problem », pas de mot de passe)
  assert.match(flow, /<RecoveryRequestForm onBack=/);
  assert.match(flow, /Je ne me souviens plus de ma réponse/);
  const help = read("src/components/auth/RecoveryRequestForm.tsx");
  assert.match(help, /apiPost\("\/api\/v1\/identity\/contact\/"/);
  assert.match(help, /subject: "problem"/);
  assert.match(help, /\[Récupération de compte\]/);
  assert.match(help, /name="website"/);
  assert.doesNotMatch(help, /type="password"/);
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

test("les déclarations gardent une pastille de provenance indéformable et couvrent la ville et le contact d'urgence", () => {
  const carnet = read("src/components/PatientCarnet.tsx");
  assert.match(carnet, /city: "Ville", emergency_contact: "Contact d’urgence"/);
  assert.match(carnet, /SINGLETON: Kind\[\] = \["blood_group", "city", "emergency_contact"\]/);
  assert.match(carnet, /id="carte-urgence"|aria-labelledby="card-fields-title"/);
  assert.match(carnet, /className="badge declared"/);
  assert.doesNotMatch(carnet, /stamp|tampon/i);
  assert.match(carnet, /new URLSearchParams\(window\.location\.search\)\.get\("ajouter"\)/);
  const skin = read("src/app/soft-skin.css");
  assert.match(skin, /body \.badge \{ flex: none; max-width: 100%; white-space: nowrap;/);
  assert.match(skin, /body \.record\.declaration \{ flex-direction: column;/);
});

test("la peau minimaliste et neumorphique : chargée après globals.css, dérivée du thème, gooey borné et mouvement réduit respecté", () => {
  const layout = read("src/app/layout.tsx");
  assert.ok(layout.indexOf('import "./globals.css"') < layout.indexOf('import "./soft-skin.css"'));
  assert.match(layout, /<GooeyFilters \/>/);
  const skin = read("src/app/soft-skin.css");
  // tout est préfixé par body : la peau l'emporte sur les feuilles chargées plus tard, sans !important sur la mise en page
  const selectors = skin.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((line) => line.trim()).filter((line) => /^[.a-z]/.test(line) && line.includes("{"));
  assert.deepEqual(selectors.filter((line) => !/^(body|@)/.test(line) && !line.startsWith("0%")), []);
  assert.doesNotMatch(skin, /localStorage|@import|url\(["']?https?:/);
  assert.match(skin, /--raise-lg: 10px 10px 24px var\(--neu-dark\), -10px -10px 24px var\(--neu-light\)/);
  // minimalisme : plus de papier, cuir, couture, ruban adhésif, tampon, signet ni bouton de gel
  assert.doesNotMatch(skin.replace(/\/\*[\s\S]*?\*\//g, ""), /leather|--paper|grain|stitch|dashed|clip-path|::before|::after|goo-rise|jelly/);
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
  assert.match(read("src/app/soft-skin.css"), /@media \(max-width: 919px\) \{[^@]*body \.sb__goo \{ display: block;/);
});
