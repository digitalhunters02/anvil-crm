// "Selo de plano" e "Ver como plano" NO NAVEGADOR (Playwright + Chromium): servidor real do Anvil (Postgres) + build real do front.
// Usuários de cada plano (o plano é da instalação: muda a linha de assinatura no banco entre os testes) e o DONO da plataforma (OWNER_EMAILS).
//   node e2e/selo.e2e.mjs      (rodar da raiz; usa Postgres em 127.0.0.1:5432 harbor/harbortest e cria/apaga um banco seloanv_ui_<sufixo>)
//   SELO_SHOTS=<pasta>         guarda as fotos das telas
// Portas: servidor 7894, front 5294.
import { spawn, spawnSync, execSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SERVER = path.join(ROOT, 'server');
const CLIENT = path.join(ROOT, 'client');
const rq = createRequire(path.join(SERVER, 'package.json'));
const pg = rq('pg');
const bcrypt = rq('bcryptjs');
const SHOTS = process.env.SELO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'anvil-selo-shots-'));
fs.mkdirSync(SHOTS, { recursive: true });
const API = 7894, WEB = 5294;
const ADMIN_URL = 'postgres://harbor:harbortest@127.0.0.1:5432/postgres';
const DBNAME = 'seloanv_ui_' + crypto.randomBytes(3).toString('hex');
const DBURL = ADMIN_URL.replace(/\/postgres$/, '/' + DBNAME);
const OWNER = 'dono@example.test', OWNER_PASS = 'Owner-pass-12345';
const SCHOOL = 'escola@example.test', STAFF = 'staff@example.test', PASS = 'Plain-pass-12345';

// ---- oráculo escrito à mão, de propósito: menu e botões internos -> plano mínimo ----
const ORDER = ['basico', 'essencial', 'completo'];
const NAME = { basico: 'Essential', essencial: 'Professional', completo: 'Complete' };
const NAV_MIN = { '/rfqs': 'essencial', '/work-orders': 'essencial', '/bill-of-materials': 'essencial', '/calendar': 'completo', '/costing': 'completo', '/quality-inspections': 'completo', '/inventory': 'essencial', '/shortages': 'completo', '/purchase-orders': 'essencial', '/shipments': 'essencial', '/automations': 'completo', '/whatsapp': 'completo', '/reports': 'essencial' };
const above = (min, plan) => ORDER.indexOf(min) > ORDER.indexOf(plan);
const expectedNav = (plan) => Object.fromEntries(Object.entries(NAV_MIN).filter(([, m]) => above(m, plan)));
const PRICE = { basico: ['$59', '$637'], essencial: ['$129', '$1,393'], completo: ['$249', '$2,689'] };

const admin = new pg.Client({ connectionString: ADMIN_URL });
await admin.connect();
await admin.query(`CREATE DATABASE ${DBNAME}`);
const db = new pg.Pool({ connectionString: DBURL, ssl: false });
const seed = spawnSync(process.execPath, [path.join(SERVER, 'src', 'seed.js')], { env: { ...process.env, DATABASE_URL: DBURL, PGSSL: 'false' }, encoding: 'utf8' });
assert.equal(seed.status, 0, seed.stderr);

// ---- build do front + servidor de arquivos ----
const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'anvil-selo-dist-'));
execSync(`npx vite build --outDir ${dist} --emptyOutDir`, { cwd: CLIENT, env: { ...process.env, VITE_API_URL: `http://127.0.0.1:${API}` }, stdio: 'ignore' });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const web = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(dist, p);
  if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(WEB, '127.0.0.1');

