import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("la cloche patient utilise l’inbox et conserve un panneau accessible", () => {
  const bell = read("src/components/notifications/NotificationBell.tsx");
  assert.match(bell, /use client/);
  assert.match(bell, /patient\/care\/notifications\/inbox/);
  assert.match(bell, /items: PatientNotification\[\]/);
  assert.match(bell, /unread_count/);
  assert.match(bell, /created_at/);
  assert.match(bell, /apiPatch/);
  assert.match(bell, /notifications\/\$\{encodeURIComponent\(notification\.id\)\}\/read/);
  assert.match(bell, /role="dialog"/);
  assert.match(bell, /aria-haspopup="dialog"/);
  assert.match(bell, /visibilitychange/);
  assert.match(bell, /AudioContext/);
  assert.match(bell, /playNotificationChime/);
  assert.match(bell, /aria-pressed=\{soundEnabled\}/);
  assert.match(bell, /gm__trigger notification-bell__trigger/);
  assert.match(read("src/components/notifications/notification-bell.css"), /notification-bell__panel/);
  assert.match(read("src/components/notifications/notification-bell.css"), /notification-bell-pulse/);
});

test("la cloche est uniquement dans l’espace patient et hors de la liste d’onglets", () => {
  const sidebar = read("src/components/shell/AppSidebar.tsx");
  const shell = read("src/components/shell/SpaceShell.tsx");
  assert.match(sidebar, /tools\?: ReactNode/);
  assert.match(sidebar, /sb__tools/);
  assert.match(shell, /space === "patient"/);
  assert.match(shell, /NotificationBell/);
  assert.match(shell, /tools=\{/);
  assert.match(shell, /space-mobile-header/);
  assert.match(shell, /NotificationBell placement="mobile"/);
  assert.doesNotMatch(sidebar, /NotificationBell/);
});

test("les chemins de contexte des notifications restent statiques", () => {
  const bell = read("src/components/notifications/NotificationBell.tsx");
  assert.doesNotMatch(bell, /[?&](id|notification|kind)=/i);
  assert.match(bell, /patient\/consultations/);
  assert.match(bell, /patient\/historique#acces/);
  assert.match(bell, /patient\/carnet#vaccinations/);
  assert.match(bell, /patient\/carnet#medications/);
});

test("la cloche suit un pouls léger au lieu d’un rechargement toutes les minutes (08/11/2026)", () => {
  const bell = read("src/components/notifications/NotificationBell.tsx");
  assert.match(bell, /notifications\/pulse\//);
  assert.match(bell, /POLL_INTERVAL_MS = 5_000/);
  assert.doesNotMatch(bell, /REFRESH_INTERVAL_MS/); // plus de rechargement complet toutes les 60 s
  // Le pouls ne recharge la boîte que si le résumé a changé ; l'écran caché ou hors ligne ne consomme rien.
  assert.match(bell, /pulseSignature/);
  assert.match(bell, /document\.visibilityState === "visible" && navigator\.onLine !== false/);
  assert.match(bell, /window\.addEventListener\("online", wakeUp\)/);
  assert.match(bell, /SERVICE_WORKER_PUSH_MESSAGE/);
  assert.match(bell, /announceNewNotifications/);
  assert.match(read("public/sw.js"), /ecarnet:push-received/);
});

test("la cloche propose « Les nouvelles », « Voir toutes » et l’effacement (08/11/2026)", () => {
  const bell = read("src/components/notifications/NotificationBell.tsx");
  assert.match(bell, /role="tablist"/);
  assert.match(bell, /Les nouvelles/);
  assert.match(bell, /Voir toutes/);
  assert.match(bell, /apiDelete/);
  assert.match(bell, /notifications\/\$\{encodeURIComponent\(notification\.id\)\}\//);
  assert.match(bell, /read-all\//);
  assert.match(bell, /\}clear\//);
  // Tout effacer exige une seconde pression.
  assert.match(bell, /Confirmer : tout effacer/);
  assert.match(read("src/components/notifications/notification-bell.css"), /notification-bell__bulk--danger/);
});
