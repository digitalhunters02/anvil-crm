// sampleData.e2e.mjs
// PARA QUE SERVE: confere no NAVEGADOR (Playwright + Chromium) os dados de exemplo do Anvil: o dono entra numa instalação VAZIA,
// vê as telas vazias, clica em "Carregar dados de exemplo" (Configurações), as telas principais passam a mostrar dados, um visitante
// do teste grátis de 3 dias entra e VÊ os dados, o dono remove (com confirmação) e as telas voltam a ficar vazias.
// Em inglês e português, a 390 px (celular) e a 1440 px, sem rolagem lateral em nenhuma tela nem na janela de confirmação.
// Precisa de: front compilado (npm run build), Postgres local e Playwright. Porta do servidor: livre e aleatória.
//   node e2e/sampleData.e2e.mjs        (as capturas de tela vão para $E2E_SHOTS ou ./e2e/shots)
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(here, '..', 'server', 'src');
const SHOTS = process.env.E2E_SHOTS || path.join(here, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const OWNER_EMAIL = 'owner@example.test';
const OWNER_PASS = 'E2e-owner-pass-1';
const ADMIN_URL = process.env.TEST_PG_ADMIN_URL || 'postgres://test:test@127.0.0.1:5432/postgres';
const DB = `anvil_sample_e2e_${process.pid}`;
const DB_URL = ADMIN_URL.replace(/\/[^/]*$/, `/${DB}`);

let failures = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) failures++; };
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

const PORT = await freePort();
const base = `http://127.0.0.1:${PORT}`;
const admin = new pg.Client({ connectionString: ADMIN_URL });
await admin.connect();
await admin.query(`CREATE DATABASE ${DB}`);
const env = {
  ...process.env, NODE_ENV: 'test', PORT: String(PORT), DATABASE_URL: DB_URL, JWT_SECRET: 'e2e-secret-e2e-secret-1234',
  BOOTSTRAP_OWNER_EMAIL: OWNER_EMAIL, BOOTSTRAP_OWNER_PASSWORD: OWNER_PASS, SMTP_HOST: '', DEMO_REQUEST_MAX: '100',
};
for (const k of ['LICENSED_PLAN', 'STRIPE_SECRET_KEY', 'SEED_SAMPLE_DATA', 'ANTHROPIC_API_KEY', 'HARBOR_API_URL']) delete env[k];
// Instalação VAZIA de propósito (sem seed.js): é o caso que o teste precisa cobrir.
const srv = spawn('node', [path.join(SERVER, 'index.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
srv.stdout.on('data', (d) => { serverLog += d; });
srv.stderr.on('data', (d) => { serverLog += d; });
for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* subindo */ } await new Promise((r) => setTimeout(r, 150)); }
const db = new pg.Client({ connectionString: DB_URL });
await db.connect();
const count = async (t, w = 'TRUE') => (await db.query(`SELECT COUNT(*)::int AS n FROM ${t} WHERE ${w}`)).rows[0].n;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });

// janela inteira e a área de rolagem do app (que esconde o que passa do lado): nenhuma das duas pode ter largura a mais
const hscroll = (page) => page.evaluate(() => {
  const main = document.querySelector('main.app-content');
  const sw = document.documentElement.scrollWidth; const iw = window.innerWidth;
  return { ok: sw <= iw && document.body.scrollWidth <= iw && (!main || main.scrollWidth <= main.clientWidth + 1), sw, iw, mainSw: main ? main.scrollWidth : 0, mainCw: main ? main.clientWidth : 0 };
});

const T = {
  en: {
    stateNone: 'No sample data is loaded.', stateLoaded: /Sample data is loaded: \d+ records\./, loadedOk: /Sample data loaded: \d+ records\./,
    removedOk: /Sample data removed: \d+ records\./, load: 'Load sample data', remove: 'Remove sample data', empty: 'No records yet.',
    banner: /Free trial: ends/,
  },
  pt: {
    stateNone: 'Nenhum dado de exemplo carregado.', stateLoaded: /Dados de exemplo carregados: \d+ registros\./, loadedOk: /Dados de exemplo carregados: \d+ registros\./,
    removedOk: /Dados de exemplo removidos: \d+ registros\./, load: 'Carregar dados de exemplo', remove: 'Remover dados de exemplo', empty: 'No records yet.',
    banner: /Teste grátis: termina em/,
  },
};