const env = {
  ...process.env, NODE_ENV: 'test', PORT: String(API), DATABASE_URL: DBURL, PGSSL: 'false', JWT_SECRET: 's'.repeat(48), FRONTEND_URL: `http://127.0.0.1:${WEB}`, CORS_ORIGINS: `http://127.0.0.1:${WEB}`,
  OWNER_EMAILS: OWNER, BOOTSTRAP_OWNER_EMAIL: OWNER, BOOTSTRAP_OWNER_PASSWORD: OWNER_PASS, SMTP_HOST: '',
  STRIPE_SECRET_KEY: 'sk_test_fake', STRIPE_API_BASE: 'http://127.0.0.1:1', // cobrança ligada, mas qualquer chamada ao Stripe falha: nada é cobrado
  STRIPE_PRICE_BASICO: 'price_b', STRIPE_PRICE_ESSENCIAL: 'price_e', STRIPE_PRICE_COMPLETO: 'price_c',
};
for (const k of ['LICENSED_PLAN', 'ANTHROPIC_API_KEY']) delete env[k];
const srv = spawn(process.execPath, ['src/index.js'], { cwd: SERVER, env });
let srvLog = ''; srv.stdout.on('data', (d) => (srvLog += d)); srv.stderr.on('data', (d) => (srvLog += d));
for (let i = 0; i < 200; i++) { try { if ((await fetch(`http://127.0.0.1:${API}/api/health`)).ok) break; } catch { /* subindo */ } await new Promise((r) => setTimeout(r, 150)); }

let n = 0;
const api = async (p, method = 'GET', body, token) => {
  const r = await fetch(`http://127.0.0.1:${API}/api${p}`, { method, headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.9.0.${++n}`, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return r.json().catch(() => ({}));
};
const setPlan = (plan) => db.query(`INSERT INTO subscription (id, plan, status, stripe_customer_id, stripe_subscription_id) VALUES (1, $1, 'active', 'cus_x', 'sub_x')
  ON CONFLICT (id) DO UPDATE SET plan = $1, status = 'active', stripe_customer_id = 'cus_x', stripe_subscription_id = 'sub_x'`, [plan]);
const subRow = async () => (await db.query('SELECT plan, status, stripe_subscription_id FROM subscription WHERE id = 1')).rows[0];
await setPlan('completo');

async function login(email, password) {
  const r = await api('/auth/login', 'POST', { email, password });
  assert.ok(r.token, 'login falhou ' + email + JSON.stringify(r));
  return { token: r.token, session: { token: r.token, account: r.account } };
}
const O = await login(OWNER, OWNER_PASS);
// dono da ESCOLA (role owner) que não é o dono da plataforma, e um funcionário
await db.query(`INSERT INTO accounts (name, email, password_hash, role, must_change_password) VALUES ('Diretora', $1, $2, 'owner', FALSE)`, [SCHOOL, bcrypt.hashSync(PASS, 10)]);
await api('/accounts', 'POST', { name: 'Funcionario', email: STAFF, password: PASS }, O.token);
await db.query(`UPDATE accounts SET must_change_password = FALSE WHERE email = $1`, [STAFF]);
const S = await login(SCHOOL, PASS);
const F = await login(STAFF, PASS);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--disable-gpu'] });
let failed = 0, passed = 0, cur = null;
const consoleErrors = [];
const step = async (name, fn) => {
  try { await fn(); passed++; console.log('ok  -', name); }
  catch (e) { failed++; try { await cur?.screenshot({ path: path.join(SHOTS, `falha-${failed}.png`) }); } catch { /* */ } console.log('ERRO-', name, '\n      ', String(e.message).split('\n').slice(0, 4).join(' | ')); }
};
const DESKTOP = { width: 1280, height: 900 }, PHONE = { width: 390, height: 844 };
async function newPage(user, viewport = DESKTOP, { lang = 'en', preview } = {}) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block', ...(viewport.width < 500 ? { hasTouch: true, isMobile: true } : {}) });
  await ctx.addInitScript(([sess, language, prev]) => {
    try {
      if (sess) localStorage.setItem('anvil-crm-session', sess);
      localStorage.setItem('anvil-lang', language);
      if (prev && !sessionStorage.getItem('__seeded')) { localStorage.setItem('anvil_preview_plan', prev); sessionStorage.setItem('__seeded', '1'); }
    } catch { /* */ }
  }, [user ? JSON.stringify(user.session) : '', lang, preview || '']);
  await ctx.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
  const p = await ctx.newPage(); cur = p;
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)\.com/.test(m.location().url || '')) consoleErrors.push(`[${m.location().url || ''}] ${m.text()}`.slice(0, 220)); });
  p.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e.message).slice(0, 200)));
  return p;
}
async function openApp(p, hash = '#/') {
  const st = p.waitForResponse((r) => r.url() === `http://127.0.0.1:${API}/api/billing/status` && r.status() === 200, { timeout: 20000 });
  await p.goto(`http://127.0.0.1:${WEB}/${hash}`, { waitUntil: 'domcontentloaded' });
  await st;
  await p.waitForSelector('[data-nav="/"]', { timeout: 20000, state: 'attached' });
  await p.waitForTimeout(300);
}
const go = async (p, hash, ready) => { await p.evaluate((h) => { window.location.hash = h; }, hash); await p.waitForSelector(ready, { timeout: 15000 }); await p.waitForTimeout(250); };
const lockedNav = (p) => p.$$eval('[data-nav][data-plan-locked]', (els) => Object.fromEntries(els.map((e) => [e.dataset.nav, e.dataset.planLocked])));
const navBadges = (p) => p.$$eval('aside nav [data-plan-badge]', (els) => els.map((e) => e.dataset.planBadge).sort());
const noHScroll = async (p, label) => { const w = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth, document.body.scrollWidth]); assert.ok(w[0] <= w[1] && w[2] <= w[1], `${label}: rolagem lateral ${w}`); };
const shot = (p, name) => p.screenshot({ path: path.join(SHOTS, name + '.png') });
const modalOf = (p) => p.locator('[data-testid="plan-upsell"]');
const lockOf = (p, testid) => p.getAttribute(`[data-testid="${testid}"]`, 'data-plan-locked');
const mobileMenu = async (p) => { await p.click('button[aria-label="Open menu"]'); await p.waitForTimeout(350); };

