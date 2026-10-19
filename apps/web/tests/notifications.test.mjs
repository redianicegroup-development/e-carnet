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
  assert.match(bell, /Voir toutes les notifications/);
  assert.match(bell, /\/patient\/carnet#notifications/);
  assert.match(bell, /visibilitychange/);
  assert.match(bell, /60_000/);
  assert.match(bell, /AudioContext/);
  assert.match(bell, /playNotificationChime/);
  assert.match(bell, /aria-pressed=\{soundEnabled\}/);
  assert.match(read("src/components/notifications/notification-bell.css"), /ecarnet-gooey/);
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
  assert.match(bell, /patient\/acces/);
  assert.match(bell, /patient\/carnet#vaccinations/);
  assert.match(bell, /patient\/carnet#medications/);
});