// tela -> texto que só aparece com os exemplos carregados
const SCREENS = [
  ['/', 'Work Orders by Status'], ['/customers', 'Ridgeline Bridge & Steel'], ['/rfqs', 'Bridge Deck Girder Assembly'], ['/quotes', 'Q-3101'],
  ['/work-orders', 'WO-5101'], ['/bill-of-materials', 'Girder web plate'], ['/inventory', 'STL-A36-050'], ['/shortages', 'A36 Steel Plate'],
  ['/costing', 'WO-5103'], ['/calendar', 'WO-5103'], ['/suppliers', 'Midland Steel Supply'], ['/purchase-orders', 'PO-4102'],
  ['/shipments', 'Saia LTL'], ['/invoices', 'INV-7102'], ['/quality-inspections', 'Pending Rework'], ['/automations', 'Overdue PO Alert'],
  ['/reports', 'Revenue'],
];

async function newPage(browserCtxOpts, lang) {
  const ctx = await browser.newContext(browserCtxOpts);
  await ctx.addInitScript((l) => { try { if (!sessionStorage.getItem('__lang_set')) { localStorage.setItem('anvil-lang', l); sessionStorage.setItem('__lang_set', '1'); } } catch { /* ignore */ } }, lang);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return { ctx, page, errors };
}

