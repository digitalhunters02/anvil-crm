// Selo de plano e "Ver como plano" do Anvil: mapa recurso -> plano mínimo vindo do servidor, bloqueios (402) iguais ao mapa,
// e a prévia do dono da plataforma (OWNER_EMAILS + X-Preview-Plan) que não mexe na assinatura nem na cobrança.
// Precisa de um Postgres local (cria e apaga um banco temporário):
//   TEST_PG_ADMIN_URL=postgres://user:pass@127.0.0.1:5432/postgres node --test server/test/planGates.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..', 'src');
const ADMIN_URL = process.env.TEST_PG_ADMIN_URL;
const DB_NAME = `seloanv_srv_${process.pid}_${Date.now() % 100000}`;
const DB_URL = (ADMIN_URL || '').replace(/\/[^/]*$/, `/${DB_NAME}`);
const OWNER = 'dono@example.test', OWNER_PASS = 'Owner-pass-12345';

// oráculo escrito à mão, de propósito (não lê o mapa do servidor): recurso -> plano mínimo
const ORDER = ['basico', 'essencial', 'completo'];
const MIN = {
  rfqs: 'essencial', purchase_orders: 'essencial', bill_of_materials: 'essencial', work_orders: 'essencial', shipments: 'essencial', reports: 'essencial', inventory: 'essencial',
  mrp: 'completo', job_costing: 'completo', production_calendar: 'completo', quality_inspections: 'completo', automations: 'completo', whatsapp: 'completo',
};
const lockedFor = (plan) => Object.fromEntries(Object.entries(MIN).map(([g, m]) => [g, ORDER.indexOf(m) > ORDER.indexOf(plan)]));
const ROUTE = { rfqs: '/api/rfqs', purchase_orders: '/api/purchase-orders', bill_of_materials: '/api/bill-of-materials', work_orders: '/api/work-orders', shipments: '/api/shipments', reports: '/api/reports', inventory: '/api/inventory', mrp: '/api/mrp', job_costing: '/api/costing', production_calendar: '/api/calendar', quality_inspections: '/api/quality-inspections', automations: '/api/automations', whatsapp: '/api/integrations/whatsapp/status' };

let admin;
const servers = [];
const freePort = () => new Promise((resolve, reject) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); s.on('error', reject); });

