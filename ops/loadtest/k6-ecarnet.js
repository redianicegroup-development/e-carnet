// Mon E-Carnet — test de charge k6 (STAGING uniquement, comptes SYNTHÉTIQUES).
// Ne jamais exécuter contre la production ou avec des données réelles.
// Usage :
//   k6 run -e BASE_URL=https://staging-api.example.com -e WEB_ORIGIN=https://staging.example.com \
//     -e PROFILE=A -e TEST_USERS='[{"email":"p1@test.invalid","password":"..."}]' ops/loadtest/k6-ecarnet.js
// Profils : A=100, B=300, C=1000 utilisateurs virtuels.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const BASE = (__ENV.BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const ORIGIN = (__ENV.WEB_ORIGIN || BASE).replace(/\/$/, '');
const PROFILE = (__ENV.PROFILE || 'A').toUpperCase();
const USERS = JSON.parse(__ENV.TEST_USERS || '[]');
const VUS = { A: 100, B: 300, C: 1000 };

if (!VUS[PROFILE]) throw new Error(`PROFILE inconnu : ${PROFILE} (A, B ou C)`);
if (!USERS.length) throw new Error('TEST_USERS est vide : le test ne mesurerait que /health/.');
if (USERS.length < VUS[PROFILE]) console.warn(`Seulement ${USERS.length} comptes synthétiques pour ${VUS[PROFILE]} VUs : les comptes seront partagés.`);
if (!/^https:\/\//.test(BASE) && !/^https?:\/\/localhost/.test(BASE)) throw new Error('BASE_URL doit être HTTPS en staging.');

const serverErrors = new Rate('ecarnet_server_errors');
const loginFailures = new Rate('ecarnet_login_failures');
const throttled = new Counter('ecarnet_throttled_429');

export const options = {
  scenarios: {
    patients: {
      executor: 'ramping-vus',
      stages: [
        { duration: PROFILE === 'C' ? '10m' : '2m', target: VUS[PROFILE] },
        { duration: PROFILE === 'C' ? '15m' : '6m', target: VUS[PROFILE] },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_duration{kind:read}': ['p(95)<500', 'p(99)<1200'],
    ecarnet_server_errors: ['rate<0.005'],
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
  '/api/v1/patient/care/follow-up-plans/',
];

let loggedIn = false;

function login() {
  const user = USERS[(__VU - 1) % USERS.length];
  const csrf = http.get(`${BASE}/api/v1/csrf/`, { tags: { kind: 'auth' } });
  let token = '';
  try { token = csrf.json('csrfToken'); } catch { token = ''; }
  const res = http.post(`${BASE}/api/v1/identity/login/`, JSON.stringify({ email: user.email, password: user.password }), {
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': token, Origin: ORIGIN, Referer: `${ORIGIN}/` }, tags: { kind: 'auth' },
  });
  const ok = check(res, { 'connexion 200': (r) => r.status === 200 });
  loginFailures.add(!ok); serverErrors.add(res.status >= 500); if (res.status === 429) throttled.add(1);
  return ok;
}

export default function () {
  if (!loggedIn) { loggedIn = login(); if (!loggedIn) { sleep(5); return; } }
  const count = PROFILE === 'C' ? 3 : 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i += 1) {
    const path = READS[Math.floor(Math.random() * READS.length)];
    const res = http.get(`${BASE}${path}`, { tags: { kind: 'read' } });
    const ok = check(res, { [`GET ${path} 200`]: (r) => r.status === 200 });
    serverErrors.add(res.status >= 500); if (res.status === 429) throttled.add(1);
    if (res.status === 401 || res.status === 403) loggedIn = false;
    if (!ok) sleep(1);
    sleep(Math.random() * 3 + 1);
  }
  sleep(PROFILE === 'C' ? Math.random() * 4 + 2 : Math.random() * 5 + 3);
}

export function handleSummary(data) {
  const m = (name, key) => (data.metrics[name]?.values[key] !== undefined ? data.metrics[name].values[key] : NaN);
  return {
    [`loadtest-${PROFILE.toLowerCase()}-report.json`]: JSON.stringify({ profile: PROFILE, vus: VUS[PROFILE], data }, null, 2),
    stdout: `Profil ${PROFILE} (${VUS[PROFILE]} VUs) — p95 lecture : ${m('http_req_duration{kind:read}', 'p(95)').toFixed(0)} ms, 5xx : ${(m('ecarnet_server_errors', 'rate') * 100).toFixed(2)} %, échecs connexion : ${(m('ecarnet_login_failures', 'rate') * 100).toFixed(1)} %, 429 : ${m('ecarnet_throttled_429', 'count')}\n`,
  };
}
