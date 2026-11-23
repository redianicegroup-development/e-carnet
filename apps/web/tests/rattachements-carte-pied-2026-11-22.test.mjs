import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("rattachements : la demande en attente est un profil « En attente » qui ouvre une fiche Refuser / Confirmer", () => {
  const source = read("src/components/EstablishmentConsole.tsx");
  assert.match(source, /function PendingProfile/);
  assert.match(source, /label="En attente"/);
  assert.match(source, /status=\{\{ label: "En attente de rattachement", tone: "warn" \}\}/);
  assert.match(source, /label: "Refuser", tone: "danger"[\s\S]*label: "Confirmer", tone: "primary"/);
  // médecins et demandes dans la même grille (3 par ligne sur téléphone), les demandes aussi dans la page Médecins
  assert.match(source, /<ProfileGrid label="Médecins de l’établissement">[\s\S]*<PendingProfile/);
  assert.match(source, /<ProfileGrid label="Demandes de rattachement en attente">/);
  assert.doesNotMatch(source, /className="profile-grid"/);
});

test("rattachements : modals de résultat (succès accepté / refusé, échec avec le motif) et mise à jour en direct", () => {
  const source = read("src/components/EstablishmentConsole.tsx");
  assert.match(source, /Vous avez accepté la demande : \$\{who\} est rattaché\(e\) à \$\{establishment\.name\}/);
  assert.match(source, /Vous avez refusé la demande de \$\{who\}/);
  assert.match(source, /tone: "error"[\s\S]*reason instanceof Error && reason\.message/);
  assert.match(source, /Rien n’a été modifié : la demande reste en attente/);
  assert.match(source, /<OutcomeDialog \{\.\.\.outcome\} onClose=\{\(\) => setOutcome\(null\)\} \/>/);
  // le refus se confirme ; l'acceptation part directement (la fiche est déjà l'étape de vérification)
  assert.match(source, /if \(!approve\) \{\s*const accepted = await confirm/);
  assert.match(source, /useNewNotifications\(\(\{ kinds \}\) => \{ if \(kinds\.some\(\(kind\) => kind\.startsWith\("membership\."\)\)\) void reload\(\)/);
  assert.match(source, /ecarnet:membership-requests-changed/);
});

test("rattachements : badge du nombre en attente sur l’onglet « Demandes » et sur la tuile", () => {
  const shell = read("src/components/shell/SpaceShell.tsx");
  assert.match(shell, /badge: space === "establishment" && tab\.id === "demandes" && pendingRequests > 0 \? pendingRequests : undefined/);
  assert.match(shell, /ecarnet:membership-requests-changed/);
  const section = read("src/components/ui/CollapsibleSection.tsx");
  assert.match(section, /count = 0/);
  assert.match(section, /carnet-accordion__count/);
  assert.match(read("src/components/EstablishmentConsole.tsx"), /<CollapsibleSection title="Demandes de rattachement" solo initiallyOpen=\{pending\.length > 0\} count=\{pending\.length\}/);
  assert.match(read("src/components/patient-sections.css"), /\.carnet-accordion__count \{[^}]*position: absolute/);
  assert.match(read("src/components/ui/profile.css"), /\.profile-tiles > li > \.profile-photo \{ justify-self: center/);
});

test("notifications des espaces professionnel / établissement / laboratoire : boîte du compte, lien et rafraîchissement des onglets", () => {
  const bell = read("src/components/notifications/NotificationBell.tsx");
  assert.match(bell, /scope\?: SpaceId/);
  assert.match(bell, /"\/api\/v1\/establishments\/notifications\/inbox\/"/);
  assert.match(bell, /membership\\\.request/);
  assert.match(bell, /membership\\\.\(approved\|refused\|revoked\)/);
  const shell = read("src/components/shell/SpaceShell.tsx");
  assert.match(shell, /<NotificationBell placement="sidebar" scope=\{space\} \/>/);
  assert.match(shell, /space === "professional" && kinds\.some\(\(kind\) => kind\.startsWith\("membership\."\)\)\) setClinicalTick/);
});

test("pied de page : l’en-tête et le menu se retirent, reviennent en remontant, jamais sur une page qui ne défile pas", () => {
  const hider = read("src/components/shell/FooterBarsHider.tsx");
  assert.match(hider, /data-at-footer/);
  assert.match(hider, /IntersectionObserver/);
  assert.match(hider, /delta < -8\) set\(false\)/);
  assert.match(hider, /root\.scrollHeight > window\.innerHeight \+ 120/);
  assert.match(read("src/components/shell/SpaceShell.tsx"), /<FooterBarsHider \/>/);
  assert.match(read("src/components/public/PublicShell.tsx"), /<FooterBarsHider \/>/);
  const app = read("src/components/shell/sidebar.css");
  assert.match(app, /html\[data-at-footer="true"\] \.space-mobile-header \{[^}]*opacity: 0/);
  assert.match(app, /@media \(max-width: 919px\) \{[\s\S]*html\[data-at-footer="true"\] \.sb \{[^}]*visibility: hidden/);
  const pub = read("src/app/site-pages.css");
  assert.match(pub, /html\[data-at-footer="true"\] \.pub-burger \{[^}]*visibility: hidden/);
});

test("traduction : « Mon E‑Carnet » n’est jamais traduit (connexion, récupération, en-têtes, textes)", () => {
  for (const file of ["src/app/connexion/page.tsx", "src/app/connexion/recuperation/page.tsx"]) {
    assert.match(read(file), /<span className="notranslate" translate="no">Mon E‑Carnet<\/span><\/Link>/, file);
  }
  assert.match(read("src/components/emergency-card/EmergencyCardVisual.tsx"), /<span className="notranslate" translate="no">Mon E‑Carnet<\/span>/);
  // aucun doublon de span emboîtés
  for (const file of ["src/components/public/PublicShell.tsx", "src/components/modal/GreetingModal.tsx", "src/components/app/InstallLanding.tsx"]) {
    assert.doesNotMatch(read(file), /translate="no"><span className="notranslate"/, file);
  }
});

test("carte virtuelle : carte d’identité médicale premium, toujours pliée, même dessin dans le PNG", () => {
  const css = read("src/components/emergency-card/emergency-card.css");
  assert.match(css, /\.ecard-wrap \.ecard \{[^}]*aspect-ratio: 85\.6 \/ 54/);
  assert.match(css, /--ecard-gold: #e3c27a/);
  assert.match(css, /\.ecard__chip \{/);
  assert.match(css, /\.ecard-wrap \.ecard__photo-frame \{[^}]*rgba\(227, 194, 122/);
  const visual = read("src/components/emergency-card/EmergencyCardVisual.tsx");
  assert.match(visual, /Carte d’identité médicale/);
  assert.match(visual, /ecard__chip/);
  assert.match(visual, /aria-label="Carte d’urgence"/);
  assert.match(read("src/components/PatientEmergencyCardSettingsClient.tsx"), /useState\(false\); \/\/ la carte virtuelle est toujours pliée/);
  const png = read("src/components/emergency-card/emergency-card-image.ts");
  assert.match(png, /const GOLD = "#e3c27a"/);
  assert.match(png, /CARTE D’IDENTITÉ MÉDICALE/);
  assert.match(png, /TITULAIRE/);
});

test("suppression de compte et connexion Google : messages d’erreur lisibles", () => {
  const client = read("src/infrastructure/api/client.ts");
  assert.match(client, /function fallbackMessage\(status: number\)/);
  assert.match(client, /status === 500\) return "Une erreur est survenue sur le serveur/);
  const forms = read("src/components/AuthForms.tsx");
  assert.match(forms, /if \(status === "conflict"\) return "Ce compte existe déjà"/);
});

test("notifications laboratoire et admin : liens vers l’écran où agir, cloche dans la console admin, onglet ouvert depuis le #", () => {
  const bell = read("src/components/notifications/NotificationBell.tsx");
  assert.match(bell, /scope\?: SpaceId \| "admin"/);
  assert.match(bell, /admin\\\.suspension_request[\s\S]*"\/admin#account-requests"/);
  assert.match(bell, /admin\\\.feedback[\s\S]*"\/admin#feedback"/);
  assert.match(bell, /laboratory\\\.welcome[\s\S]*"\/laboratoire\/scanner"/);
  assert.match(bell, /laboratory\\\.administrator[\s\S]*"\/laboratoire\/parametres"/);
  assert.match(bell, /break_glass[\s\S]*"\/etablissement\/urgences"/);
  assert.match(bell, /membership\\\.left[\s\S]*"\/etablissement\/medecins"/);
  const admin = read("src/app/admin/page.tsx");
  assert.match(admin, /<NotificationBell placement="sidebar" scope="admin" \/>/);
  assert.match(admin, /<NotificationBell placement="mobile" scope="admin" \/>/);
  assert.match(admin, /window\.addEventListener\("hashchange", openFromHash\)/);
  assert.match(admin, /tabs\.find\(\(tab\) => tab\.id === id\)/);
});
