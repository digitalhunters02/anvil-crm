// Browser check of the free 3-day trial: ask for the trial on the sign-in screen, see the countdown bar, try a blocked
// action, see the end of the trial. English and Portuguese, at phone (390 px) and desktop widths.
// Needs: client built (npm run build), local Postgres, Playwright. Ports 7825 (fake Harbor) and 7828 (server).
//   node e2e/trial.e2e.mjs        (screenshots go to $E2E_SHOTS or ./e2e/shots)
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
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

const PRODUCT = 'anvil';
const OWNER_EMAIL = 'owner@example.com';
const OWNER_PASS = 'E2e-owner-pass-1';
const ADMIN_KEY = 'e'.repeat(40);
const HARBOR_PORT = Number(process.env.E2E_HARBOR_PORT || 7825);
const PORT = Number(process.env.E2E_PORT || 7828);
const ADMIN_URL = process.env.TEST_PG_ADMIN_URL || 'postgres://test:test@localhost:5432/postgres';
const DB = `anvil_trial_e2e_${process.pid}`;
const DB_URL = ADMIN_URL.replace(/\/[^/]*$/, `/${DB}`);

let failures = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) failures++; };

const leads = [];
const harbor = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => { leads.push({ url: req.url, key: req.headers['x-capture-key'], body: body ? JSON.parse(body) : null }); res.end('{"ok":true}'); });
});
await new Promise((r) => harbor.listen(HARBOR_PORT, '127.0.0.1', r));

const admin = new pg.Client({ connectionString: ADMIN_URL });
await admin.connect();
await admin.query(`CREATE DATABASE ${DB}`);
const seed = spawnSync('node', [path.join(SERVER, 'seed.js')], { env: { ...process.env, DATABASE_URL: DB_URL }, encoding: 'utf8' });
if (seed.status !== 0) { console.error(seed.stderr); process.exit(1); }
const srv = spawn('node', [path.join(SERVER, 'index.js')], {
  env: { ...process.env, NODE_ENV: 'test', PORT: String(PORT), DATABASE_URL: DB_URL, JWT_SECRET: 'e2e-secret-e2e-secret-1234',
    BOOTSTRAP_OWNER_EMAIL: OWNER_EMAIL, BOOTSTRAP_OWNER_PASSWORD: OWNER_PASS, SMTP_HOST: '',
    HARBOR_API_URL: `http://127.0.0.1:${HARBOR_PORT}`, ADMIN_SUMMARY_KEY: ADMIN_KEY, DEMO_REQUEST_MAX: '100' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
srv.stdout.on('data', (d) => { serverLog += d; });
srv.stderr.on('data', (d) => { serverLog += d; });
const base = `http://127.0.0.1:${PORT}`;
for (let i = 0; i < 100; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* wait */ } await new Promise((r) => setTimeout(r, 150)); }

const db = new pg.Client({ connectionString: DB_URL });
await db.connect();

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const noHScroll = (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, bw: document.body.scrollWidth }));

const T = {
  en: { cta: /Free 3-day trial/, banner: /Free trial: ends/, blocked: 'Not available in the free trial.', ended: /free trial has ended/i, inUse: /already in use/i, subscribe: 'Subscribe' },
  pt: { cta: /Teste grátis de 3 dias/, banner: /Teste grátis: termina em/, blocked: 'Não disponível no teste grátis.', ended: /teste grátis terminou/i, inUse: /já está em uso/i, subscribe: 'Assinar' },
};

