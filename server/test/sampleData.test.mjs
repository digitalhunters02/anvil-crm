// sampleData.test.mjs
// PARA QUE SERVE: prova as regras de segurança dos dados de exemplo (server/src/sampleData.js):
//  carregar cria registros marcados is_sample; carregar de novo (e carregar ao mesmo tempo) não duplica; remover apaga SÓ os de
//  exemplo e mantém registros reais (inclusive os que dependem de um exemplo); não carrega com dado real; SEED_SAMPLE_DATA e o
//  comando de linha seguem as mesmas regras; só o dono mexe; a conta do teste grátis enxerga os exemplos; as datas são relativas
//  a hoje e acompanham o calendário.
// Precisa de Postgres local. Cria (e apaga) um banco só dele e roda o servidor real como processo filho, em portas livres.
//   TEST_PG_ADMIN_URL=postgres://test:test@127.0.0.1:5432/postgres node --test server/test/sampleData.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..', 'src');
const ADMIN_URL = process.env.TEST_PG_ADMIN_URL || 'postgres://test:test@localhost:5432/postgres';
const DB_NAME = `anvil_sample_t${process.pid}_${Date.now() % 100000}`;
const DB_URL = ADMIN_URL.replace(/\/[^/]*$/, `/${DB_NAME}`);
const OWNER_EMAIL = 'owner@example.test';
const OWNER_PASS = 'Owner-pass-12345';
const TABLES = [
  'users', 'customers', 'rfqs', 'quotes', 'bill_of_materials', 'suppliers', 'purchase_orders', 'work_orders',
  'quality_inspections', 'shipments', 'invoices', 'activities', 'automations', 'inventory_items', 'stock_moves', 'work_order_labor',
];

let admin;
let dbc;
const servers = [];