async function boot(extra = {}) {
  const port = await freePort();
  const env = { ...process.env, NODE_ENV: 'test', PORT: String(port), DATABASE_URL: DB_URL, JWT_SECRET: 'test-secret-test-secret-123', BOOTSTRAP_OWNER_EMAIL: OWNER, BOOTSTRAP_OWNER_PASSWORD: OWNER_PASS, OWNER_EMAILS: OWNER, FRONTEND_URL: 'http://app.test', SMTP_HOST: '' };
  for (const k of ['LICENSED_PLAN', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_API_BASE']) delete env[k];
  Object.assign(env, extra);
  const proc = spawn('node', [path.join(SRC, 'index.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; proc.stdout.on('data', (d) => { logs += d; }); proc.stderr.on('data', (d) => { logs += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* subindo */ } await new Promise((r) => setTimeout(r, 150)); }
  let n = 0;
  const call = async (method, url, { token, body, headers } = {}) => {
    const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.7.0.${++n}`, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const srv = { call, stop: () => new Promise((resolve) => { proc.once('exit', resolve); proc.kill('SIGTERM'); }), proc, logs: () => logs };
  servers.push(srv);
  srv.owner = (await call('POST', '/api/auth/login', { body: { email: OWNER, password: OWNER_PASS } })).json.token;
  // um funcionário comum (conta que NÃO é do dono da plataforma)
  await call('POST', '/api/accounts', { token: srv.owner, body: { name: 'Comum', email: 'comum@example.test', password: 'Plain-pass-12345' } });
  const c = new pg.Client({ connectionString: DB_URL }); await c.connect();
  await c.query(`UPDATE accounts SET must_change_password = FALSE WHERE email = 'comum@example.test'`); await c.end();
  srv.plain = (await call('POST', '/api/auth/login', { body: { email: 'comum@example.test', password: 'Plain-pass-12345' } })).json.token;
  return srv;
}
async function stop(srv) { await srv.stop(); servers.splice(servers.indexOf(srv), 1); }

before(async () => {
  admin = new pg.Client({ connectionString: ADMIN_URL }); await admin.connect();
  await admin.query(`CREATE DATABASE ${DB_NAME}`);
});
after(async () => {
  for (const s of servers) if (s.proc.exitCode === null && s.proc.signalCode === null) await s.stop();
  await admin.query(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`); await admin.end();
});

const skip = !ADMIN_URL && 'set TEST_PG_ADMIN_URL to run';

for (const plan of ORDER) {
  test(`plano ${plan}: /api/billing/status devolve o mapa certo e as rotas bloqueiam igual`, { skip }, async () => {
    const s = await boot({ LICENSED_PLAN: plan });
    try {
      const st = (await s.call('GET', '/api/billing/status', { token: s.plain })).json;
      assert.equal(st.plan, plan); assert.equal(st.realPlan, plan); assert.equal(st.owner, false); assert.equal(st.previewPlan, null);
      for (const [g, min] of Object.entries(MIN)) {
        assert.equal(st.gates[g].minPlan, min, `minPlan de ${g}`);
        assert.equal(st.gates[g].locked, lockedFor(plan)[g], `locked de ${g} no plano ${plan}`);
      }
      assert.deepEqual(st.catalog.map((p) => p.key), ORDER);
      assert.deepEqual(st.catalog.find((p) => p.key === 'basico').adds, []);
      assert.deepEqual(st.catalog.find((p) => p.key === 'essencial').adds.slice().sort(), Object.keys(MIN).filter((g) => MIN[g] === 'essencial').sort());
      assert.deepEqual(st.catalog.find((p) => p.key === 'completo').adds.slice().sort(), Object.keys(MIN).filter((g) => MIN[g] === 'completo').sort());
      assert.deepEqual(st.catalog.map((p) => p.price.month), [59, 129, 249]);
      const pub = (await s.call('GET', '/api/public/plans')).json;
      assert.deepEqual(pub.catalog, st.catalog); assert.equal('locked' in pub.gates.whatsapp, false); assert.equal(pub.gates.whatsapp.minPlan, 'completo');
      // as rotas seguem o mesmo mapa
      for (const [g, url] of Object.entries(ROUTE)) {
        const r = await s.call('GET', url, { token: s.plain });
        assert.equal(r.status === 402, lockedFor(plan)[g], `${url} no plano ${plan} deu ${r.status}`);
        if (r.status === 402) assert.equal(r.json.requiredPlan, MIN[g]);
      }
    } finally { await stop(s); }
  });
}

test('ver como plano: só o dono da plataforma; o servidor passa a se comportar como o plano escolhido, sem mudar a conta', { skip }, async () => {
  const s = await boot({ LICENSED_PLAN: 'completo' });
  try {
    const asPlan = (token, plan) => s.call('GET', '/api/billing/status', { token, headers: plan ? { 'X-Preview-Plan': plan } : {} });
    for (const plan of ORDER) {
      const st = (await asPlan(s.owner, plan)).json;
      assert.equal(st.owner, true); assert.equal(st.previewPlan, plan); assert.equal(st.plan, plan); assert.equal(st.realPlan, 'completo');
      for (const [g, lk] of Object.entries(lockedFor(plan))) assert.equal(st.gates[g].locked, lk, `${g} vendo como ${plan}`);
      for (const [g, url] of Object.entries(ROUTE)) {
        assert.equal((await s.call('GET', url, { token: s.owner, headers: { 'X-Preview-Plan': plan } })).status === 402, lockedFor(plan)[g], `${url} vendo como ${plan}`);
      }
    }
    const mine = (await asPlan(s.owner)).json;
    assert.equal(mine.plan, 'completo'); assert.equal(mine.previewPlan, null);
    // quem NÃO é dono: o cabeçalho é ignorado
    const other = (await asPlan(s.plain, 'basico')).json;
    assert.equal(other.owner, false); assert.equal(other.previewPlan, null); assert.equal(other.plan, 'completo');
    assert.equal((await s.call('GET', '/api/automations', { token: s.plain, headers: { 'X-Preview-Plan': 'basico' } })).status, 200);
    // plano inventado: ignorado
    assert.equal((await asPlan(s.owner, 'diamante')).json.previewPlan, null);
    // limites de alunos e logins também seguem o plano visto
    const sb = (await asPlan(s.owner, 'basico')).json;
    assert.equal(sb.userLimit, 3);
  } finally { await stop(s); }
});

test('ver como plano nunca cobra nem altera assinatura: checkout, portal e uso extra de foto recusam (409)', { skip }, async () => {
  const s = await boot({ LICENSED_PLAN: 'completo', STRIPE_SECRET_KEY: 'sk_test_fake', STRIPE_API_BASE: 'http://127.0.0.1:1' });
  try {
    const H = { 'X-Preview-Plan': 'basico' };
    for (const [p, body] of [['/api/billing/checkout', { plan: 'essencial' }], ['/api/billing/portal', {}]]) {
      const r = await s.call('POST', p, { token: s.owner, body, headers: H });
      assert.equal(r.status, 409, p); assert.equal(r.json.code, 'preview_readonly');
    }
    const credit = await s.call('PUT', '/api/photo-import/credit', { token: s.owner, body: { enabled: true, accept: true, capCents: 1000 }, headers: H });
    assert.equal(credit.status, 409); assert.equal(credit.json.code, 'preview_readonly');
    // sem a prévia a mesma rota segue o caminho normal (aqui o plano é gerenciado pela Impact Digital: 400, nunca 409)
    const real = await s.call('POST', '/api/billing/checkout', { token: s.owner, body: { plan: 'essencial' } });
    assert.notEqual(real.status, 409);
    const st = (await s.call('GET', '/api/billing/status', { token: s.owner })).json;
    assert.equal(st.previewPlan, null); assert.equal(st.plan, 'completo');
  } finally { await stop(s); }
});