async function run(label, ctxOpts, lang) {
  const tr = T[lang];
  const tag = `[${label}/${lang}]`;
  const ctx = await browser.newContext(ctxOpts);
  await ctx.addInitScript((l) => { try { if (!sessionStorage.getItem('__lang_set')) { localStorage.setItem('anvil-lang', l); sessionStorage.setItem('__lang_set', '1'); } } catch { /* ignore */ } }, lang);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const email = `visitor-${label}-${lang}@example.com`;

  // --- sign-in screen has the trial button; the form opens ---
  await page.goto(base + '/?utm_source=facebook&utm_medium=paid&utm_campaign=camp1&fbclid=FB123&junk=1#/');
  await page.waitForSelector('[data-testid=trial-open]');
  check(`${tag} login: trial button text`, tr.cta.test(await page.locator('[data-testid=trial-open]').innerText()));
  let m = await noHScroll(page);
  check(`${tag} login: no horizontal scroll`, m.sw <= m.iw && m.bw <= m.iw, `scrollWidth=${m.sw} inner=${m.iw}`);
  await page.click('[data-testid=trial-open]');
  await page.waitForSelector('[data-testid=trial-form]');
  m = await noHScroll(page);
  check(`${tag} trial form: no horizontal scroll`, m.sw <= m.iw && m.bw <= m.iw, `scrollWidth=${m.sw} inner=${m.iw}`);
  if (ctxOpts.isMobile) {
    const fs16 = await page.evaluate(() => [...document.querySelectorAll('[data-testid=trial-form] input')].map((i) => getComputedStyle(i).fontSize));
    check(`${tag} trial form: inputs are 16px on touch`, fs16.length === 2 && fs16.every((f) => f === '16px'), fs16.join(','));
  }
  await page.screenshot({ path: path.join(SHOTS, `${PRODUCT}-trial-form-${label}-${lang}.png`) });

  // a real account email -> friendly "already in use" and still on the form
  await page.fill('input[name=trial-name]', 'Fake Owner');
  await page.fill('input[name=trial-email]', OWNER_EMAIL);
  await page.click('[data-testid=trial-submit]');
  await page.waitForSelector('[role=alert]');
  check(`${tag} trial form: real account email gets "already in use"`, tr.inUse.test(await page.locator('[role=alert]').innerText()));

  // --- the real request: lands inside the app with the countdown bar ---
  leads.length = 0;
  await page.fill('input[name=trial-name]', 'Visitor Test');
  await page.fill('input[name=trial-email]', email);
  await page.click('[data-testid=trial-submit]');
  await page.waitForSelector('[data-testid=trial-banner]');
  const bannerText = await page.locator('[data-testid=trial-banner]').innerText();
  check(`${tag} app: countdown bar says when the trial ends`, tr.banner.test(bannerText), bannerText.replace(/\n/g, ' | '));
  check(`${tag} app: sample data visible`, /Vanguard|Dashboard/.test(await page.locator('body').innerText()));
  m = await noHScroll(page);
  check(`${tag} app: no horizontal scroll`, m.sw <= m.iw && m.bw <= m.iw, `scrollWidth=${m.sw} inner=${m.iw}`);
  const barBox = await page.locator('[data-testid=trial-banner]').boundingBox();
  check(`${tag} app: bar is inside the screen`, barBox && barBox.x >= 0 && barBox.x + barBox.width <= m.iw + 1, JSON.stringify(barBox));
  await page.screenshot({ path: path.join(SHOTS, `${PRODUCT}-trial-app-${label}-${lang}.png`) });

  // Harbor was told, with the ad origin kept
  for (let i = 0; i < 30 && !leads.length; i++) await new Promise((r) => setTimeout(r, 100));
  const lead = leads[0];
  check(`${tag} harbor: lead sent with key, product, notes`, !!lead && lead.url === '/api/public/leads' && lead.key === ADMIN_KEY && lead.body.product === 'Anvil'
    && lead.body.source === 'Trial signup' && lead.body.notes === '3-day demo trial (demo-request)' && lead.body.email === email);
  check(`${tag} harbor: ad origin (utm_*, fbclid) passed; unknown parameters dropped`, !!lead && lead.body.utm_source === 'facebook' && lead.body.utm_medium === 'paid'
    && lead.body.utm_campaign === 'camp1' && lead.body.fbclid === 'FB123' && !('junk' in lead.body));

  // --- "Subscribe" goes to the contact text ---
  await page.click('[data-testid=trial-subscribe]');
  await page.waitForSelector('[data-testid=trial-contact]');
  const href = await page.locator('a[href^="mailto:"]').getAttribute('href');
  check(`${tag} subscribe: contact text with the support e-mail`, /^mailto:support@impactdigital\.network/.test(href || ''), href);
  m = await noHScroll(page);
  check(`${tag} subscribe: no horizontal scroll`, m.sw <= m.iw && m.bw <= m.iw);
  await page.screenshot({ path: path.join(SHOTS, `${PRODUCT}-trial-contact-${label}-${lang}.png`) });
  await page.click('[data-testid=trial-close]');
  await page.waitForSelector('[data-testid=trial-contact]', { state: 'detached' });

  // --- a blocked action shows the message: import from photo ---
  await page.goto(base + '/#/customers');
  await page.waitForSelector('[data-testid=photo-import-open]');
  await page.click('[data-testid=photo-import-open]');
  // the closed photo reading is announced as soon as the window opens, with no picker and no usage count
  await page.waitForSelector('[data-testid=photo-error]');
  check(`${tag} blocked action: photo import shows the trial message`, (await page.locator('[data-testid=photo-error]').innerText()).trim() === tr.blocked,
    await page.locator('[data-testid=photo-error]').innerText());
  check(`${tag} blocked action: no picker and no usage count for the trial`, await page.locator('[data-testid=photo-file]').count() === 0
    && !/photo reads used|leituras/.test(await page.locator('[data-testid=photo-modal]').innerText()));
  m = await noHScroll(page);
  check(`${tag} blocked action: no horizontal scroll`, m.sw <= m.iw && m.bw <= m.iw);
  await page.screenshot({ path: path.join(SHOTS, `${PRODUCT}-trial-blocked-${label}-${lang}.png`) });

  // --- settings: no password form for a trial login; the bar is on every page ---
  await page.goto(base + '/#/settings');
  await page.waitForSelector('[data-testid=trial-account-note]');
  check(`${tag} settings: no change-password form in the trial`, await page.locator('input[name=current-password]').count() === 0);
  check(`${tag} settings: bar still visible`, await page.locator('[data-testid=trial-banner]').count() === 1);
  m = await noHScroll(page);
  check(`${tag} settings: no horizontal scroll`, m.sw <= m.iw && m.bw <= m.iw, `scrollWidth=${m.sw} inner=${m.iw}`);

  // --- WhatsApp page does not hang or break (the inbox is closed to trials) ---
  await page.goto(base + '/#/whatsapp');
  await page.waitForTimeout(900);
  check(`${tag} whatsapp page renders for a trial`, (await page.locator('body').innerText()).length > 50);

  // --- reload keeps the trial session ---
  await page.reload();
  await page.waitForSelector('[data-testid=trial-banner]');
  check(`${tag} session survives reload`, true);

  // --- the trial ends: back to the sign-in screen with a note ---
  await db.query(`UPDATE accounts SET demo_expires_at = now() - interval '1 minute' WHERE lower(email) = $1`, [email]);
  await page.reload();
  await page.waitForSelector('[data-testid=trial-open]');
  await page.waitForSelector('[role=alert]');
  check(`${tag} ended: back at sign-in with the "trial ended" note`, tr.ended.test(await page.locator('[role=alert]').innerText()));
  await page.screenshot({ path: path.join(SHOTS, `${PRODUCT}-trial-ended-${label}-${lang}.png`) });

  check(`${tag} no uncaught page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

try {
  await run('390', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'en');
  await run('390', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'pt');
  await run('1440', { viewport: { width: 1440, height: 900 } }, 'en');
  await run('1440', { viewport: { width: 1440, height: 900 } }, 'pt');
  check('server log has no key or password', !serverLog.includes(ADMIN_KEY) && !serverLog.includes(OWNER_PASS));
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
  srv.kill('SIGTERM');
  harbor.close();
  await new Promise((r) => setTimeout(r, 300));
  await db.end();
  await admin.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
  await admin.end();
}
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