try {
  // ============ 1) cada plano: selos do menu e dos botões internos ============
  for (const plan of ORDER) {
    await step(`plano ${plan} (${NAME[plan]}): selos do menu e dos botões internos certos (dona da escola)`, async () => {
      await setPlan(plan);
      const p = await newPage(S); await openApp(p);
      assert.deepEqual(await lockedNav(p), expectedNav(plan));
      assert.deepEqual(await navBadges(p), Object.values(expectedNav(plan)).sort());
      assert.equal(await p.locator('[data-testid="plan-preview-slot"]').count(), 0, 'cliente comum não vê o seletor do dono');
      for (const to of Object.keys(NAV_MIN)) assert.equal(await p.locator(`[data-nav="${to}"]`).count(), 1, 'item some do menu: ' + to);
      if (plan === 'basico') await shot(p, '01-menu-basico');
      if (plan === 'essencial') await shot(p, '01-menu-essencial');
      await go(p, '#/settings', '[data-plan-card="completo"]');
      assert.equal(await lockOf(p, 'whatsapp-connect'), above('completo', plan) ? 'completo' : null, 'botão Conectar WhatsApp');
      for (const [label, min] of [['RFQs', 'essencial'], ['Work Orders', 'essencial'], ['Purchase Orders', 'essencial']]) assert.equal(await lockOf(p, `export-${label}`), above(min, plan) ? min : null, 'exportar ' + label);
      assert.equal(await lockOf(p, 'export-Customers'), null, 'exportar clientes vale para todos');
      if (plan === 'completo') {
        await go(p, '#/', '[data-nav="/"]');
        const out = await p.$$eval('[data-plan-badge]', (els) => els.filter((e) => !e.closest('[data-plan-card]')).length);
        assert.equal(out, 0, 'plano Completo sem nenhum selo');
      }
      await p.context().close();
    });
  }
  await step('funcionário comum: vê os selos; a janelinha só tem "Fechar" (não pode mudar plano); não vê o seletor do dono', async () => {
    await setPlan('basico');
    const p = await newPage(F); await openApp(p);
    assert.deepEqual(await lockedNav(p), expectedNav('basico'));
    assert.equal(await p.locator('[data-testid="plan-preview-slot"]').count(), 0);
    await p.click('[data-nav="/reports"]'); await modalOf(p).waitFor();
    assert.equal(await p.locator('[data-testid="plan-upsell-plans"]').count(), 0, 'sem botão Ver planos');
    assert.match(await modalOf(p).innerText(), /Available on the Professional plan/);
    await p.click('[data-testid="plan-upsell-close"]');
    await p.context().close();
  });

  // ============ 2) janelinha ============
  await step('Essential: clicar em RFQs abre "Available on the Professional plan" com preço; Not now fecha; See plans leva aos cartões', async () => {
    await setPlan('basico');
    const p = await newPage(S); await openApp(p);
    await p.click('[data-nav="/rfqs"]');
    const m = modalOf(p); await m.waitFor();
    const text = await m.innerText();
    assert.match(text, /Available on the Professional plan/); assert.match(text, /RFQs/);
    assert.match(text, /\$129 per month/); assert.match(text, /or \$1,393 per year/); assert.match(text, /also includes/i);
    assert.equal(new URL(p.url()).hash, '#/', 'não navegou para a tela bloqueada');
    await shot(p, '02-janelinha-basico-rfqs');
    await p.click('[data-testid="plan-upsell-close"]'); await m.waitFor({ state: 'detached' });
    await p.click('[data-nav="/rfqs"]'); await m.waitFor();
    await p.click('[data-testid="plan-upsell-plans"]');
    await p.waitForSelector('[data-plan-card="completo"]');
    assert.equal(await m.count(), 0);
    assert.match(new URL(p.url()).hash, /^#\/settings/);
    await p.waitForTimeout(400);
    const top = await p.$eval('[data-testid="plans-card"]', (e) => Math.round(e.getBoundingClientRect().top));
    assert.ok(top >= -5 && top < 300, 'a tela rolou até os planos, top=' + top);
    assert.equal(await modalOf(p).count(), 0, 'a janelinha não reabre sozinha');
    for (const k of ORDER) assert.equal(await p.locator(`[data-plan-card="${k}"] [data-plan-badge="${k}"]`).count() >= 1, true, `selo no cartão ${k}`);
    await p.context().close();
  });
  await step('Professional: WhatsApp pede o Complete ($249 / $2,689); Escape fecha; Shortages & Buying e Job Costing também; quem tem o plano não vê janelinha', async () => {
    await setPlan('essencial');
    const p = await newPage(S); await openApp(p);
    await p.click('[data-nav="/whatsapp"]'); const m = modalOf(p); await m.waitFor();
    const t = await m.innerText();
    assert.match(t, /Available on the Complete plan/); assert.match(t, /\$249 per month/); assert.match(t, /\$2,689 per year/); assert.match(t, /Quality inspections/);
    await p.keyboard.press('Escape'); await m.waitFor({ state: 'detached' });
    await p.click('[data-nav="/shortages"]'); await m.waitFor();
    assert.match(await m.innerText(), /Shortages and buying/);
    await p.click('[data-testid="plan-upsell-close"]');
    await p.click('[data-nav="/costing"]'); await m.waitFor();
    assert.match(await m.innerText(), /Job costing/);
    await p.click('[data-testid="plan-upsell-close"]');
    await p.click('[data-nav="/inventory"]'); await p.waitForTimeout(500);
    assert.equal(await modalOf(p).count(), 0, 'Inventory já está no Professional');
    await p.context().close();
    await setPlan('completo');
    const q = await newPage(S); await openApp(q);
    await q.click('[data-nav="/whatsapp"]'); await q.waitForTimeout(500);
    assert.equal(await modalOf(q).count(), 0);
    assert.equal(new URL(q.url()).hash, '#/whatsapp');
    await q.context().close();
  });
  await step('Essential: Conectar WhatsApp (Configurações) abre a janelinha do Complete e a rota bloqueada nem é chamada', async () => {
    await setPlan('basico');
    const p = await newPage(S); await openApp(p);
    const m = modalOf(p);
    await go(p, '#/settings', '[data-testid="whatsapp-connect"]');
    await p.click('[data-testid="whatsapp-connect"]'); await m.waitFor();
    assert.match(await m.innerText(), /WhatsApp/); assert.match(await m.innerText(), /Complete/);
    await shot(p, '02-whatsapp-basico');
    await p.click('[data-testid="plan-upsell-close"]');
    await p.click('[data-testid="export-RFQs"]'); await m.waitFor();
    assert.match(await m.innerText(), /RFQs/); assert.match(await m.innerText(), /Professional/);
    await p.click('[data-testid="plan-upsell-close"]');
    await p.context().close();
  });
  await step('tela bloqueada aberta pelo endereço: cartão amigável em vez de erro (Reports no Essential, Automations no Professional)', async () => {
    await setPlan('basico');
    const p = await newPage(S); await openApp(p, '#/reports');
    await p.waitForSelector('[data-testid="plan-locked-page"]');
    assert.match(await p.locator('[data-testid="plan-locked-page"]').innerText(), /Reports/);
    await shot(p, '02-tela-bloqueada');
    await p.click('[data-testid="plan-locked-details"]'); await modalOf(p).waitFor();
    await p.click('[data-testid="plan-upsell-close"]');
    await p.context().close();
    await setPlan('essencial');
    const q = await newPage(S); await openApp(q, '#/automations');
    await q.waitForSelector('[data-testid="plan-locked-page"]');
    assert.equal(await q.getAttribute('[data-testid="plan-locked-page"]', 'data-plan-locked'), 'completo');
    await q.context().close();
  });

  // ============ 3) preço com selo na tela de planos ============
  await step('tela de planos: cada plano com selo ao lado do nome, preço do servidor e o que acrescenta com o selo do plano onde entra', async () => {
    await setPlan('essencial');
    const p = await newPage(S); await openApp(p, '#/settings');
    await p.waitForSelector('[data-plan-card="completo"]');
    const adds = await p.$$eval('[data-plan-adds]', (els) => Object.fromEntries(els.map((e) => [e.dataset.planAdds, [...e.querySelectorAll('li')].map((li) => [li.dataset.add, li.querySelector('[data-plan-badge]')?.dataset.planBadge])])));
    assert.deepEqual(Object.keys(adds), ['essencial', 'completo']);
    for (const [plan, list] of Object.entries(adds)) for (const [g, badge] of list) assert.equal(badge, plan, `${g} deve ter o selo ${plan}`);
    assert.deepEqual(adds.essencial.map(([g]) => g).sort(), ['bill_of_materials', 'inventory', 'purchase_orders', 'reports', 'rfqs', 'shipments', 'work_orders']);
    assert.deepEqual(adds.completo.map(([g]) => g).sort(), ['automations', 'job_costing', 'mrp', 'production_calendar', 'quality_inspections', 'whatsapp']);
    for (const k of ORDER) {
      const card = await p.locator(`[data-plan-card="${k}"]`).innerText();
      assert.ok(card.includes(PRICE[k][0]), `preço de ${k}: ${card}`);
      assert.equal(await p.locator(`[data-plan-card="${k}"] > div:first-child [data-plan-badge="${k}"]`).count(), 1);
    }
    assert.match(await p.locator('[data-plan-card="essencial"]').innerText(), /Current/);
    await p.locator('[data-testid="plans-card"]').screenshot({ path: path.join(SHOTS, '03-planos-professional.png') });
    await p.context().close();
  });

  // ============ 4) ver como plano ============
  await step('dono da plataforma sem prévia: tudo liberado (plano real Complete), sem faixa; seletor lista Meu plano + os 3 planos', async () => {
    await setPlan('completo');
    const p = await newPage(O); await openApp(p);
    assert.equal((await navBadges(p)).length, 0);
    assert.equal(await p.locator('[data-testid="plan-preview-bar"]').count(), 0);
    await p.click('[data-testid="plan-preview-toggle"]');
    assert.deepEqual(await p.$$eval('[data-plan-choice]', (els) => els.map((e) => e.dataset.planChoice)), ['mine', ...ORDER]);
    await shot(p, '04-seletor-dono');
    await p.context().close();
  });
  for (const plan of ORDER) {
    await step(`dono vendo como ${plan} (${NAME[plan]}): faixa, TODOS os selos/limites/janelinhas como cliente; assinatura real intacta`, async () => {
      await setPlan('completo');
      const before = await subRow();
      const p = await newPage(O); await openApp(p);
      await p.click('[data-testid="plan-preview-toggle"]');
      await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded' }), p.click(`[data-plan-choice="${plan}"]`)]);
      await p.waitForSelector('[data-testid="plan-preview-bar"]');
      await p.waitForSelector('[data-nav="/"]', { state: 'attached' }); await p.waitForTimeout(600);
      assert.match(await p.locator('[data-testid="plan-preview-bar"]').innerText(), new RegExp(`You are viewing Anvil as the ${NAME[plan]} plan`));
      assert.deepEqual(await lockedNav(p), expectedNav(plan));
      assert.deepEqual(await navBadges(p), Object.values(expectedNav(plan)).sort());
      await go(p, '#/settings', '[data-plan-card="completo"]');
      assert.match(await p.locator(`[data-plan-card="${plan}"]`).innerText(), /Current/);
      assert.equal(await p.locator('[data-testid="plans-preview-note"]').count(), 1);
      for (const b of await p.$$('[data-plan-card] button')) assert.ok(await b.isDisabled(), 'escolher plano fica desligado na prévia');
      // limite de logins mostrado segue o plano visto
      assert.match(await p.locator(`[data-plan-card="${plan}"]`).innerText(), new RegExp({ basico: 'Up to 3 staff logins', essencial: 'Up to 10 staff logins', completo: 'Unlimited staff logins' }[plan]));
      const first = Object.keys(expectedNav(plan))[0];
      if (first) {
        await p.click(`[data-nav="${first}"]`); await modalOf(p).waitFor();
        assert.match(await modalOf(p).innerText(), new RegExp(`Available on the ${NAME[NAV_MIN[first]]} plan`));
        await p.click('[data-testid="plan-upsell-close"]');
      }
      if (plan === 'essencial') await shot(p, '04-previa-professional');
      assert.deepEqual(await subRow(), before, 'a assinatura real não mudou');
      await p.context().close();
    });
  }
  await step('prévia: checkout/portal recusados (409) com o cabeçalho; conta que não é dono ignora e o navegador esquece; "Voltar ao meu plano" limpa tudo', async () => {
    await setPlan('completo');
    const call = (p, m, body, tok, h) => fetch(`http://127.0.0.1:${API}/api${p}`, { method: m, headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}`, 'x-forwarded-for': `10.9.1.${++n}`, ...h }, body: body ? JSON.stringify(body) : undefined });
    assert.equal((await call('/billing/checkout', 'POST', { plan: 'completo' }, O.token, { 'x-preview-plan': 'basico' })).status, 409);
    assert.equal((await call('/billing/portal', 'POST', {}, O.token, { 'x-preview-plan': 'basico' })).status, 409);
    const x = await (await call('/billing/status', 'GET', undefined, S.token, { 'x-preview-plan': 'basico' })).json();
    assert.equal(x.previewPlan, null); assert.equal(x.plan, 'completo');
    const q = await newPage(S, DESKTOP, { preview: 'basico' }); await openApp(q);
    assert.equal(await q.locator('[data-testid="plan-preview-bar"]').count(), 0);
    assert.equal(await q.locator('[data-nav][data-plan-locked]').count(), 0, 'plano real Complete: nenhum bloqueio');
    assert.equal(await q.evaluate(() => localStorage.getItem('anvil_preview_plan')), null);
    await q.context().close();
    const p = await newPage(O, DESKTOP, { preview: 'basico' }); await openApp(p);
    await p.waitForSelector('[data-testid="plan-preview-bar"]');
    await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded' }), p.click('[data-testid="plan-preview-back"]')]);
    await p.waitForSelector('[data-nav="/"]', { state: 'attached' }); await p.waitForTimeout(500);
    assert.equal(await p.locator('[data-testid="plan-preview-bar"]').count(), 0);
    assert.equal((await navBadges(p)).length, 0);
    assert.equal(await p.evaluate(() => localStorage.getItem('anvil_preview_plan')), null);
    await p.context().close();
  });

  // ============ 5) celular 390 px ============
  await step('celular 390 px (Essential): sem rolagem lateral, menu com alvos 40px+, janelinha cabe na tela e leva aos planos', async () => {
    await setPlan('basico');
    const p = await newPage(S, PHONE); await openApp(p);
    await noHScroll(p, 'painel');
    await mobileMenu(p);
    const sizes = await p.$$eval('[data-nav]', (els) => els.map((e) => [e.dataset.nav, Math.round(e.getBoundingClientRect().height)]));
    assert.ok(sizes.length >= 12 && sizes.every(([, h]) => h >= 40), 'alvos do menu ' + JSON.stringify(sizes.filter(([, h]) => h < 40)));
    await shot(p, '05-celular-menu-basico');
    await p.click('[data-nav="/rfqs"]'); await modalOf(p).waitFor();
    const r = await p.evaluate(() => { const m = document.querySelector('[data-testid="plan-upsell"]').getBoundingClientRect(); const bs = [...document.querySelectorAll('[data-testid="plan-upsell"] button')].map((b) => Math.round(b.getBoundingClientRect().height)); return { l: m.left, r: m.right, t: m.top, b: m.bottom, w: window.innerWidth, h: window.innerHeight, bs }; });
    assert.ok(r.l >= 0 && r.r <= r.w && r.t >= 0 && r.b <= r.h, 'janelinha dentro da tela ' + JSON.stringify(r));
    assert.ok(r.bs.every((h) => h >= 40), 'botões da janelinha 40px+ ' + r.bs);
    await noHScroll(p, 'janelinha');
    await shot(p, '05-celular-janelinha');
    await p.click('[data-testid="plan-upsell-plans"]'); await p.waitForSelector('[data-plan-card="completo"]'); await p.waitForTimeout(300);
    await noHScroll(p, 'planos');
    await shot(p, '05-celular-planos');
    for (const h of ['#/quotes', '#/customers', '#/suppliers', '#/invoices']) { await go(p, h, 'h1, h2, table, main, [data-testid]'); await noHScroll(p, h); }
    await p.context().close();
  });
  await step('celular 390 px: botões internos bloqueados com 40px+ (Conectar WhatsApp, escolher plano)', async () => {
    await setPlan('basico');
    const p = await newPage(S, PHONE); await openApp(p);
    const hh = async (sel) => Math.round(await p.locator(sel).first().evaluate((e) => e.getBoundingClientRect().height));
    await go(p, '#/settings', '[data-testid="whatsapp-connect"]'); assert.ok(await hh('[data-testid="whatsapp-connect"]') >= 40);
    for (const k of ORDER.filter((x) => x !== 'basico')) assert.ok(await hh(`[data-testid="choose-${k}"]`) >= 40, 'botão escolher plano ' + k);
    await noHScroll(p, 'configurações');
    await p.context().close();
  });
  await step('celular 390 px: dono com seletor (alvos 40px+) e faixa "vendo como" fixa acima do app, sem cobrir o cabeçalho', async () => {
    await setPlan('completo');
    const p = await newPage(O, PHONE); await openApp(p);
    await mobileMenu(p);
    await p.click('[data-testid="plan-preview-toggle"]');
    const hs = await p.$$eval('[data-plan-choice]', (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    assert.equal(hs.length, 4); assert.ok(hs.every((v) => v >= 40), 'chips ' + hs);
    await noHScroll(p, 'seletor');
    await p.context().close();
    const q = await newPage(O, PHONE, { preview: 'basico' }); await openApp(q);
    await q.waitForSelector('[data-testid="plan-preview-bar"]');
    const r = await q.evaluate(() => { const b = document.querySelector('[data-testid="plan-preview-bar"]').getBoundingClientRect(); const hd = document.querySelector('div.md\\:hidden.fixed.top-0').getBoundingClientRect(); return { barTop: b.top, barBottom: b.bottom, headerTop: hd.top, vh: window.innerHeight, docH: document.documentElement.scrollHeight, backH: document.querySelector('[data-testid="plan-preview-back"]').getBoundingClientRect().height }; });
    assert.ok(r.barTop >= 0 && r.barBottom <= r.headerTop + 1, 'faixa não cobre o cabeçalho ' + JSON.stringify(r));
    assert.ok(r.backH >= 40, 'botão Voltar 40px+ ' + r.backH);
    assert.ok(r.docH <= r.vh + 1, 'a página não ganha rolagem ' + JSON.stringify(r));
    await noHScroll(q, 'celular com faixa');
    await shot(q, '05-celular-previa');
    await mobileMenu(q);
    const top = await q.$eval('aside', (e) => Math.round(e.getBoundingClientRect().top));
    assert.ok(top >= Math.round(r.barBottom) - 1, 'gaveta abre abaixo da faixa, top=' + top);
    await shot(q, '05-celular-previa-gaveta');
    await q.context().close();
  });
  await step('desktop com a faixa: faixa fixa no topo e o app não ganha rolagem da página', async () => {
    await setPlan('completo');
    const p = await newPage(O, DESKTOP, { preview: 'essencial' }); await openApp(p);
    await p.waitForSelector('[data-testid="plan-preview-bar"]');
    const r = await p.evaluate(() => ({ top: Math.round(document.querySelector('[data-testid="plan-preview-bar"]').getBoundingClientRect().top), docH: document.documentElement.scrollHeight, vh: window.innerHeight }));
    assert.equal(r.top, 0); assert.ok(r.docH <= r.vh + 1, JSON.stringify(r));
    await shot(p, '04-desktop-previa');
    await p.context().close();
  });

  // ============ 6) idiomas ============
  await step('português: selo, janelinha, planos e faixa do dono', async () => {
    await setPlan('basico');
    const p = await newPage(S, DESKTOP, { lang: 'pt' }); await openApp(p);
    await p.click('[data-nav="/rfqs"]'); await modalOf(p).waitFor();
    const t = await modalOf(p).innerText();
    assert.match(t, /Disponível no plano Profissional/); assert.match(t, /Pedidos de cotação/); assert.match(t, /por mês/); assert.match(t, /Ver planos/); assert.match(t, /Agora não/); assert.match(t, /US\$\s?129/);
    await shot(p, '06-janelinha-pt');
    await p.click('[data-testid="plan-upsell-plans"]'); await p.waitForSelector('[data-plan-card="completo"]');
    assert.match(await p.locator('[data-plan-adds="completo"]').innerText(), /Tudo do Profissional, mais:/);
    assert.match(await p.locator('[data-plan-card="basico"]').innerText(), /Essencial/);
    await p.context().close();
    await setPlan('completo');
    const o = await newPage(O, DESKTOP, { lang: 'pt', preview: 'essencial' }); await openApp(o);
    const bar = await o.locator('[data-testid="plan-preview-bar"]').innerText();
    assert.match(bar, /Você está vendo o Anvil como o plano Profissional/); assert.match(bar, /Voltar ao meu plano/);
    await o.context().close();
  });
  await step('espanhol: selo, janelinha e planos', async () => {
    await setPlan('essencial');
    const p = await newPage(S, DESKTOP, { lang: 'es' }); await openApp(p);
    await p.click('[data-nav="/whatsapp"]'); await modalOf(p).waitFor();
    const t = await modalOf(p).innerText();
    assert.match(t, /Disponible en el plan Completo/); assert.match(t, /WhatsApp/); assert.match(t, /al mes/); assert.match(t, /Ver planes/); assert.match(t, /Ahora no/);
    await shot(p, '06-janelinha-es');
    await p.click('[data-testid="plan-upsell-plans"]'); await p.waitForSelector('[data-plan-card="completo"]');
    assert.match(await p.locator('[data-plan-adds="completo"]').innerText(), /Todo lo de Profesional, más:/);
    await p.context().close();
  });
  await setPlan('completo');

  // ============ 7) sem erro no console ============
  await step('nenhum erro no console durante todos os testes', async () => {
    assert.deepEqual(consoleErrors, [], consoleErrors.join('\n'));
  });
} finally {
  console.log(`\n${passed} ok, ${failed} com erro. Fotos em ${SHOTS}`);
  await browser.close().catch(() => {});
  web.close();
  srv.kill();
  await new Promise((r) => setTimeout(r, 400));
  await db.end().catch(() => {});
  await admin.query(`DROP DATABASE IF EXISTS ${DBNAME} WITH (FORCE)`).catch((e) => console.log('não consegui apagar o banco', e.message));
  await admin.end().catch(() => {});
  process.exit(failed ? 1 : 0);
}