const freePort = () => new Promise((resolve) => {
  const s = net.createServer();
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

async function startServer(extraEnv = {}) {
  const port = await freePort();
  const env = {
    ...process.env, NODE_ENV: 'test', PORT: String(port), DATABASE_URL: DB_URL, JWT_SECRET: 'test-secret-test-secret-123',
    BOOTSTRAP_OWNER_EMAIL: OWNER_EMAIL, BOOTSTRAP_OWNER_PASSWORD: OWNER_PASS, FRONTEND_URL: 'http://app.test',
    SMTP_HOST: '', DEMO_REQUEST_MAX: '100', ...extraEnv,
  };
  for (const k of ['STRIPE_SECRET_KEY', 'LICENSED_PLAN', 'SEED_SAMPLE_DATA', 'ANTHROPIC_API_KEY']) if (!(k in extraEnv)) delete env[k];
  const proc = spawn('node', [path.join(SRC, 'index.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  proc.stdout.on('data', (d) => { logs += d; });
  proc.stderr.on('data', (d) => { logs += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  const srv = {
    base, proc, logs: () => logs,
    stop: () => new Promise((resolve) => { proc.once('exit', resolve); proc.kill('SIGTERM'); }),
    async call(method, url, { token, body } = {}) {
      const r = await fetch(base + url, {
        method,
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await r.text();
      let json = null; try { json = JSON.parse(text); } catch { /* não é json */ }
      return { status: r.status, json, text };
    },
  };
  servers.push(srv);
  return srv;
}

async function q(sql, params = []) {
  if (!dbc) { dbc = new pg.Client({ connectionString: DB_URL }); await dbc.connect(); }
  return (await dbc.query(sql, params)).rows;
}
const count = async (table, where = 'TRUE') => (await q(`SELECT COUNT(*)::int AS n FROM ${table} WHERE ${where}`))[0].n;
const sampleTotal = async () => { let n = 0; for (const t of TABLES) n += await count(t, 'is_sample'); return n; };
const resetData = () => q(`TRUNCATE ${TABLES.join(', ')}, sample_data_meta RESTART IDENTITY CASCADE`);
const todayISO = () => new Date().toISOString().slice(0, 10);

before(async () => {
  admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${DB_NAME}`);
});

after(async () => {
  for (const s of servers) if (s.proc.exitCode === null && s.proc.signalCode === null) await s.stop();
  await dbc?.end();
  await admin.query(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`);
  await admin.end();
});

let srv;
let owner;

test('desligado por padrão: o servidor sobe numa base vazia e NÃO carrega exemplo sozinho', async () => {
  srv = await startServer();
  const r = await srv.call('POST', '/api/auth/login', { body: { email: OWNER_EMAIL, password: OWNER_PASS } });
  assert.equal(r.status, 200);
  owner = r.json.token;
  assert.equal(await sampleTotal(), 0);
  assert.equal(await count('customers'), 0);
  const st = await srv.call('GET', '/api/sample-data/status', { token: owner });
  assert.equal(st.status, 200);
  assert.deepEqual({ loaded: st.json.loaded, total: st.json.total, canLoad: st.json.canLoad, hasRealData: st.json.hasRealData, bootFlag: st.json.bootFlag },
    { loaded: false, total: 0, canLoad: true, hasRealData: false, bootFlag: false });
});

test('só o dono mexe: sem login, equipe comum e conta do teste grátis são recusadas (e nada é carregado)', async () => {
  for (const [method, url] of [['GET', '/api/sample-data/status'], ['POST', '/api/sample-data/load'], ['POST', '/api/sample-data/remove']]) {
    assert.equal((await srv.call(method, url)).status, 401, `${method} ${url} sem login`);
  }
  const mk = await srv.call('POST', '/api/accounts', { token: owner, body: { name: 'Staff One', email: 'staff1@example.test', password: 'Staff-pass-12345' } });
  assert.equal(mk.status, 201);
  const staff = (await srv.call('POST', '/api/auth/login', { body: { email: 'staff1@example.test', password: 'Staff-pass-12345' } })).json.token;
  const trial = (await srv.call('POST', '/api/demo-request', { body: { name: 'Visitor', email: 'visitor@example.test' } })).json.token;
  for (const token of [staff, trial]) {
    for (const [method, url] of [['GET', '/api/sample-data/status'], ['POST', '/api/sample-data/load'], ['POST', '/api/sample-data/remove']]) {
      assert.equal((await srv.call(method, url, { token })).status, 403, `${method} ${url} sem ser dono`);
    }
  }
  assert.equal(await sampleTotal(), 0);
});

test('carregar cria os registros, todos marcados is_sample, em todas as tabelas', async () => {
  const r = await srv.call('POST', '/api/sample-data/load', { token: owner });
  assert.equal(r.status, 201);
  assert.equal(r.json.already, false);
  assert.ok(r.json.created > 150, `criou ${r.json.created}`);
  for (const t of TABLES) {
    assert.ok(await count(t, 'is_sample') > 0, `${t} tem exemplo`);
    assert.equal(await count(t, 'NOT is_sample'), 0, `${t} não tem linha sem marca`);
  }
  assert.equal(await count('customers', 'is_sample'), 9);
  assert.equal((await q('SELECT anchor_date FROM sample_data_meta'))[0].anchor_date, todayISO());
  assert.equal(r.json.status.loaded, true);
  assert.equal(r.json.status.canLoad, false);
});

test('dados de exemplo são fictícios: e-mails example.test, telefones 555-01xx', async () => {
  const emails = [...(await q('SELECT email AS e FROM users')), ...(await q('SELECT contact_email AS e FROM customers')), ...(await q('SELECT contact_email AS e FROM suppliers'))];
  assert.ok(emails.length >= 20);
  for (const { e } of emails) assert.match(e, /@example\.test$/);
  const phones = [...(await q('SELECT contact_phone AS p FROM customers')), ...(await q('SELECT contact_phone AS p FROM suppliers'))];
  for (const { p } of phones) assert.match(p, /555-01\d\d$/, p);
});

test('carregar de novo não duplica (inclusive vários cliques ao mesmo tempo)', async () => {
  const before = {};
  for (const t of TABLES) before[t] = await count(t);
  const again = await srv.call('POST', '/api/sample-data/load', { token: owner });
  assert.equal(again.status, 200);
  assert.equal(again.json.already, true);
  assert.equal(again.json.created, 0);
  const burst = await Promise.all([1, 2, 3, 4].map(() => srv.call('POST', '/api/sample-data/load', { token: owner })));
  assert.ok(burst.every((x) => x.status === 200 && x.json.already === true));
  for (const t of TABLES) assert.equal(await count(t), before[t], `${t} não mudou`);
});

test('clique duplo numa base vazia: só um carrega, o resto vê "já carregado"', async () => {
  assert.equal((await srv.call('POST', '/api/sample-data/remove', { token: owner })).status, 200);
  assert.equal(await sampleTotal(), 0);
  const burst = await Promise.all([1, 2, 3, 4].map(() => srv.call('POST', '/api/sample-data/load', { token: owner })));
  assert.equal(burst.filter((x) => x.status === 201).length, 1);
  assert.equal(burst.filter((x) => x.status === 200 && x.json.already === true).length, 3);
  assert.equal(await count('customers'), 9);
  assert.equal(await count('work_orders'), 13);
});

test('as telas principais têm o que mostrar e as datas são relativas a hoje', async () => {
  const get = async (url) => { const r = await srv.call('GET', url, { token: owner }); assert.equal(r.status, 200, url); return r.json; };
  const dash = await get('/api/dashboard');
  assert.ok(dash.kpis.openRfqs > 0 && dash.kpis.quotesAwaiting > 0 && dash.kpis.workOrdersInProduction > 0 && dash.kpis.posAwaitingDelivery > 0);
  assert.ok(dash.kpis.revenueThisMonth > 0, 'receita do mês > 0 (cartão do Painel)');
  assert.ok(dash.workOrdersByStatus.length >= 6 && dash.workOrdersDueSoon.length > 0 && dash.recentActivity.length > 0 && dash.posAwaiting.length > 0);
  const rep = await get('/api/reports');
  assert.ok(rep.revenueByMonth.length >= 3 && rep.inspectionResults.length === 3 && rep.revenueByCustomer.some((c) => c.revenue > 0));
  assert.ok(rep.winRate > 0 && rep.winRate < 100 && rep.onTimeDeliveryRate > 0 && rep.onTimeDeliveryRate < 100);
  const inv = await get('/api/inventory');
  assert.equal(inv.length, 10);
  assert.ok(inv.some((i) => i.low) && inv.some((i) => !i.low) && inv.some((i) => i.tracking === 'lot'));
  const lot = await get('/api/inventory/trace?lot=HT-5531');
  assert.ok(lot.received > 0 && lot.used > 0 && lot.moves.some((m) => m.work_order_number));
  const sh = await get('/api/mrp/shortages');
  assert.ok(sh.rows.length >= 3 && sh.total > 0 && sh.unmatched.length >= 1, JSON.stringify(sh).slice(0, 600));
  const cost = await get('/api/costing');
  assert.ok(cost.rows.length >= 10 && cost.totals.revenue > 0 && cost.rows.some((r) => r.labor > 0) && cost.rows.some((r) => r.materials_basis === 'actual'));
  const cal = await get('/api/calendar');
  assert.equal(cal.today, todayISO());
  assert.ok(cal.items.length >= 8 && cal.items.some((i) => i.overdue) && cal.items.some((i) => i.due_date > cal.today));
  for (const [url, min] of [['/api/customers', 9], ['/api/rfqs', 12], ['/api/quotes', 10], ['/api/bill-of-materials', 20], ['/api/suppliers', 6], ['/api/purchase-orders', 9],
    ['/api/work-orders', 12], ['/api/quality-inspections', 8], ['/api/shipments', 5], ['/api/invoices', 9], ['/api/automations', 6], ['/api/activities', 12], ['/api/users', 6]]) {
    assert.ok((await get(url)).length >= min, `${url} tem pelo menos ${min}`);
  }
  // datas relativas: nada de calendário fixo no passado distante, e há trabalho recente e futuro
  const newest = (await q(`SELECT MAX(received_date) AS d FROM rfqs`))[0].d;
  assert.ok((Date.parse(todayISO()) - Date.parse(newest)) / 864e5 <= 5, `cotação mais nova de ${newest}`);
  const openDue = await q(`SELECT MAX(due_date) AS d FROM work_orders WHERE status <> 'Completed'`);
  assert.ok(openDue[0].d > todayISO());
});

test('a conta do teste grátis enxerga (e usa) os dados de exemplo', async () => {
  const trial = (await srv.call('POST', '/api/demo-request', { body: { name: 'Visitor Two', email: 'visitor2@example.test' } })).json.token;
  const customers = await srv.call('GET', '/api/customers', { token: trial });
  assert.equal(customers.status, 200);
  assert.ok(customers.json.some((c) => c.name === 'Ridgeline Bridge & Steel'));
  const dash = await srv.call('GET', '/api/dashboard', { token: trial });
  assert.ok(dash.json.kpis.revenueThisMonth > 0 && dash.json.recentActivity.length > 0);
  assert.equal((await srv.call('GET', '/api/inventory', { token: trial })).json.length, 10);
  assert.ok((await srv.call('GET', '/api/calendar', { token: trial })).json.items.length > 0);
  // escreve nos dados de exemplo como antes
  const c = customers.json[0];
  const put = await srv.call('PUT', `/api/customers/${c.id}`, { token: trial, body: { ...c, notes: 'Updated during the free trial.' } });
  assert.equal(put.status, 200);
  assert.equal(put.json.notes, 'Updated during the free trial.');
});

test('remover apaga SÓ o de exemplo: registros reais ficam, e o exemplo que um dado real usa também', async () => {
  // dado REAL criado pelo app: um cliente, um fornecedor, um item de estoque e uma RFQ para um cliente de exemplo
  const users = (await srv.call('GET', '/api/users', { token: owner })).json;
  const sampleCustomers = (await srv.call('GET', '/api/customers', { token: owner })).json;
  const person = users[0];
  const realCustomer = await srv.call('POST', '/api/customers', { token: owner, body: { name: 'Real Welding Co', industry: 'Fabrication', address: '1 Main St', city: 'Gary', state: 'IN', contact_name: 'Real Person', contact_email: 'real@example.test', contact_phone: '(219) 555-0100', owner_user_id: person.id, status: 'Active' } });
  assert.equal(realCustomer.status, 201);
  const realSupplier = await srv.call('POST', '/api/suppliers', { token: owner, body: { name: 'Real Metals Inc', specialty: 'Steel', contact_name: 'R', contact_email: 'r@example.test', contact_phone: '(219) 555-0101', lead_time_days: 3 } });
  assert.equal(realSupplier.status, 201);
  const realItem = await srv.call('POST', '/api/inventory', { token: owner, body: { sku: 'REAL-001', name: 'Real Item', uom: 'ea', min_stock: 1, unit_cost: 5, opening_qty: 7 } });
  assert.equal(realItem.status, 201);
  const usedCustomer = sampleCustomers.find((c) => c.name === 'Prairie Crest Grain Systems');
  const realRfq = await srv.call('POST', '/api/rfqs', { token: owner, body: { customer_id: usedCustomer.id, title: 'Real RFQ on a sample customer', due_date: '2030-01-01', status: 'New', owner_user_id: person.id, received_date: '2029-12-01' } });
  assert.equal(realRfq.status, 201, realRfq.text);

  const r = await srv.call('POST', '/api/sample-data/remove', { token: owner });
  assert.equal(r.status, 200);
  assert.ok(r.json.removed > 150);
  assert.ok(r.json.kept >= 2, `ficaram ${r.json.kept}`);

  // tudo que era real continua
  assert.equal(await count('customers', `name = 'Real Welding Co' AND NOT is_sample`), 1);
  assert.equal(await count('suppliers', `name = 'Real Metals Inc' AND NOT is_sample`), 1);
  assert.equal(await count('inventory_items', `sku = 'REAL-001' AND NOT is_sample`), 1);
  assert.equal(await count('stock_moves', `item_id = ${realItem.json.id} AND NOT is_sample`), 1);
  assert.equal(await count('rfqs', `id = ${realRfq.json.id} AND NOT is_sample`), 1);
  // o cliente de exemplo que a RFQ real usa ficou; os outros foram embora
  assert.equal(await count('customers', `id = ${usedCustomer.id}`), 1);
  assert.equal(await count('customers', 'is_sample'), 1);
  // a conta (login) do dono não é dado de exemplo e continua
  assert.equal(await count('accounts', `lower(email) = '${OWNER_EMAIL}'`), 1);
  // não sobrou nenhum exemplo "solto" (todo exemplo que ficou é pai de algo real)
  assert.equal(await count('work_orders'), 0);
  assert.equal(await count('invoices'), 0);
  assert.equal(await count('automations'), 0);

  // remover de novo não apaga nada a mais
  const again = await srv.call('POST', '/api/sample-data/remove', { token: owner });
  assert.equal(again.json.removed, 0);
  assert.equal(await count('customers', `name = 'Real Welding Co'`), 1);

  // sem a RFQ real, só falta o responsável de exemplo do cliente real (um dado real ainda o usa): ele fica
  assert.equal((await srv.call('DELETE', `/api/rfqs/${realRfq.json.id}`, { token: owner })).status, 204);
  const mid = await srv.call('POST', '/api/sample-data/remove', { token: owner });
  assert.equal(mid.json.kept, 1);
  assert.equal(await count('users', 'is_sample'), 1);
  assert.equal(await count('customers', 'is_sample'), 0);
  // sem o cliente real, o resto do exemplo também sai (e a marca de datas some)
  assert.equal((await srv.call('DELETE', `/api/customers/${realCustomer.json.id}`, { token: owner })).status, 204);
  const last = await srv.call('POST', '/api/sample-data/remove', { token: owner });
  assert.equal(last.json.kept, 0);
  assert.equal(await sampleTotal(), 0);
  assert.equal((await q('SELECT COUNT(*)::int AS n FROM sample_data_meta'))[0].n, 0);
  // o fornecedor e o item de estoque reais nunca foram tocados
  assert.equal(await count('suppliers', `name = 'Real Metals Inc' AND NOT is_sample`), 1);
  assert.equal(await count('inventory_items', `sku = 'REAL-001' AND NOT is_sample`), 1);
});

test('NÃO carrega em instalação com dado real (botão e comando), e nada é mexido', async () => {
  // a base tem um fornecedor e um item de estoque reais (resto do teste anterior); carregar tem de ser recusado
  assert.ok(await count('suppliers', 'NOT is_sample') >= 1);
  const r = await srv.call('POST', '/api/sample-data/load', { token: owner });
  assert.equal(r.status, 409);
  assert.equal(r.json.code, 'sample_has_real_data');
  assert.equal(await sampleTotal(), 0);
  const st = await srv.call('GET', '/api/sample-data/status', { token: owner });
  assert.equal(st.json.hasRealData, true);
  assert.equal(st.json.canLoad, false);
  const cli = spawnSync('node', [path.join(SRC, 'sampleDataCli.js'), 'load'], { env: { ...process.env, DATABASE_URL: DB_URL }, encoding: 'utf8' });
  assert.equal(cli.status, 3, cli.stderr);
  assert.match(cli.stderr, /real data/);
  assert.equal(await sampleTotal(), 0);
  // um item de estoque real sozinho (sem cliente real) também conta como dado real
  await resetData();
  await q(`INSERT INTO inventory_items (sku, name, created_at) VALUES ('ONLY-REAL', 'Only real item', '2030-01-01')`);
  const r2 = await srv.call('POST', '/api/sample-data/load', { token: owner });
  assert.equal(r2.status, 409);
  assert.equal(await sampleTotal(), 0);
});

test('SEED_SAMPLE_DATA=true no boot: carrega só base sem dado real, e reiniciar não duplica', async () => {
  await resetData();
  await srv.stop();
  // 1) base vazia + chavinha ligada: carrega
  const on = await startServer({ SEED_SAMPLE_DATA: 'true' });
  assert.equal(await count('customers', 'is_sample'), 9, on.logs());
  assert.match(on.logs(), /loaded \d+ sample records/);
  const total = await sampleTotal();
  const st = await on.call('GET', '/api/sample-data/status', { token: (await on.call('POST', '/api/auth/login', { body: { email: OWNER_EMAIL, password: OWNER_PASS } })).json.token });
  assert.equal(st.json.bootFlag, true);
  await on.stop();
  // 2) reinicia com a chavinha ainda ligada: não duplica
  const again = await startServer({ SEED_SAMPLE_DATA: '1' });
  assert.equal(await sampleTotal(), total);
  assert.match(again.logs(), /already loaded/);
  await again.stop();
  // 3) base com cliente real + chavinha ligada: NÃO carrega
  await resetData();
  await q(`INSERT INTO users (name, email, role, initials, color) VALUES ('Real User', 'real.user@example.test', 'Owner', 'RU', '#000')`);
  await q(`INSERT INTO customers (name, industry, address, city, state, contact_name, contact_email, contact_phone, owner_user_id, status)
           SELECT 'Existing Real Customer', 'Steel', '1 St', 'Gary', 'IN', 'P', 'p@example.test', '(219) 555-0102', id, 'Active' FROM users LIMIT 1`);
  const guarded = await startServer({ SEED_SAMPLE_DATA: 'true' });
  assert.equal(await sampleTotal(), 0);
  assert.equal(await count('customers'), 1);
  assert.match(guarded.logs(), /already has real data/);
  await guarded.stop();
  // 4) chavinha com valor que não é "ligado": nada carrega
  await resetData();
  const off = await startServer({ SEED_SAMPLE_DATA: 'false' });
  assert.equal(await sampleTotal(), 0);
  await off.stop();
});

test('comando de linha: status, load (duas vezes sem duplicar) e remove', async () => {
  await resetData();
  const run = (cmd) => spawnSync('node', [path.join(SRC, 'sampleDataCli.js'), cmd], { env: { ...process.env, DATABASE_URL: DB_URL }, encoding: 'utf8' });
  let r = run('status');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).loaded, false);
  r = run('load');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Loaded \d+ sample records/);
  const total = await sampleTotal();
  r = run('load');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /already loaded/);
  assert.equal(await sampleTotal(), total);
  r = run('remove');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Removed \d+ sample records/);
  assert.equal(await sampleTotal(), 0);
  assert.equal(run('bogus').status, 2);
});

test('as datas dos exemplos acompanham o calendário; dado real não é movido', async () => {
  await resetData();
  process.env.DATABASE_URL = DB_URL;
  const mod = await import('../src/sampleData.js');
  const dbmod = await import('../src/db.js');
  try {
    await mod.loadSampleData();
    // um registro REAL com data fixa, em tabela que o rolo mexe
    await q(`INSERT INTO suppliers (name, specialty, contact_name, contact_email, contact_phone, lead_time_days) VALUES ('Real S', 'x', 'c', 'c@example.test', '(219) 555-0103', 1)`);
    const cust = (await q(`SELECT id, owner_user_id FROM customers LIMIT 1`))[0];
    await q(`INSERT INTO rfqs (customer_id, title, due_date, status, owner_user_id, received_date, is_sample) VALUES ($1, 'Real dated RFQ', '2031-05-05', 'New', $2, '2031-04-01', FALSE)`, [cust.id, cust.owner_user_id]);
    const invBefore = (await q(`SELECT MIN(issue_date) AS d FROM invoices WHERE is_sample`))[0].d;
    const actBefore = (await q(`SELECT MIN(occurred_at) AS d FROM activities WHERE is_sample`))[0].d;
    const moveBefore = Date.parse((await q(`SELECT MIN(created_at) AS d FROM stock_moves WHERE is_sample`))[0].d);
    assert.equal(await mod.rollSampleDates(), 0, 'no mesmo dia não move nada');
    const moved = await mod.rollSampleDates({ today: new Date(Date.now() + 5 * 864e5) });
    assert.equal(moved, 5);
    const shift = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);
    assert.equal((await q(`SELECT MIN(issue_date) AS d FROM invoices WHERE is_sample`))[0].d, shift(invBefore, 5));
    const actAfter = (await q(`SELECT MIN(occurred_at) AS d FROM activities WHERE is_sample`))[0].d;
    assert.equal(actAfter.slice(0, 10), shift(actBefore.slice(0, 10), 5));
    assert.equal(actAfter.slice(10), actBefore.slice(10), 'a hora do dia fica');
    assert.equal(Date.parse((await q(`SELECT MIN(created_at) AS d FROM stock_moves WHERE is_sample`))[0].d) - moveBefore, 5 * 864e5);
    assert.deepEqual((await q(`SELECT due_date, received_date FROM rfqs WHERE title = 'Real dated RFQ'`))[0], { due_date: '2031-05-05', received_date: '2031-04-01' });
    assert.equal((await q(`SELECT anchor_date FROM sample_data_meta`))[0].anchor_date, shift(todayISO(), 5));
    assert.equal(await mod.rollSampleDates({ today: new Date(Date.now() + 5 * 864e5) }), 0, 'repetir no mesmo dia não move de novo');
  } finally {
    await dbmod.default.end();
  }
});
