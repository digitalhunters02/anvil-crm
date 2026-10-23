// PARA QUE SERVE: garante a regra "o dono / a instalação própria da Impact Digital fica SEMPRE no plano mais alto".
// O plano mais alto é CALCULADO (topPlan() = maior PLAN_RANK), nunca escrito à mão. Cobre: instalação sem Stripe e sem
// assinatura = topo; plano novo (fictício, só em memória) vira o topo sem mudar código; LICENSED_PLAN=max = topo;
// LICENSED_PLAN com nome de plano continua fixando esse plano; cliente com assinatura continua com o plano da assinatura.
// A conta de teste grátis (is_demo_trial) NÃO é o dono: este teste não mexe nelas.
// Precisa de um Postgres local (cria e apaga um banco temporário), como billing.test.mjs:
//   TEST_PG_ADMIN_URL=postgres://test:test@localhost:5432/postgres node --test server/test/topPlan.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const ADMIN_URL = process.env.TEST_PG_ADMIN_URL || 'postgres://test:test@localhost:5432/postgres';
const DB_NAME = `topplan_${process.pid}_${Date.now() % 100000}`;
const DB_URL = ADMIN_URL.replace(/\/[^/]*$/, `/${DB_NAME}`);

let admin, billing, db;
const ENV_KEYS = ['LICENSED_PLAN', 'STRIPE_SECRET_KEY'];
const saved = {};

const semStripe = () => { delete process.env.STRIPE_SECRET_KEY; delete process.env.LICENSED_PLAN; };
const comStripe = () => { process.env.STRIPE_SECRET_KEY = 'sk_test_fake_nao_usada'; delete process.env.LICENSED_PLAN; };
const setSub = (plan, status, stripeSubId) => db.run(
  `INSERT INTO subscription (id, plan, status, stripe_subscription_id) VALUES (1, $1, $2, $3)
   ON CONFLICT (id) DO UPDATE SET plan = $1, status = $2, stripe_subscription_id = $3`, plan, status, stripeSubId);

before(async () => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  admin = new pg.Client({ connectionString: ADMIN_URL }); await admin.connect();
  await admin.query(`CREATE DATABASE ${DB_NAME}`);
  process.env.DATABASE_URL = DB_URL;
  db = await import('../src/db.js');
  db.default.on('error', () => {}); // conexão ociosa derrubada ao apagar o banco temporário não pode virar erro solto
  await db.initSchema();
  billing = await import('../src/billing.js');
});
after(async () => {
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  await db?.default.end();
  await admin.query(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`); await admin.end();
});

test('topPlan() é o plano de maior PLAN_RANK', () => {
  const { PLAN_RANK, topPlan } = billing;
  const maior = Object.keys(PLAN_RANK).sort((a, b) => PLAN_RANK[b] - PLAN_RANK[a])[0];
  assert.equal(topPlan(), maior);
});

test('(a) sem Stripe e sem assinatura: o plano em vigor é o topo', async () => {
  semStripe();
  assert.equal(await billing.effectivePlan(), billing.topPlan());
  comStripe(); // com Stripe, mas sem assinatura por trás (instalação própria / demonstração)
  await setSub('basico', 'active', null);
  assert.equal(await billing.effectivePlan(), billing.topPlan());
});

test('(b) plano novo mais alto (só em memória) vira o topo do dono sem mudar código', async () => {
  const { PLAN_RANK, topPlan, effectivePlan } = billing;
  const antes = topPlan();
  PLAN_RANK.zzteste = 99;
  try {
    assert.equal(topPlan(), 'zzteste');
    semStripe();
    assert.equal(await effectivePlan(), 'zzteste');
    comStripe(); await setSub('basico', 'active', null);
    assert.equal(await effectivePlan(), 'zzteste');
    process.env.LICENSED_PLAN = 'max';
    assert.equal(await effectivePlan(), 'zzteste');
  } finally {
    delete PLAN_RANK.zzteste; delete process.env.LICENSED_PLAN;
  }
  assert.equal(topPlan(), antes);
  semStripe();
  assert.equal(await effectivePlan(), antes);
});

test('(c) LICENSED_PLAN=max dá o topo, mesmo com assinatura menor no banco', async () => {
  comStripe(); await setSub('basico', 'active', 'sub_fake_1');
  process.env.LICENSED_PLAN = 'max';
  assert.equal(await billing.effectivePlan(), billing.topPlan());
  assert.equal(billing.licensedPlan(), billing.topPlan());
  delete process.env.LICENSED_PLAN;
});

test('(d) LICENSED_PLAN com nome de plano continua dando exatamente esse plano', async () => {
  semStripe();
  for (const p of Object.keys(billing.PLAN_RANK)) {
    process.env.LICENSED_PLAN = p;
    assert.equal(await billing.effectivePlan(), p, p);
  }
  process.env.LICENSED_PLAN = 'essencial';
  assert.equal(await billing.effectivePlan(), 'essencial');
  process.env.LICENSED_PLAN = 'plano-que-nao-existe'; // inválido: ignorado, cai na regra normal (sem Stripe = topo)
  assert.equal(billing.licensedPlan(), null);
  assert.equal(await billing.effectivePlan(), billing.topPlan());
  delete process.env.LICENSED_PLAN;
});

test('(e) cliente com assinatura do Stripe continua com o plano da assinatura', async () => {
  comStripe();
  await setSub('essencial', 'active', 'sub_fake_2');
  assert.equal(await billing.effectivePlan(), 'essencial');
  await setSub('basico', 'trialing', 'sub_fake_3');
  assert.equal(await billing.effectivePlan(), 'basico');
  await setSub('completo', 'canceled', 'sub_fake_4'); // assinatura vencida cai para o básico, como antes
  assert.equal(await billing.effectivePlan(), 'basico');
  await setSub('plano-velho', 'active', 'sub_fake_5'); // plano desconhecido na assinatura: básico, como antes
  assert.equal(await billing.effectivePlan(), 'basico');
});
