// Free 3-day trial (POST /api/demo-request): account creation, repeat visitor, real-account clash, rate limit,
// expiry + cleanup, blockDemo on sensitive routes, not counted as staff, and the notice to Harbor.
// Needs a local Postgres; creates (and drops) a throwaway database and runs the real server as a child process.
// Ports 7821-7829 are used on purpose (7821 = fake Harbor).
//   TEST_PG_ADMIN_URL=postgres://test:test@localhost:5432/postgres node --test server/test/demoTrial.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..', 'src');
const ADMIN_URL = process.env.TEST_PG_ADMIN_URL || 'postgres://test:test@localhost:5432/postgres';
const DB_NAME = `anvil_trial_t${process.pid}_${Date.now() % 100000}`;
const DB_URL = ADMIN_URL.replace(/\/[^/]*$/, `/${DB_NAME}`);

const OWNER_EMAIL = 'owner@example.com';
const OWNER_PASS = 'Owner-pass-12345';
const ADMIN_KEY = 'k'.repeat(40);
const BLOCK_MSG = 'Não disponível no teste grátis';
const HARBOR_PORT = 7821;

let admin;
const servers = [];
let harbor;
const harborHits = [];

function startHarborMock() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        harborHits.push({ url: req.url, method: req.method, headers: req.headers, body });
        if (req.url.startsWith('/hang')) return; // never answers
        if (req.url.startsWith('/err')) { res.statusCode = 500; return res.end('boom'); }
        res.setHeader('Content-Type', 'application/json');
        res.end('{"ok":true}');
      });
    });
    srv.listen(HARBOR_PORT, '127.0.0.1', () => resolve(srv));
  });
}

