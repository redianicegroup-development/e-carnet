// Garde-fous du site public : liens légaux visiteurs/connectés, crédits, icônes et favicon, aide sans promesse.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url).pathname;
const read = (rel) => readFileSync(`${root}${rel}`, "utf8");
const legal = await import("../src/lib/legal/config.ts");
const help = await import("../src/components/help/helpContent.ts");
const credits = await import("../src/lib/credits.ts");

const routeExists = (href) => existsSync(`${root}src/app${href.split("#")[0]}/page.tsx`);
const hrefsOf = (source) => [...source.matchAll(/href[:=]\s*[{"]\s*"?(\/[a-z0-9/#-]*)/g)].map((m) => m[1]);

test("une session expirée redirige vers la connexion et les erreurs de connexion ouvrent une modale oops", () => {
  const shell = read("src/components/shell/SpaceShell.tsx");
  const auth = read("src/components/AuthForms.tsx");
  assert.match(shell, /error\.status === 401[\s\S]*setState\(\{ status: "anonymous" \}\)/);
  assert.match(shell, /router\.replace\(`\/connexion\?next=/);
  assert.doesNotMatch(shell, /Votre session a expiré ou vous n’êtes pas connecté/);
  assert.match(auth, /<AuthErrorDialog message=\{errorModal\}/);
  assert.match(auth, /<ModalIllustration mood="oops"/);
  assert.match(auth, /role="alertdialog" aria-modal="true"/);
});

test("les salutations d’accueil sont des toasts illustrés, accessibles, non bloquants et responsive", () => {
  const greeting = read("src/components/modal/GreetingModal.tsx");
  const styles = read("src/components/modal/modal.css");
  assert.match(greeting, /setTimeout\(\(\) => setKind\(null\), 4200\)/);
  assert.match(greeting, /role="status" aria-live="polite"/);
  assert.match(greeting, /<h2[^>]*>\{titleFor\(kind/);
  assert.match(greeting, /(?:<img src=|<Image src=)"?\/answer\.svg/);
  assert.match(greeting, /Votre espace personnel est prêt/);
  assert.doesNotMatch(greeting, /WELCOME_TEXT|cta:|<button|aria-modal="true"/);
  assert.doesNotMatch(greeting, /useDialogBehavior|aria-modal="true"/);
  assert.match(styles, /\.greeting-toast \{[^}]*position: fixed/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*\.greeting-toast/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
});
test("les quatre espaces partagent une seule sidebar responsive (logo, navigation, compte avec menu), sans header séparé", () => {
  const shell = read("src/components/shell/SpaceShell.tsx");
  const sidebar = read("src/components/shell/AppSidebar.tsx");
  const sidebarStyles = read("src/components/shell/sidebar.css");
  const styles = read("src/app/globals.css");
  const adminPage = read("src/app/admin/page.tsx");
  assert.match(shell, /<AppSidebar/);
  assert.match(adminPage, /<AppSidebar/);
  assert.match(sidebar, /sb__head[\s\S]*BrandMark/);
  assert.match(sidebar, /sb__account[\s\S]*SidebarAvatar/);
  assert.match(sidebar, /aria-haspopup="menu"/);
  assert.match(sidebar, /aria-expanded=\{!rail\}/);
  assert.doesNotMatch(shell, /space-header|space-header__me|<nav/);
  assert.doesNotMatch(adminPage, /<nav|space-nav|admin-sidebar/);
  for (const layout of ["patient", "professionnel", "etablissement"]) {
    assert.match(read(`src/app/${layout}/layout.tsx`), /<SpaceShell space=/, `${layout} doit utiliser la sidebar partagée`);
  }
  assert.match(styles, /\.space-main \{[^}]*grid-row: 1;[^}]*grid-column: 2;[^}]*margin-inline: auto;/);
  assert.match(styles, /\.admin-space-main \{[^}]*margin-inline: auto;/);
  assert.match(sidebarStyles, /\.space\.space--nav-collapsed \{ grid-template-columns: var\(--sb-w-rail\) minmax\(0, 1fr\);/);
  assert.match(sidebarStyles, /\.sb, \.sb\.is-bare \{[^}]*position: sticky/);
  assert.match(sidebarStyles, /\.sb \{[^}]*position: fixed/, "mobile : barre basse");
  assert.doesNotMatch(styles, /space-nav|space-sidebar|admin-sidebar-|admin-nav-link|admin-nav-badge/, "les anciennes règles de sidebar ne doivent plus subsister dans globals.css");
  assert.doesNotMatch(sidebar, /localStorage|sessionStorage|indexedDB/, "l’état replié de la sidebar reste en mémoire (aucun stockage navigateur)");
});
test("visiteurs : le pied de page public renvoie vers les trois pages légales", () => {
  const footer = read("src/components/public/PublicShell.tsx");
  for (const doc of Object.values(legal.LEGAL_DOCS)) assert.ok(footer.includes(`LEGAL_DOCS.${Object.keys(legal.LEGAL_DOCS).find((k) => legal.LEGAL_DOCS[k] === doc)}.path`), `pied de page : lien manquant vers ${doc.path}`);
  assert.match(footer, /href="\/credits"/, "pied de page : lien Crédits manquant");
  assert.match(read("src/app/connexion/page.tsx"), /href="\/cgu"[\s\S]*href="\/confidentialite"|href="\/mentions-legales"/, "page de connexion : liens légaux manquants");
});

test("connectés : Paramètres › En savoir plus renvoie vers les pages légales et les crédits, sans « À venir »", () => {
  const more = read("src/components/SettingsMoreSection.tsx");
  const hrefs = hrefsOf(more);
  for (const doc of Object.values(legal.LEGAL_DOCS)) assert.ok(hrefs.includes(doc.path), `En savoir plus : ${doc.path} manquant`);
  for (const must of ["/credits", "/faq"]) assert.ok(hrefs.includes(must), `En savoir plus : ${must} manquant`);
  assert.ok(hrefs.every(routeExists), `routes absentes : ${hrefs.filter((h) => !routeExists(h)).join(", ")}`);
  assert.doesNotMatch(more, /À venir|comingSoon/);
  for (const settings of ["AccountSettingsClient", "ProfessionalSettingsClient", "EstablishmentSettingsClient"]) {
    const file = `src/components/${settings}.tsx`;
    if (existsSync(`${root}${file}`)) assert.match(read(file), /SettingsMoreSection/, `${settings} n'affiche plus la rubrique En savoir plus`);
  }
});

test("crédits : Redianice est identifiée comme startup ayant contacté AKATech Studio", () => {
  assert.deepEqual(credits.CREDITS_ORIGINS.map((c) => c.name), ["Redianice", "AKATech Studio"]);
  assert.match(credits.CREDITS_UPDATED, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(read("src/app/credits/page.tsx"), /Redianice, une startup, a contacté AKATech Studio/);
});

test("marque : l'ancienne tuile « + » n'est plus dessinée, le logo est le composant BrandMark", () => {
  const walk = (dir) => readdirSync(dir).flatMap((n) => { const f = `${dir}/${n}`; return statSync(f).isDirectory() ? walk(f) : /\.tsx$/.test(n) ? [f] : []; });
  const old = walk(`${root}src`).filter((f) => /className="brand-mark"/.test(readFileSync(f, "utf8")));
  assert.deepEqual(old, [], `ancienne marque encore présente : ${old.join(", ")}`);
});

test("les trois espaces paramètres utilisent des icônes SVG sémantiques, sans glyphes de substitution", () => {
  const files = ["AccountSettingsClient", "ProfessionalSettingsClient", "EstablishmentSettingsClient"];
  const sources = files.map((name) => read(`src/components/${name}.tsx`));
  for (const source of sources) assert.doesNotMatch(source, /icon:\s*"(?:ID|▣|◉|i|✎|⌖|♡)"/);
  assert.match(sources[0], /icon: "idcard"[\s\S]*icon: "heart"[\s\S]*icon: "sparkle"[\s\S]*icon: "lock"[\s\S]*icon: "help"[\s\S]*icon: "pencil"/);
  assert.match(sources[1], /icon: "stethoscope"[\s\S]*icon: "building"[\s\S]*icon: "sparkle"[\s\S]*icon: "lock"[\s\S]*icon: "help"[\s\S]*icon: "pencil"/);
  assert.match(sources[2], /icon: "building"[\s\S]*icon: "pin"[\s\S]*icon: "sparkle"[\s\S]*icon: "lock"[\s\S]*icon: "help"[\s\S]*icon: "pencil"/);
  assert.match(read("src/components/SettingsDirectory.tsx"), /Icon name=\{item\.icon\}/);
});

test("la connexion conserve son animation GSAP/Lenis et les styles de mouvement réduit", () => {
  const page = read("src/app/connexion/page.tsx");
  const motion = read("src/components/motion/AuthMotion.tsx");
  const styles = read("src/app/connexion/auth-immersive.css");
  const pkg = JSON.parse(read("package.json"));
  assert.match(page, /AuthMotion/);
  assert.match(page, /PulseLine/);
  assert.match(page, /auth-immersive\.css/);
  assert.match(motion, /useSmoothScroll\(\)/);
  assert.match(motion, /useGSAP/);
  assert.match(motion, /prefers-reduced-motion: no-preference/);
  assert.match(styles, /auth-shell--immersive/);
  assert.equal(pkg.dependencies.gsap, "^3.15.0");
  assert.equal(pkg.dependencies.lenis, "^1.3.26");
});

test("le lien admin est dans la navigation patient et la gestion du compte dans la sécurité des trois espaces", () => {
  const settings = read("src/components/AccountSettingsClient.tsx");
  const shell = read("src/components/shell/SpaceShell.tsx");
  const professional = read("src/components/ProfessionalSettingsClient.tsx");
  const establishment = read("src/components/EstablishmentSettingsClient.tsx");
  const patientForm = read("src/components/AccountActionRequestsSettingsClient.tsx");
  const adminPanel = read("src/components/AdminAccountActionRequestsClient.tsx");
  const adminPage = read("src/app/admin/page.tsx");
  assert.doesNotMatch(settings, /gestion-compte|id: "administration"|e-carnetci\.vercel\.app\/admin/);
  assert.match(shell, /space === "patient" && state\.status === "ready" && state\.account\.is_admin === true/);
  assert.match(shell, /<AppSidebar/);
  assert.match(shell, /href: "https:\/\/e-carnetci\.vercel\.app\/admin\/", external: true/);
  assert.match(settings, /activeSection === "securite"[\s\S]*AccountActionRequestsSettingsClient/);
  assert.match(professional, /activeSection === "securite"[\s\S]*AccountActionRequestsSettingsClient/);
  assert.match(establishment, /activeSection === "securite"[\s\S]*AccountActionRequestsSettingsClient/);
  assert.match(patientForm, /request_type: requestType/);
  assert.match(patientForm, /value="other"/);
  assert.match(patientForm, /useConfirm/);
  assert.match(patientForm, /sans attendre d’agrément/);
  assert.match(patientForm, /accountDeleted=1/);
  assert.match(patientForm, /account-requests/);
  assert.match(adminPanel, /admin\/account-requests/);
  assert.match(adminPanel, /\/delete\//);
  assert.match(adminPanel, /protected_account/);
  assert.match(adminPage, /AdminAccountActionRequestsClient/);
  assert.match(adminPage, /<AppSidebar/);
  assert.match(adminPage, /onToggle=/);
  assert.match(adminPage, /space--nav-collapsed/);
  assert.match(adminPage, /listRole="tablist"/);
  assert.match(adminPage, /Gestion des comptes/);
  assert.match(adminPage, /id: "settings", label: "Paramètres", short: "Moi", icon: "user"/);
  assert.match(adminPage, /admin-panel-settings/);
  assert.match(adminPage, /AdminSettingsClient/);
  assert.match(read("src/components/AdminSettingsClient.tsx"), /SettingsDirectory/);
  assert.match(read("src/components/AdminSettingsClient.tsx"), /ThemeSettingsClient/);
});

test("favicon, ICO et icônes PWA : les fichiers déclarés existent et sont valides", () => {
  const layout = read("src/app/layout.tsx");
  const urls = [...layout.matchAll(/url:\s*"([^"]+)"/g)].map((m) => m[1]).concat(["/favicon.ico"]);
  for (const url of new Set(urls)) assert.ok(existsSync(`${root}public${url}`), `icône déclarée mais absente : ${url}`);
  const ico = readFileSync(`${root}public/favicon.ico`);
  assert.equal(ico.readUInt16LE(0), 0); assert.equal(ico.readUInt16LE(2), 1);
  assert.ok(ico.readUInt16LE(4) >= 3, "l'ICO doit contenir au moins 16, 32 et 48 px");
  const manifest = JSON.parse(read("public/manifest.webmanifest"));
  for (const icon of manifest.icons) {
    assert.ok(existsSync(`${root}public${icon.src}`), `manifest : ${icon.src} absent`);
    if (icon.src.endsWith(".png")) {
      const png = readFileSync(`${root}public${icon.src}`);
      assert.equal(png.readUInt32BE(16), Number(icon.sizes.split("x")[0]), `${icon.src} : taille déclarée ≠ taille réelle`);
    }
  }
  assert.ok(manifest.icons.some((i) => i.purpose === "maskable"), "icône maskable manquante");
  assert.match(layout, /site-pages\.css/, "layout : feuille site-pages.css non importée");
});

test("aide : aucune promesse ni terme que la revue juridique déconseille", () => {
  const source = read("src/components/help/helpContent.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""); // les commentaires peuvent citer les termes interdits
  for (const pattern of [/à tout moment/i, /\bmédecins? vérifiés?\b/i, /doit être vérifié/i, /professionnels? vérifiés?\b/i, /en un scan/i, /garanti/i, /100 ?%/]) assert.doesNotMatch(source, pattern, `aide : formulation interdite ${pattern}`);
  for (const profile of help.HELP_PROFILES) assert.ok(profile.steps.length >= 4, `${profile.id} : parcours trop court`);
  const questions = help.HELP_FAQ.flatMap((g) => g.items.map((i) => i.q));
  assert.equal(new Set(questions).size, questions.length, "questions en double");
  assert.ok(questions.length >= 12, "FAQ trop courte pour une aide enrichie");
  assert.match(source, /données fictives/, "l'aide doit rappeler la version de test");
});

test("landing : FAQ visible et structurée, métadonnées indexables et liens canoniques publics", () => {
  const home = read("src/app/page.tsx");
  const sitemap = read("public/sitemap.xml");
  const robots = read("public/robots.txt");
  const llms = read("public/llms.txt");
  assert.match(home, /FAQPage/);
  assert.match(home, /<section className="lp-section lp-faq-section"/);
  assert.match(home, /metadataBase: new URL\(SITE_URL\)/);
  assert.match(home, /alternates: \{ canonical: "\/" \}/);
  assert.match(home, /données fictives/);
  assert.doesNotMatch(sitemap, /localhost/);
  for (const route of ["/", "/a-propos", "/securite", "/faq", "/aide"]) assert.ok(sitemap.includes(`https://e-carnetci.vercel.app${route === "/" ? "/" : route}`), `sitemap : route ${route} absente`);
  assert.match(robots, /Disallow: \/admin\n/);
  assert.match(robots, /Disallow: \/patient\n/);
  assert.match(robots, /Sitemap: https:\/\/e-carnetci\.vercel\.app\/sitemap\.xml/);
  assert.match(llms, /^# Mon Carnet Numérique/m);
  assert.match(llms, /uniquement des données fictives/);
  assert.match(llms, /ne remplace pas un avis médical/);
  assert.doesNotMatch(llms, /localhost/);
});

test("landing animée : le pouls respire et respecte le mouvement réduit", () => {
  const motion = read("src/components/motion/LandingMotion.tsx");
  const styles = read("src/app/landing-immersive.css");
  assert.match(motion, /repeat: -1, repeatDelay: 1\.15/);
  assert.match(motion, /loops\.push\(tracePulse\)/);
  assert.match(motion, /prefers-reduced-motion: no-preference/);
  assert.match(styles, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("admin : les nouveaux retours sont annoncés dans la navigation et les indicateurs mieux hiérarchisés", () => {
  const admin = read("src/app/admin/page.tsx");
  const styles = read("src/app/globals.css");
  const sidebar = read("src/components/shell/AppSidebar.tsx");
  const sidebarStyles = read("src/components/shell/sidebar.css");
  assert.match(admin, /badge: tab\.id === "feedback" \? dashboard\.feedback_new_total/);
  assert.match(admin, /ariaLabel: tab\.id === "feedback"[\s\S]*dashboard\.feedback_new_total/);
  assert.match(sidebar, /sb__badge/);
  assert.match(sidebarStyles, /\.sb__badge/);
  assert.match(styles, /\.space--admin \.admin-metric::before/);
});

test("carte d’urgence : données déclarées, QR explicite et révocable, page non indexable", () => {
  const carnet = read("src/components/PatientCarnet.tsx");
  const settings = read("src/components/PatientEmergencyCardSettingsClient.tsx");
  const publicCard = read("src/components/PublicEmergencyCard.tsx");
  const page = read("src/app/urgence/[token]/page.tsx");
  const api = read("../api/apps/patients/views.py");
  assert.match(carnet, /blood_group: "Groupe sanguin"/);
  assert.match(carnet, /BLOOD_GROUPS/);
  assert.match(settings, /QRCodeSVG/);
  assert.match(settings, /useConfirm/);
  assert.match(settings, /Désactiver/);
  assert.match(settings, /Renouveler/);
  assert.match(publicCard, /allergies déclarées|Allergies déclarées/);
  assert.match(page, /index: false[\s\S]*noarchive: true/);
  assert.match(api, /hmac\.compare_digest/);
  assert.match(api, /Cache-Control.*no-store/);
  assert.match(api, /qr_enabled=True, qr_version=version/);
});

test("pré-consultation : une seule question visible et barre de navigation mobile en capsule", () => {
  const wizard = read("src/components/PatientPreconsultations.tsx");
  const shell = read("src/components/shell/SpaceShell.tsx");
  const sidebar = read("src/components/shell/sidebar.css");
  const loader = read("src/app/screen-loader.css");
  const pro = read("src/components/ProfessionalConsultations.tsx");
  assert.match(wizard, /QUESTIONS\[step\]/);
  assert.match(wizard, /preconsult-wizard__next/);
  assert.match(sidebar, /border-radius: 999px/);
  assert.match(sidebar, /left: 50%/);
  assert.match(shell, /error\.status === 403/);
  assert.match(shell, /if \(state\.status === "loading"\) return <ScreenLoader/);
  assert.match(shell, /Connexion lente, on réessaie/);
  assert.match(loader, /position: fixed; z-index: 2000; inset: 0/);
  assert.match(pro, /event\.key === "\/"/);
  assert.match(pro, /professional-compact-list/);
});