async function run(label, ctxOpts, lang, shots = {}) {
  const tr = T[lang];
  const tag = `[${label}/${lang}]`;
  const shot = async (page, key, name) => { if (shots[key]) await page.screenshot({ path: path.join(SHOTS, name), fullPage: false }); };

  // ---------- dono entra pela tela de login ----------
  const { ctx, page, errors } = await newPage(ctxOpts, lang);
  await page.goto(base + '/#/');
  await page.fill('input[name=email]', OWNER_EMAIL);
  await page.fill('input[name=password]', OWNER_PASS);
  await page.click('button[type=submit]');
  await page.waitForSelector('main.app-content');

  // ---------- 1. instalação vazia: telas vazias ----------
  check(`${tag} start: database really has no customers`, (await count('customers')) === 0);
  await page.goto(base + '/#/customers');
  await page.waitForFunction((n) => document.body.innerText.includes(n), tr.empty);
  check(`${tag} empty install: customers screen is empty`, true);
  await shot(page, 'empty', '1-vazio-clientes-390-en.png');

  // ---------- 2. Configurações: cartão do dono, estado "nada carregado" ----------
  await page.goto(base + '/#/settings');
  await page.waitForSelector('[data-testid=sample-state]');
  check(`${tag} settings: owner sees the sample data card`, (await page.locator('[data-testid=sample-card]').count()) === 1);
  check(`${tag} settings: says nothing is loaded`, (await page.locator('[data-testid=sample-state]').innerText()).trim() === tr.stateNone);
  check(`${tag} settings: load button text + enabled, remove button disabled`,
    (await page.locator('[data-testid=sample-load]').innerText()).trim() === tr.load && await page.locator('[data-testid=sample-load]').isEnabled()
    && await page.locator('[data-testid=sample-remove]').isDisabled());
  let m = await hscroll(page);
  check(`${tag} settings (empty): no horizontal scroll`, m.ok, JSON.stringify(m));

  // ---------- 3. carregar ----------
  await page.click('[data-testid=sample-load]');
  await page.waitForFunction(() => document.querySelector('[data-testid=sample-state]')?.dataset.loaded === 'true');
  check(`${tag} load: success message`, tr.loadedOk.test(await page.locator('[data-testid=sample-note]').innerText()), await page.locator('[data-testid=sample-note]').innerText());
  check(`${tag} load: state says loaded with a count`, tr.stateLoaded.test(await page.locator('[data-testid=sample-state]').innerText()));
  check(`${tag} load: counts list shows 8 rows`, (await page.locator('[data-testid=sample-counts] li').count()) === 8);
  check(`${tag} load: load button now disabled, remove enabled`, await page.locator('[data-testid=sample-load]').isDisabled() && await page.locator('[data-testid=sample-remove]').isEnabled());
  check(`${tag} load: database rows are marked as sample`, (await count('customers', 'is_sample')) === 9 && (await count('customers', 'NOT is_sample')) === 0);
  m = await hscroll(page);
  check(`${tag} settings (loaded): no horizontal scroll`, m.ok, JSON.stringify(m));
  await page.locator('[data-testid=sample-card]').scrollIntoViewIfNeeded();
  await shot(page, 'settings', '2-configuracoes-carregado-390-en.png');

  // segundo carregamento (outra requisição, como um segundo clique): não duplica
  const token = (await (await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASS }) })).json()).token;
  const again = await fetch(base + '/api/sample-data/load', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  const againJson = await again.json();
  check(`${tag} load twice: second call says already loaded and adds nothing`, again.status === 200 && againJson.already === true && (await count('customers')) === 9);

  // ---------- 4. as telas principais mostram dados ----------
  for (const [route, needle] of SCREENS) {
    await page.goto(base + '/#' + route);
    try {
      await page.waitForFunction((n) => document.body.innerText.toLowerCase().includes(n.toLowerCase()), needle, { timeout: 12000 });
      check(`${tag} screen ${route}: shows data ("${needle}")`, true);
    } catch {
      check(`${tag} screen ${route}: shows data ("${needle}")`, false, (await page.locator('body').innerText()).slice(0, 160).replace(/\n/g, ' | '));
    }
    const body = await page.locator('main.app-content').innerText();
    if (route !== '/' && route !== '/reports' && route !== '/shortages' && route !== '/calendar' && route !== '/costing') {
      check(`${tag} screen ${route}: not an empty table`, !body.includes(tr.empty));
    }
    m = await hscroll(page);
    check(`${tag} screen ${route}: no horizontal scroll`, m.ok, JSON.stringify(m));
    if (route === '/') await shot(page, 'dash', '3-painel-390-pt.png');
  }
  await page.goto(base + '/#/');
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('work orders by status'));
  const kpiText = await page.locator('main.app-content').innerText();
  check(`${tag} dashboard: KPIs are not all zero (revenue this month shows)`, /Revenue This Month/i.test(kpiText) && !/Revenue This Month\s*\n?\s*\$0\b/i.test(kpiText));
  check(`${tag} calendar: has bars`, await (async () => { await page.goto(base + '/#/calendar'); await page.waitForSelector('[data-testid=calendar-bar]', { timeout: 12000 }); return (await page.locator('[data-testid=calendar-bar]').count()) > 0; })());

  // ---------- 5. visitante do teste grátis enxerga os mesmos dados ----------
  const v = await newPage(ctxOpts, lang);
  await v.page.goto(base + '/#/');
  await v.page.waitForSelector('[data-testid=trial-open]');
  await v.page.click('[data-testid=trial-open]');
  await v.page.fill('input[name=trial-name]', 'Visitor Test');
  await v.page.fill('input[name=trial-email]', `visitor-${label}-${lang}@example.test`);
  await v.page.click('[data-testid=trial-submit]');
  await v.page.waitForSelector('[data-testid=trial-banner]');
  check(`${tag} trial: countdown bar shows`, tr.banner.test(await v.page.locator('[data-testid=trial-banner]').innerText()));
  await v.page.waitForFunction(() => document.body.innerText.toLowerCase().includes('work orders by status'));
  const trialDash = await v.page.locator('main.app-content').innerText();
  check(`${tag} trial: dashboard shows the sample data (work orders due soon, activity)`, /WO-5/.test(trialDash) && /Revenue This Month/i.test(trialDash));
  await shot(v.page, 'trial', '4-teste-gratis-painel-390-en.png');
  for (const [route, needle] of [['/customers', 'Ridgeline Bridge & Steel'], ['/inventory', 'STL-A36-050'], ['/calendar', 'WO-5103'], ['/invoices', 'INV-7102']]) {
    await v.page.goto(base + '/#' + route);
    try { await v.page.waitForFunction((n) => document.body.innerText.toLowerCase().includes(n.toLowerCase()), needle, { timeout: 12000 }); check(`${tag} trial: ${route} shows sample data`, true); }
    catch { check(`${tag} trial: ${route} shows sample data`, false); }
    m = await hscroll(v.page);
    check(`${tag} trial: ${route} no horizontal scroll`, m.ok, JSON.stringify(m));
  }
  await v.page.goto(base + '/#/settings');
  await v.page.waitForSelector('[data-testid=trial-account-note]');
  check(`${tag} trial: Settings has NO sample data card (owner only)`, (await v.page.locator('[data-testid=sample-card]').count()) === 0);
  check(`${tag} trial: no page errors`, v.errors.length === 0, v.errors.join(' | '));
  await v.ctx.close();

  // ---------- 6. remover: cancelar mantém, confirmar apaga ----------
  await page.goto(base + '/#/settings');
  await page.waitForFunction(() => document.querySelector('[data-testid=sample-state]')?.dataset.loaded === 'true');
  await page.click('[data-testid=sample-remove]');
  await page.waitForSelector('[data-testid=sample-remove-confirm]');
  m = await hscroll(page);
  check(`${tag} remove dialog: no horizontal scroll`, m.ok, JSON.stringify(m));
  const box = await page.locator('[data-testid=sample-remove-confirm]').boundingBox();
  check(`${tag} remove dialog: confirm button inside the screen`, !!box && box.x >= 0 && box.x + box.width <= m.iw + 1, JSON.stringify(box));
  await page.click('[data-testid=sample-remove-cancel]');
  await page.waitForSelector('[data-testid=sample-remove-confirm]', { state: 'detached' });
  check(`${tag} remove: cancel keeps everything`, (await count('customers', 'is_sample')) === 9);
  // dado REAL criado enquanto o exemplo existe: tem de sobreviver à remoção
  const people = await (await fetch(base + '/api/users', { headers: { Authorization: `Bearer ${token}` } })).json();
  const real = await fetch(base + '/api/suppliers', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Real Supplier Co', specialty: 'Steel', contact_name: 'R', contact_email: 'r@example.test', contact_phone: '(219) 555-0101', lead_time_days: 3 }) });
  check(`${tag} real supplier created while samples exist`, real.status === 201 && people.length > 0);
  await page.click('[data-testid=sample-remove]');
  await page.click('[data-testid=sample-remove-confirm]');
  await page.waitForFunction(() => document.querySelector('[data-testid=sample-state]')?.dataset.loaded === 'false');
  check(`${tag} remove: success message`, tr.removedOk.test(await page.locator('[data-testid=sample-note]').innerText()), await page.locator('[data-testid=sample-note]').innerText());
  check(`${tag} remove: sample rows gone, real supplier kept`,
    (await count('customers')) === 0 && (await count('work_orders')) === 0 && (await count('inventory_items')) === 0
    && (await count('suppliers', `name = 'Real Supplier Co' AND NOT is_sample`)) === 1 && (await count('suppliers', 'is_sample')) === 0);
  m = await hscroll(page);
  check(`${tag} settings (after remove): no horizontal scroll`, m.ok, JSON.stringify(m));
  await page.goto(base + '/#/customers');
  await page.waitForFunction((n) => document.body.innerText.includes(n), tr.empty);
  check(`${tag} after remove: customers screen is empty again`, true);
  // limpa o fornecedor real para a próxima volta começar do zero
  await db.query(`DELETE FROM suppliers WHERE name = 'Real Supplier Co'`);

  check(`${tag} owner session: no uncaught page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

try {
  await run('390', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'en', { empty: true, settings: true, trial: true });
  await run('390', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'pt', { dash: true });
  await run('1440', { viewport: { width: 1440, height: 900 } }, 'en');
  check('server log has no password', !serverLog.includes(OWNER_PASS));
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
  srv.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 300));
  await db.end();
  await admin.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
  await admin.end();
}
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
