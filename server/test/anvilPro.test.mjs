// Recursos pro de Anvil: estoque com lote e código de barras, comprar o que falta, custeio e agenda de produção.
// Precisa de um Postgres local (cria e apaga um banco temporário), como auth.test.mjs.
//   TEST_PG_ADMIN_URL=postgres://test:test@localhost:5432/postgres node --test server/test/anvilPro.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..', 'src');
const ADMIN_URL = process.env.TEST_PG_ADMIN_URL || 'postgres://test:test@localhost:5432/postgres';
const DB_NAME = `anvil_pro_${process.pid}_${Date.now() % 100000}`;
const DB_URL = ADMIN_URL.replace(/\/[^/]*$/, `/${DB_NAME}`);
const OWNER = { email: 'owner@example.com', pass: 'Owner-pass-12345' };
const FREE_PATH = '/api/customers', MID_PATH = '/api/work-orders', TOP_PATH = '/api/quality-inspections';

let admin;
const servers = [];
const freePort = () => new Promise((resolve, reject) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); s.on('error', reject); });

async function start(extraEnv = {}) {
  const port = await freePort();
  const env = { ...process.env, NODE_ENV: 'test', PORT: String(port), DATABASE_URL: DB_URL, JWT_SECRET: 'test-secret-test-secret-123', BOOTSTRAP_OWNER_EMAIL: OWNER.email, BOOTSTRAP_OWNER_PASSWORD: OWNER.pass, FRONTEND_URL: 'http://app.test', SMTP_HOST: '' };
  for (const k of ['LICENSED_PLAN', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_API_BASE']) delete env[k];
  Object.assign(env, extraEnv);
  const proc = spawn('node', [path.join(SRC, 'index.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; proc.stdout.on('data', (d) => { logs += d; }); proc.stderr.on('data', (d) => { logs += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* subindo */ } await new Promise((r) => setTimeout(r, 150)); }
  const srv = {
    proc, logs: () => logs,
    stop: () => new Promise((resolve) => { proc.once('exit', resolve); proc.kill('SIGTERM'); }),
    async call(method, url, { token, body, headers, raw } = {}) {
      const r = await fetch(base + url, { method, headers: { ...(body || raw ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: raw ?? (body ? JSON.stringify(body) : undefined) });
      const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* texto */ }
      return { status: r.status, json, text };
    },
  };
  servers.push(srv);
  const login = (await srv.call('POST', '/api/auth/login', { body: { email: OWNER.email, password: OWNER.pass } })).json;
  srv.token = login.token;
  return srv;
}
async function stop(srv) { await srv.stop(); servers.splice(servers.indexOf(srv), 1); }

before(async () => {
  admin = new pg.Client({ connectionString: ADMIN_URL }); await admin.connect();
  await admin.query(`CREATE DATABASE ${DB_NAME}`);
  const seed = spawnSync('node', [path.join(SRC, 'seed.js')], { env: { ...process.env, DATABASE_URL: DB_URL }, encoding: 'utf8' });
  assert.equal(seed.status, 0, seed.stderr);
});
after(async () => {
  for (const s of servers) if (s.proc.exitCode === null && s.proc.signalCode === null) await s.stop();
  await admin.query(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`); await admin.end();
});


const mkItem = (s, o = {}) => s.call('POST', '/api/inventory', { token: s.token, body: { sku: 'STL-PL-10', name: 'Steel plate 10mm', material: 'A36', uom: 'ea', min_stock: 5, unit_cost: 100, location: 'Rack A', barcode: '0123456789', opening_qty: 20, ...o } });

test('estoque: só no Essencial; entrada, saída para ordem, mínimo, código de barras e saldo não negativo', async () => {
  let s = await start({ LICENSED_PLAN: 'basico' });
  assert.equal((await s.call('GET', '/api/inventory', { token: s.token })).status, 402);
  await stop(s);
  s = await start({ LICENSED_PLAN: 'essencial' });
  const it = await mkItem(s); assert.equal(it.status, 201); assert.equal(it.json.on_hand, 20); assert.equal(it.json.low, false); assert.equal(it.json.value, 2000);
  assert.equal((await mkItem(s, { sku: 'stl-pl-10' })).status, 409, 'SKU repetido (sem diferenciar maiúsculas)');
  assert.equal((await mkItem(s, { sku: 'OTHER', barcode: '0123456789' })).status, 409, 'código de barras repetido');
  assert.equal((await mkItem(s, { sku: '', name: 'x' })).status, 400);
  assert.equal((await mkItem(s, { sku: 'NEG', min_stock: -1 })).status, 400);
  const look = await s.call('GET', '/api/inventory/lookup?code=0123456789', { token: s.token }); assert.equal(look.json.sku, 'STL-PL-10');
  assert.equal((await s.call('GET', '/api/inventory/lookup?code=stl-pl-10', { token: s.token })).status, 200, 'SKU também acha');
  assert.equal((await s.call('GET', '/api/inventory/lookup?code=nada', { token: s.token })).status, 404);
  const wo = (await s.call('GET', '/api/work-orders', { token: s.token })).json[0];
  const mv = (type, qty, extra = {}) => s.call('POST', `/api/inventory/${it.json.id}/move`, { token: s.token, body: { type, qty, ...extra } });
  assert.equal((await mv('issue', 5)).status, 400, 'saída precisa de ordem de serviço');
  assert.equal((await mv('issue', 5, { work_order_id: 99999 })).status, 400);
  assert.equal((await mv('issue', 0, { work_order_id: wo.id })).status, 400);
  assert.equal((await mv('issue', 100, { work_order_id: wo.id })).status, 409, 'não deixa o saldo ficar negativo');
  const after = await mv('issue', 16, { work_order_id: wo.id }); assert.equal(after.status, 201); assert.equal(after.json.on_hand, 4); assert.equal(after.json.low, true, 'abaixo do mínimo');
  assert.equal((await mv('adjust', -1)).status, 400, 'ajuste exige motivo');
  assert.equal((await mv('adjust', 2, { note: 'Recount' })).json.on_hand, 6);
  assert.equal((await mv('receive', 10)).json.on_hand, 16);
  assert.equal((await s.call('POST', `/api/inventory/${it.json.id}/move`, { token: s.token, body: { type: 'bogus', qty: 1 } })).status, 400);
  const hist = (await s.call('GET', `/api/inventory/${it.json.id}/moves`, { token: s.token })).json;
  assert.equal(hist.moves.length, 4); assert.equal(hist.moves.find((m) => m.reason === 'issue').work_order_number, wo.work_order_number);
  assert.equal((await s.call('DELETE', `/api/inventory/${it.json.id}`, { token: s.token })).status, 409, 'com histórico não apaga');
  const empty = await mkItem(s, { sku: 'EMPTY', barcode: '', opening_qty: 0 });
  assert.equal((await s.call('DELETE', `/api/inventory/${empty.json.id}`, { token: s.token })).status, 204);
  assert.equal((await s.call('PUT', `/api/inventory/${it.json.id}`, { token: s.token, body: { ...it.json, min_stock: 30 } })).json.low, true);
  await stop(s);
});

test('lote: obrigatório quando o item é rastreado, saldo por lote e rastreio do lote', async () => {
  const s = await start({ LICENSED_PLAN: 'essencial' });
  const it = await mkItem(s, { sku: 'WIRE-1', name: 'Weld wire', tracking: 'lot', barcode: '', opening_qty: 0, min_stock: 0 });
  const wo = (await s.call('GET', '/api/work-orders', { token: s.token })).json;
  const mv = (type, qty, extra = {}) => s.call('POST', `/api/inventory/${it.json.id}/move`, { token: s.token, body: { type, qty, ...extra } });
  assert.equal((await mv('receive', 10)).status, 400, 'sem lote não entra');
  assert.equal((await mv('receive', 10, { lot: 'L-100' })).status, 201); assert.equal((await mv('receive', 5, { lot: 'L-200' })).json.on_hand, 15);
  assert.equal((await mv('issue', 8, { lot: 'L-200', work_order_id: wo[0].id })).status, 409, 'lote L-200 só tem 5');
  assert.equal((await mv('issue', 4, { lot: 'l-100', work_order_id: wo[0].id })).status, 201);
  assert.equal((await mv('issue', 3, { lot: 'L-100', work_order_id: wo[1].id })).status, 201);
  const lots = (await s.call('GET', `/api/inventory/${it.json.id}/moves`, { token: s.token })).json.lots;
  assert.deepEqual(lots.map((l) => [l.lot, l.qty]), [['L-100', 3], ['L-200', 5]], 'lote guardado em maiúsculas, sem duplicar');
  const tr = (await s.call('GET', '/api/inventory/trace?lot=L-100', { token: s.token })).json;
  assert.equal(tr.received, 10); assert.equal(tr.used, 7); assert.deepEqual(tr.moves.filter((m) => m.work_order_number).map((m) => m.work_order_number).sort(), [wo[0].work_order_number, wo[1].work_order_number].sort());
  assert.equal((await s.call('GET', '/api/inventory/trace', { token: s.token })).status, 400);
  await stop(s);
});

test('comprar o que falta: só no Completo; soma as ordens abertas e cria o pedido de compra', async () => {
  let s = await start({ LICENSED_PLAN: 'essencial' });
  assert.equal((await s.call('GET', '/api/mrp/shortages', { token: s.token })).status, 402);
  await stop(s);
  s = await start({ LICENSED_PLAN: 'completo' });
  const wos = (await s.call('GET', '/api/work-orders', { token: s.token })).json.filter((w) => w.quote_id && w.status !== 'Completed');
  const bom = (await s.call('GET', '/api/bill-of-materials', { token: s.token })).json;
  const line = bom.find((b) => wos.some((w) => w.quote_id === b.quote_id));
  assert.ok(line, 'seed tem lista de materiais ligada a ordem aberta');
  const required = bom.filter((b) => b.part_name === line.part_name && wos.some((w) => w.quote_id === b.quote_id)).reduce((a, b) => a + wos.filter((w) => w.quote_id === b.quote_id).length * b.quantity, 0);
  const it = await mkItem(s, { sku: 'MATCH-1', name: line.part_name, barcode: '', opening_qty: 1, min_stock: 2, unit_cost: 10 });
  const r = (await s.call('GET', '/api/mrp/shortages', { token: s.token })).json;
  const row = r.rows.find((x) => x.item_id === it.json.id);
  assert.ok(row, 'item sem saldo aparece'); assert.equal(row.required, Math.round(required * 1000) / 1000); assert.equal(row.suggested, Math.round((required + 2 - 1) * 1000) / 1000);
  assert.equal(row.est_cost, Math.round(row.suggested * 10 * 100) / 100); assert.ok(row.work_orders.length > 0);
  assert.ok(r.unmatched.length > 0, 'linhas sem item no estoque aparecem à parte');
  const sup = (await s.call('GET', '/api/suppliers', { token: s.token })).json[0];
  const po = (body) => s.call('POST', '/api/mrp/purchase-orders', { token: s.token, body });
  assert.equal((await po({ supplier_id: 99999, items: [{ item_id: it.json.id, qty: 1 }] })).status, 400);
  assert.equal((await po({ supplier_id: sup.id, items: [] })).status, 400);
  assert.equal((await po({ supplier_id: sup.id, items: [{ item_id: it.json.id, qty: 0 }] })).status, 400);
  assert.equal((await po({ supplier_id: sup.id, items: [{ item_id: 99999, qty: 1 }] })).status, 400);
  const before = (await s.call('GET', '/api/purchase-orders', { token: s.token })).json.length;
  const made = await po({ supplier_id: sup.id, items: [{ item_id: it.json.id, qty: row.suggested }] });
  assert.equal(made.status, 201); assert.match(made.json.po_number, /^PO-MRP-\d{8}-1$/); assert.equal(made.json.total_amount, row.est_cost);
  const pos = (await s.call('GET', '/api/purchase-orders', { token: s.token })).json; assert.equal(pos.length, before + 1);
  const created = pos.find((p) => p.po_number === made.json.po_number); assert.equal(created.status, 'Draft'); assert.match(created.notes, /MATCH-1/);
  // receber a compra zera o que falta
  await s.call('POST', `/api/inventory/${it.json.id}/move`, { token: s.token, body: { type: 'receive', qty: row.suggested } });
  assert.equal((await s.call('GET', '/api/mrp/shortages', { token: s.token })).json.rows.some((x) => x.item_id === it.json.id), false);
  await stop(s);
});

test('custeio: material estimado pela lista, real pelas saídas, mão de obra e margem; só no Completo', async () => {
  let s = await start({ LICENSED_PLAN: 'essencial' });
  assert.equal((await s.call('GET', '/api/costing', { token: s.token })).status, 402);
  await stop(s);
  s = await start({ LICENSED_PLAN: 'completo' });
  const c0 = (await s.call('GET', '/api/costing', { token: s.token })).json;
  const w = c0.rows.find((r) => r.revenue != null && r.materials_estimated > 0);
  assert.ok(w); assert.equal(w.materials_basis, 'estimated'); assert.equal(w.cost, w.materials_estimated); assert.equal(w.margin, Math.round((w.revenue - w.cost) * 100) / 100);
  const lab = (b) => s.call('POST', '/api/costing/labor', { token: s.token, body: b });
  assert.equal((await lab({ work_order_id: 99999, hours: 1, rate: 50 })).status, 400);
  assert.equal((await lab({ work_order_id: w.id, hours: 0, rate: 50 })).status, 400);
  assert.equal((await lab({ work_order_id: w.id, hours: 2, rate: -1 })).status, 400);
  const l1 = await lab({ work_order_id: w.id, hours: 10, rate: 40, work_date: '2026-09-01', note: 'Welding' }); assert.equal(l1.status, 201);
  const w1 = (await s.call('GET', '/api/costing', { token: s.token })).json.rows.find((r) => r.id === w.id);
  assert.equal(w1.labor, 400); assert.equal(w1.labor_hours, 10); assert.equal(w1.cost, Math.round((w.materials_estimated + 400) * 100) / 100);
  // saída real de estoque troca a base para "real"
  const it = await mkItem(s, { sku: 'COST-1', name: 'Plate', barcode: '', unit_cost: 25, opening_qty: 10 });
  await s.call('POST', `/api/inventory/${it.json.id}/move`, { token: s.token, body: { type: 'issue', qty: 4, work_order_id: w.id } });
  const w2 = (await s.call('GET', '/api/costing', { token: s.token })).json.rows.find((r) => r.id === w.id);
  assert.equal(w2.materials_basis, 'actual'); assert.equal(w2.materials_actual, 100); assert.equal(w2.cost, 500);
  assert.equal((await s.call('GET', `/api/costing/labor?work_order_id=${w.id}`, { token: s.token })).json.length, 1);
  assert.equal((await s.call('DELETE', `/api/costing/labor/${l1.json.id}`, { token: s.token })).status, 204);
  assert.equal((await s.call('DELETE', `/api/costing/labor/${l1.json.id}`, { token: s.token })).status, 404);
  const tot = (await s.call('GET', '/api/costing', { token: s.token })).json.totals; assert.ok(Math.abs(tot.margin - (tot.revenue - tot.cost)) < 0.05);
  await stop(s);
});

test('agenda de produção: só no Completo; mostra ordens abertas e marca as atrasadas', async () => {
  let s = await start({ LICENSED_PLAN: 'essencial' });
  assert.equal((await s.call('GET', '/api/calendar', { token: s.token })).status, 402);
  await stop(s);
  s = await start({ LICENSED_PLAN: 'completo' });
  const cal = (await s.call('GET', '/api/calendar', { token: s.token })).json;
  assert.ok(cal.items.length > 0); assert.ok(cal.items.every((i) => i.status !== 'Completed'));
  assert.ok(cal.items.every((i) => i.overdue === (i.due_date < cal.today)));
  const narrow = (await s.call('GET', '/api/calendar?from=2000-01-01&to=2000-01-02', { token: s.token })).json; assert.equal(narrow.items.length, 0);
  assert.equal((await s.call('GET', '/api/calendar')).status, 401);
  await stop(s);
});
