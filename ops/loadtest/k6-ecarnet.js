// Mon E-Carnet — test de charge k6 (STAGING uniquement, comptes SYNTHÉTIQUES, jamais de données réelles).
//
// Ce que fait ce script : se connecte UNE fois par utilisateur virtuel (session Django + CSRF), puis lit en boucle les
// écrans patient les plus chauds. Il échoue bruyamment si la connexion échoue : un test qui ne se connecte pas ne mesure
// que /health et ne prouve rien.
//
// Prérequis sur le staging (sinon vous mesurez les limiteurs, pas l'application) :
//   - ECARNET_RATE_LOGIN=100000/hour et ECARNET_RATE_LOGIN_EMAIL=100000/hour
//   - au moins autant de comptes synthétiques que d'utilisateurs virtuels
//   - jamais contre Render Free (0,1 CPU, mise en veille) : les chiffres n'auraient aucun rapport avec Hodi
//
// Usage :
//   k6 run -e BASE_URL=https://staging-api.example.com -e WEB_ORIGIN=https://staging.example.com \
//          -e PROFILE=A -e TEST_USERS='[{"email":"p1@test.invalid","password":"..."}]' ops/loadtest/k6-ecarnet.js
//
// Profils : A = 100 utilisateurs, B = 300 utilisateurs (lecture patient uniquement : les parcours professionnel et
// établissement ne sont PAS encore scriptés). E (QR à usage unique en double) n'est volontairement pas scripté : voir README.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const BASE = (__ENV.BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const ORIGIN = (__ENV.WEB_ORIGIN || BASE).replace(/\/$/, '');
const PROFILE = __ENV.PROFILE || 'A';
const USERS = JSON.parse(__ENV.TEST_USERS || '[]');

const VUS = { A: 100, B: 300 };
if (PROFILE === 'E') throw new Error("Profil E non implémenté : testez la concurrence du QR en TransactionTestCase sur PostgreSQL (voir README-CORRECTIONS.md).");
if (!VUS[PROFILE]) throw new Error(`PROFILE inconnu : ${PROFILE} (A ou B)`);
if (!USERS.length) throw new Error('TEST_USERS est vide : sans comptes, le test ne mesurerait que /health/.');
if (USERS.length < VUS[PROFILE]) console.warn(`Seulement ${USERS.length} comptes pour ${VUS[PROFILE]} utilisateurs virtuels : des comptes seront partagés (limiteur par adresse e-mail).`);

const serverErrors = new Rate('ecarnet_server_errors');   // 5xx
const loginFailures = new Rate('ecarnet_login_failures');
const throttled = new Counter('ecarnet_throttled_429');   // un 429 = limiteur mal réglé pour le test, à traiter

export const options = {
  scenarios: {
    patients: {
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: VUS[PROFILE] },   // montée progressive : pas de ruée simultanée sur la connexion
        { duration: '6m', target: VUS[PROFILE] },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    'http_req_duration{kind:read}': ['p(95)<500'],            // lecture < 500 ms
    ecarnet_server_errors: ['rate<0.005'],                    // 5xx < 0,5 %
    ecarnet_login_failures: [{ threshold: 'rate==0', abortOnFail: true, delayAbortEval: '15s' }],
    ecarnet_throttled_429: ['count==0'],
    checks: ['rate>0.99'],
  },
};

const READS = [
  '/api/v1/patient/profile/',
  '/api/v1/patient/care/notifications/inbox/',
  '/api/v1/patient/emergency-card/',
  '/api/v1/patient/care/medication-reminders/',
  '/api/v1/patient/care/consultations/',
];

let loggedIn = false; // état par utilisateur virtuel (la jarre de cookies de k6 l'est aussi)

function login() {
  const user = USERS[(__VU - 1) % USERS.length];
  const csrf = http.get(`${BASE}/api/v1/csrf/`, { tags: { kind: 'auth' } });
  let token = '';
  try { token = csrf.json('csrfToken'); } catch (e) { token = ''; }
  const res = http.post(
    `${BASE}/api/v1/identity/login/`,
    JSON.stringify({ email: user.email, password: user.password }),
    { headers: { 'Content-Type': 'application/json', 'X-CSRFToken': token, Origin: ORIGIN, Referer: `${ORIGIN}/` }, tags: { kind: 'auth' } },
  );
  const ok = check(res, { 'connexion 200': (r) => r.status === 200 });
  loginFailures.add(!ok);
  serverErrors.add(res.status >= 500);
  if (res.status === 429) throttled.add(1);
  return ok;
}

export default function () {
  if (!loggedIn) {
    loggedIn = login();
    if (!loggedIn) { sleep(5); return; }
  }
  const count = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i += 1) {
    const path = READS[Math.floor(Math.random() * READS.length)];
    const res = http.get(`${BASE}${path}`, { tags: { kind: 'read' } });
    check(res, { [`GET ${path} 200`]: (r) => r.status === 200 });
    serverErrors.add(res.status >= 500);
    if (res.status === 429) throttled.add(1);
    if (res.status === 401 || res.status === 403) loggedIn = false; // session expirée : reconnexion à la prochaine itération
    sleep(Math.random() * 3 + 1);
  }
  sleep(Math.random() * 5 + 3); // environ une requête API toutes les 8 s par utilisateur actif
}

export function handleSummary(data) {
  const m = (name, key) => (data.metrics[name] && data.metrics[name].values[key] !== undefined ? data.metrics[name].values[key] : NaN);
  return {
    'loadtest-report.json': JSON.stringify(data, null, 2),
    stdout:
      `Profil ${PROFILE} (lecture patient) — p95 lecture : ${m('http_req_duration{kind:read}', 'p(95)').toFixed(0)} ms, ` +
      `5xx : ${(m('ecarnet_server_errors', 'rate') * 100).toFixed(2)} %, échecs de connexion : ${(m('ecarnet_login_failures', 'rate') * 100).toFixed(1)} %, ` +
      `429 : ${m('ecarnet_throttled_429', 'count')}\n`,
  };
}