async function startServer(port, extraEnv = {}) {
  const env = {
    ...process.env, NODE_ENV: 'test', PORT: String(port), DATABASE_URL: DB_URL,
    JWT_SECRET: 'test-secret-test-secret-123',
    BOOTSTRAP_OWNER_EMAIL: OWNER_EMAIL, BOOTSTRAP_OWNER_PASSWORD: OWNER_PASS,
    FRONTEND_URL: 'http://app.test', SMTP_HOST: '', ...extraEnv,
  };
  const proc = spawn('node', [path.join(SRC, 'index.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  proc.stdout.on('data', (d) => { logs += d; });
  proc.stderr.on('data', (d) => { logs += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`${base}/api/health`); if (r.ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  const srv = {
    base, proc, logs: () => logs,
    stop: () => new Promise((resolve) => { proc.once('exit', resolve); proc.kill('SIGTERM'); }),
    async call(method, url, { token, body, headers } = {}) {
      const r = await fetch(base + url, {
        method,
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await r.text();
      let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
      return { status: r.status, json, text, headers: r.headers };
    },
  };
  servers.push(srv);
  return srv;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  harbor = await startHarborMock();
  admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${DB_NAME}`);
  const seed = spawnSync('node', [path.join(SRC, 'seed.js')], { env: { ...process.env, DATABASE_URL: DB_URL }, encoding: 'utf8' });
  assert.equal(seed.status, 0, seed.stderr);
});

after(async () => {
  for (const s of servers) if (s.proc.exitCode === null && s.proc.signalCode === null) await s.stop();
  harbor?.closeAllConnections?.();
  harbor?.close();
  await dbc?.end();
  await admin.query(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`);
  await admin.end();
});

// The admin client is connected to the maintenance database; talk to the test database with its own client.
let dbc;
async function q(sql, params = []) {
  if (!dbc) { dbc = new pg.Client({ connectionString: DB_URL }); await dbc.connect(); }
  return (await dbc.query(sql, params)).rows;
}

let main;
let ownerToken;
let trial;

test('boots (migration adds the trial columns) and the owner can sign in', async () => {
  main = await startServer(7822, { HARBOR_API_URL: `http://127.0.0.1:${HARBOR_PORT}/ok`, ADMIN_SUMMARY_KEY: ADMIN_KEY, DEMO_REQUEST_MAX: '100' });
  const cols = await q(`SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts' AND column_name IN ('is_demo_trial','demo_expires_at')`);
  assert.equal(cols.length, 2);
  const r = await main.call('POST', '/api/auth/login', { body: { email: OWNER_EMAIL, password: OWNER_PASS } });
  assert.equal(r.status, 200);
  ownerToken = r.json.token;
  assert.equal(r.json.account.isDemoTrial, false);
});

test('valid request creates a staff trial account and returns a working token', async () => {
  const r = await main.call('POST', '/api/demo-request', { body: { name: '  Maria Teste ', email: ' Maria@Example.com ' } });
  assert.equal(r.status, 201, r.text);
  assert.ok(r.json.token);
  assert.equal(r.json.account.email, 'maria@example.com');
  assert.equal(r.json.account.name, 'Maria Teste');
  assert.equal(r.json.account.role, 'staff');
  assert.equal(r.json.account.isDemoTrial, true);
  assert.equal(r.json.account.password_hash, undefined);
  const days = (new Date(r.json.account.demoExpiresAt) - Date.now()) / 86400000;
  assert.ok(days > 2.99 && days <= 3.001, `expires in ${days} days`);
  trial = r.json;
  const me = await main.call('GET', '/api/auth/me', { token: trial.token });
  assert.equal(me.status, 200);
  assert.equal(me.json.account.isDemoTrial, true);
  const row = (await q(`SELECT is_demo_trial, demo_expires_at, role FROM accounts WHERE lower(email) = 'maria@example.com'`))[0];
  assert.equal(row.is_demo_trial, true);
  assert.equal(row.role, 'staff');
});

test('the same person coming back mid-trial gets the same account and the clock is not restarted', async () => {
  const before = (await q(`SELECT id, demo_expires_at FROM accounts WHERE lower(email) = 'maria@example.com'`))[0];
  await wait(1100);
  const r = await main.call('POST', '/api/demo-request', { body: { name: 'Maria', email: 'MARIA@example.com' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.account.id, before.id);
  const after = (await q(`SELECT id, demo_expires_at FROM accounts WHERE lower(email) = 'maria@example.com'`))[0];
  assert.equal(new Date(after.demo_expires_at).getTime(), new Date(before.demo_expires_at).getTime());
  assert.equal((await q(`SELECT COUNT(*)::int AS n FROM accounts WHERE lower(email) = 'maria@example.com'`))[0].n, 1);
});

test('a real account email gets 409; bad input gets 400', async () => {
  const r = await main.call('POST', '/api/demo-request', { body: { name: 'Fake Owner', email: OWNER_EMAIL } });
  assert.equal(r.status, 409);
  assert.equal(r.json.code, 'email_in_use');
  // the real account was not touched
  const own = (await q(`SELECT is_demo_trial FROM accounts WHERE lower(email) = $1`, [OWNER_EMAIL]))[0];
  assert.equal(own.is_demo_trial, false);
  assert.equal((await main.call('POST', '/api/demo-request', { body: { name: 'X', email: 'not-an-email' } })).status, 400);
  assert.equal((await main.call('POST', '/api/demo-request', { body: { name: 'X', email: 'a@b' } })).status, 400);
  assert.equal((await main.call('POST', '/api/demo-request', { body: { name: '', email: 'x@example.com' } })).status, 400);
  assert.equal((await main.call('POST', '/api/demo-request', { body: { name: 'X' } })).status, 400);
  assert.equal((await main.call('POST', '/api/demo-request', { body: {} })).status, 400);
});

test('a trial login cannot be used with a password and password recovery does not touch it', async () => {
  const login = await main.call('POST', '/api/auth/login', { body: { email: 'maria@example.com', password: 'anything-at-all-1' } });
  assert.equal(login.status, 401);
  const forgot = await main.call('POST', '/api/auth/forgot', { body: { email: 'maria@example.com' } });
  assert.equal(forgot.status, 200);
  const row = (await q(`SELECT reset_token_hash FROM accounts WHERE lower(email) = 'maria@example.com'`))[0];
  assert.equal(row.reset_token_hash, null);
});

test('blockDemo: sensitive routes answer 403 with the trial message; read routes stay open', async () => {
  const blocked = [
    ['POST', '/api/integrations/whatsapp/send', { to: '+15550000000', text: 'hi' }],
    ['GET', '/api/integrations/whatsapp/conversations'],
    ['GET', '/api/integrations/whatsapp/conversations/+15550000000'],
    ['POST', '/api/integrations/whatsapp/connect', { phoneNumberId: '1', accessToken: 'x' }],
    ['POST', '/api/integrations/whatsapp/disconnect', {}],
    ['POST', '/api/photo-import', {}],
    ['GET', '/api/photo-import/status'],
    ['PUT', '/api/photo-import/credit', {}],
    ['POST', '/api/auth/change-password', { currentPassword: 'a', newPassword: 'bbbbbbbbb' }],
    ['GET', '/api/accounts'],
    ['POST', '/api/accounts', { name: 'N', email: 'n@example.com', password: 'Temp-pass-1234' }],
    ['POST', '/api/accounts/1/reset-password', { password: 'Temp-pass-1234' }],
    ['DELETE', '/api/accounts/1'],
    ['POST', '/api/billing/checkout', { plan: 'basico' }],
    ['POST', '/api/billing/portal', {}],
  ];
  for (const [m, u, body] of blocked) {
    const r = await main.call(m, u, { token: trial.token, body });
    assert.equal(r.status, 403, `${m} ${u} -> ${r.status} ${r.text}`);
  }
  // The ones that are not owner-only answer with the trial message itself.
  for (const [m, u, body] of blocked.filter(([, u]) => /whatsapp\/(send|conversations)|photo-import|change-password/.test(u))) {
    const r = await main.call(m, u, { token: trial.token, body });
    assert.equal(r.json.error, BLOCK_MSG, `${m} ${u}`);
    assert.equal(r.json.code, 'demo_blocked');
  }
  const open = ['/api/customers', '/api/dashboard', '/api/rfqs', '/api/quotes', '/api/invoices', '/api/work-orders', '/api/inventory', '/api/reports',
    '/api/users', '/api/suppliers', '/api/activities', '/api/billing/status', '/api/integrations/whatsapp/status', '/api/auth/me'];
  for (const u of open) {
    const r = await main.call('GET', u, { token: trial.token });
    assert.equal(r.status, 200, `GET ${u} -> ${r.status} ${r.text}`);
  }
  // The real owner is not affected.
  const conv = await main.call('GET', '/api/integrations/whatsapp/conversations', { token: ownerToken });
  assert.equal(conv.status, 200);
  assert.equal((await main.call('GET', '/api/accounts', { token: ownerToken })).status, 200);
});

test('trial accounts are not listed as staff, not counted in billing status nor in admin-summary', async () => {
  const list = await main.call('GET', '/api/accounts', { token: ownerToken });
  assert.deepEqual(list.json.map((a) => a.email), [OWNER_EMAIL]);
  const st = await main.call('GET', '/api/billing/status', { token: ownerToken });
  assert.equal(st.json.users, 1);
  const sum = await main.call('GET', '/api/admin-summary', { headers: { 'x-admin-key': ADMIN_KEY } });
  assert.equal(sum.status, 200);
  assert.equal(sum.json.accounts, 1);
  assert.ok((await q(`SELECT COUNT(*)::int AS n FROM accounts`))[0].n >= 2, 'the trial account does exist in the table');
});

test('Harbor is told with the right key, product, source, exact notes and clean attribution (never a password or token)', async () => {
  harborHits.length = 0;
  const r = await main.call('POST', '/api/demo-request', {
    body: {
      name: 'Joao Anuncio', email: 'joao@example.com',
      attribution: { utm_source: 'facebook', utm_medium: 'paid', utm_campaign: 'anvil-oct', utm_content: 'video1', utm_term: ' shop ', fbclid: 'AbC123',
        evil: 'x', password: 'secret', utm_x: 'y', utm_source2: 'z' },
    },
  });
  assert.equal(r.status, 201);
  for (let i = 0; i < 40 && !harborHits.length; i++) await wait(50);
  assert.equal(harborHits.length, 1);
  const h = harborHits[0];
  assert.equal(h.method, 'POST');
  assert.equal(h.url, '/ok/api/public/leads');
  assert.equal(h.headers['x-capture-key'], ADMIN_KEY);
  const b = JSON.parse(h.body);
  assert.equal(b.product, 'Anvil');
  assert.equal(b.source, 'Trial signup');
  assert.equal(b.notes, '3-day demo trial (demo-request)');
  assert.equal(b.name, 'Joao Anuncio');
  assert.equal(b.email, 'joao@example.com');
  assert.deepEqual(
    { s: b.utm_source, m: b.utm_medium, c: b.utm_campaign, ct: b.utm_content, t: b.utm_term, f: b.fbclid },
    { s: 'facebook', m: 'paid', c: 'anvil-oct', ct: 'video1', t: 'shop', f: 'AbC123' },
  );
  for (const bad of ['evil', 'password', 'utm_x', 'utm_source2', 'token', 'password_hash']) assert.equal(bad in b, false, bad);
  assert.ok(!h.body.includes(r.json.token), 'token must not be sent');
  assert.ok(!h.body.includes('secret'));
  // long attribution values are cut
  harborHits.length = 0;
  await main.call('POST', '/api/demo-request', { body: { name: 'Long', email: 'long@example.com', attribution: { utm_source: 'a'.repeat(500), fbclid: 42 } } });
  for (let i = 0; i < 40 && !harborHits.length; i++) await wait(50);
  const b2 = JSON.parse(harborHits[0].body);
  assert.equal(b2.utm_source.length, 120);
  assert.equal('fbclid' in b2, false);
  // The mid-trial repeat does not warn Harbor again
  harborHits.length = 0;
  await main.call('POST', '/api/demo-request', { body: { name: 'Joao', email: 'joao@example.com' } });
  await wait(300);
  assert.equal(harborHits.length, 0);
});

test('Harbor down, erroring or hanging never breaks (or delays) the signup; no secret in the logs', async () => {
  const cases = [
    ['down', 'http://127.0.0.1:7829'],
    ['500', `http://127.0.0.1:${HARBOR_PORT}/err`],
    ['hang', `http://127.0.0.1:${HARBOR_PORT}/hang`],
  ];
  let port = 7823;
  for (const [label, url] of cases) {
    const s = await startServer(port++, { HARBOR_API_URL: url, ADMIN_SUMMARY_KEY: ADMIN_KEY });
    const t0 = Date.now();
    const r = await s.call('POST', '/api/demo-request', { body: { name: 'Offline', email: `offline-${label}@example.com` } });
    assert.equal(r.status, 201, `${label}: ${r.text}`);
    assert.ok(Date.now() - t0 < 2500, `${label}: signup took ${Date.now() - t0} ms`);
    assert.ok(r.json.token);
    await wait(400);
    assert.ok(!s.logs().includes(ADMIN_KEY), `${label}: key leaked in logs`);
    assert.ok(!s.logs().includes(r.json.token), `${label}: token leaked in logs`);
    await s.stop();
  }
  // Without HARBOR_API_URL at all
  const s = await startServer(port++, { HARBOR_API_URL: '', ADMIN_SUMMARY_KEY: '' });
  assert.equal((await s.call('POST', '/api/demo-request', { body: { name: 'No Harbor', email: 'noharbor@example.com' } })).status, 201);
  await s.stop();
});

test('an expired trial is refused (401, clear message); asking again recreates it; the cleanup deletes it', async () => {
  await q(`UPDATE accounts SET demo_expires_at = now() - interval '1 minute' WHERE lower(email) = 'maria@example.com'`);
  const me = await main.call('GET', '/api/auth/me', { token: trial.token });
  assert.equal(me.status, 401);
  assert.equal(me.json.code, 'trial_expired');
  assert.match(me.json.error, /trial has ended/i);
  assert.equal((await main.call('GET', '/api/customers', { token: trial.token })).status, 401);

  // Not yet swept: asking again starts a fresh 3 days on a new account.
  const again = await main.call('POST', '/api/demo-request', { body: { name: 'Maria', email: 'maria@example.com' } });
  assert.equal(again.status, 201);
  const oldId = trial.account.id;
  assert.notEqual(again.json.account.id, oldId);
  assert.equal((await main.call('GET', '/api/auth/me', { token: trial.token })).status, 401, 'the old token stays dead');
  assert.equal((await main.call('GET', '/api/auth/me', { token: again.json.token })).status, 200);

  // Cleanup: expired trials are deleted, live trials and real accounts stay.
  await q(`UPDATE accounts SET demo_expires_at = now() - interval '1 hour' WHERE lower(email) IN ('maria@example.com','joao@example.com')`);
  process.env.DATABASE_URL = DB_URL;
  const { cleanupExpiredDemoTrials } = await import('../src/demoTrial.js');
  const db = await import('../src/db.js');
  const n = await cleanupExpiredDemoTrials();
  assert.equal(n, 2);
  const left = (await q(`SELECT lower(email) AS e, is_demo_trial FROM accounts ORDER BY id`)).map((r) => r.e);
  assert.ok(!left.includes('maria@example.com') && !left.includes('joao@example.com'));
  assert.ok(left.includes(OWNER_EMAIL), 'the real account stays');
  assert.ok(left.includes('long@example.com'), 'a trial that has not ended stays');
  assert.equal(await cleanupExpiredDemoTrials(), 0);
  await db.default.end();
});

test('rate limit: the 6th request from one IP in the window is 429', async () => {
  const s = await startServer(7826);
  const codes = [];
  for (let i = 0; i < 7; i++) {
    const r = await s.call('POST', '/api/demo-request', { body: { name: `Rate ${i}`, email: `rate${i}@example.com` } });
    codes.push(r.status);
  }
  assert.deepEqual(codes, [201, 201, 201, 201, 201, 429, 429]);
  await s.stop();
});

test('trial logins do not count against the plan user limit (Essential plan: 3 logins)', async () => {
  const s = await startServer(7827, { LICENSED_PLAN: 'basico' });
  const login = await s.call('POST', '/api/auth/login', { body: { email: OWNER_EMAIL, password: OWNER_PASS } });
  const tok = login.json.token;
  assert.equal((await s.call('GET', '/api/billing/status', { token: tok })).json.userLimit, 3);
  // Four trial accounts already exist (long, offline-*, rate*, ... ) – the owner can still add real staff up to the limit.
  const trials = (await q(`SELECT COUNT(*)::int AS n FROM accounts WHERE is_demo_trial`))[0].n;
  assert.ok(trials >= 3, `trials in table: ${trials}`);
  const mk = (i) => s.call('POST', '/api/accounts', { token: tok, body: { name: `Staff ${i}`, email: `staff${i}@example.com`, password: 'Temp-pass-1234' } });
  assert.equal((await mk(1)).status, 201);
  assert.equal((await mk(2)).status, 201);
  const third = await mk(3);
  assert.equal(third.status, 402);
  assert.equal(third.json.code, 'user_limit');
  assert.equal((await s.call('GET', '/api/billing/status', { token: tok })).json.users, 3);
  await s.stop();
});
