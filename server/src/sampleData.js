// sampleData.js
// PARA QUE SERVE: carrega e REMOVE os dados de exemplo do Anvil, para a pessoa (e o visitante do teste grátis de 3 dias, que
// enxerga os dados da instalação) ver telas cheias em vez de vazias. O conteúdo está em sampleDataset.js.
//
// SEGURANÇA (o que este arquivo garante):
//  - Tudo que ele grava leva is_sample = TRUE. REMOVER apaga SÓ linhas com is_sample = TRUE. Nunca toca em dado real.
//  - Um registro de exemplo que um dado REAL ainda usa (ex.: uma ordem real feita para um cliente de exemplo) NÃO é apagado;
//    a resposta conta quantos ficaram ("kept").
//  - NUNCA carrega em instalação que já tem dados reais (clientes, cotações, orçamentos, fornecedores, pedidos de compra,
//    ordens de serviço, faturas ou itens de estoque que não sejam de exemplo).
//  - IDEMPOTENTE: carregar duas vezes não duplica (a segunda devolve "already"); duas pessoas clicando juntas também não
//    (trava de aviso do Postgres dentro da transação).
//  - DESLIGADO por padrão. Só liga: (1) o dono clicando em Configurações; (2) SEED_SAMPLE_DATA=true no boot, e mesmo assim só
//    se a base não tiver nenhum dado real; (3) o comando `npm run sample -w server -- load`.
//  - A conta do teste grátis NÃO vê estes botões nem as rotas (dono apenas, blockDemo); ela só LÊ/ESCREVE os dados como já fazia.
//
// Datas: os exemplos são montados com datas relativas a hoje; rollSampleDates() empurra as datas dos exemplos junto com o
// calendário (sample_data_meta guarda o dia de referência), do mesmo jeito que o Roster faz.
import pool from './db.js';
import { buildSampleDataset } from './sampleDataset.js';

const DAY = 864e5;
const LOCK_KEY = 7203114; // trava de aviso do Postgres: carregar/remover/rolar nunca correm ao mesmo tempo

// Todas as tabelas com exemplo, na ordem em que aparecem nas contagens.
export const SAMPLE_TABLES = [
  'users', 'customers', 'rfqs', 'quotes', 'bill_of_materials', 'suppliers', 'purchase_orders', 'work_orders',
  'quality_inspections', 'shipments', 'invoices', 'activities', 'automations', 'inventory_items', 'stock_moves', 'work_order_labor',
];

// Se qualquer uma destas tem linha que NÃO é de exemplo, a instalação tem dado real e nada é carregado.
const REAL_DATA_TABLES = ['customers', 'rfqs', 'quotes', 'suppliers', 'purchase_orders', 'work_orders', 'invoices', 'inventory_items'];

// Ordem de remoção: filhos antes dos pais. Para cada tabela, quem ainda aponta para ela depois de apagar os filhos de exemplo
// (sobrou só dado real) a segura no lugar: [tabela filha, coluna].
const REMOVE_PLAN = [
  ['work_order_labor', []],
  ['stock_moves', []],
  ['quality_inspections', []],
  ['shipments', []],
  ['invoices', []],
  ['activities', []],
  ['automations', []],
  ['bill_of_materials', []],
  ['work_orders', [['quality_inspections', 'work_order_id'], ['shipments', 'work_order_id'], ['invoices', 'work_order_id'], ['stock_moves', 'work_order_id'], ['work_order_labor', 'work_order_id']]],
  ['purchase_orders', []],
  ['quotes', [['bill_of_materials', 'quote_id'], ['work_orders', 'quote_id']]],
  ['rfqs', [['quotes', 'rfq_id']]],
  ['inventory_items', [['stock_moves', 'item_id']]],
  ['suppliers', [['purchase_orders', 'supplier_id']]],
  ['customers', [['rfqs', 'customer_id'], ['quotes', 'customer_id'], ['work_orders', 'customer_id'], ['shipments', 'customer_id'], ['invoices', 'customer_id']]],
  ['users', [['customers', 'owner_user_id'], ['rfqs', 'owner_user_id'], ['quotes', 'owner_user_id'], ['work_orders', 'owner_user_id'], ['quality_inspections', 'inspector_user_id'], ['activities', 'owner_user_id']]],
];

// Colunas de data dos exemplos que acompanham o calendário: [tabela, coluna, tipo].
const ROLL_COLUMNS = [
  ['rfqs', 'received_date', 'date'], ['rfqs', 'due_date', 'date'], ['quotes', 'valid_until', 'date'],
  ['purchase_orders', 'order_date', 'date'], ['purchase_orders', 'expected_date', 'date'],
  ['work_orders', 'start_date', 'date'], ['work_orders', 'due_date', 'date'],
  ['quality_inspections', 'inspection_date', 'date'], ['shipments', 'ship_date', 'date'],
  ['invoices', 'issue_date', 'date'], ['invoices', 'due_date', 'date'],
  ['activities', 'occurred_at', 'datetime'], ['inventory_items', 'created_at', 'date'],
  ['work_order_labor', 'work_date', 'date'], ['stock_moves', 'created_at', 'timestamptz'],
];

const dayOnly = (d = new Date()) => d.toISOString().slice(0, 10);
const diffDays = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY);

class SampleError extends Error {
  constructor(code, message, status = 409) { super(message); this.code = code; this.status = status; }
}

// Transação com trava: quem chega depois espera e então enxerga o resultado de quem chegou antes.
async function inTx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY]);
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

async function countSample(c, table) {
  return (await c.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE is_sample`)).rows[0].n;
}
async function sampleCounts(c) {
  const counts = {};
  for (const t of SAMPLE_TABLES) counts[t] = await countSample(c, t);
  return counts;
}
async function hasRealData(c) {
  for (const t of REAL_DATA_TABLES) {
    if ((await c.query(`SELECT 1 FROM ${t} WHERE NOT is_sample LIMIT 1`)).rowCount) return true;
  }
  return false;
}
const sum = (counts) => Object.values(counts).reduce((a, n) => a + n, 0);

// Estado atual, para a tela de Configurações e para o comando de linha.
export async function sampleStatus() {
  const c = await pool.connect();
  try {
    const counts = await sampleCounts(c);
    const total = sum(counts);
    const real = await hasRealData(c);
    return { loaded: total > 0, total, counts, hasRealData: real, canLoad: total === 0 && !real, bootFlag: sampleSeedEnabled() };
  } finally {
    c.release();
  }
}

async function ins(c, table, row) {
  const cols = Object.keys(row);
  const sql = `INSERT INTO ${table} (${cols.join(', ')}, is_sample) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}, TRUE) RETURNING id`;
  return (await c.query(sql, cols.map((k) => row[k]))).rows[0].id;
}

// Carrega os exemplos. Devolve { already: true } se já estavam carregados; recusa (409) se a instalação tem dado real.
export async function loadSampleData({ today = new Date() } = {}) {
  return inTx(async (c) => {
    const before = await sampleCounts(c);
    if (sum(before) > 0) return { already: true, created: 0, counts: before };
    if (await hasRealData(c)) throw new SampleError('sample_has_real_data', 'This installation already has real data, so sample data was not loaded.');

    const ds = buildSampleDataset(today);
    const id = { user: {}, customer: {}, rfq: {}, quote: {}, supplier: {}, wo: {}, item: {} };

    for (const u of ds.users) id.user[u.k] = await ins(c, 'users', { name: u.name, email: u.email, role: u.role, initials: u.initials, color: u.color });
    for (const x of ds.customers) {
      id.customer[x.k] = await ins(c, 'customers', {
        name: x.name, industry: x.industry, address: x.address, city: x.city, state: x.state, contact_name: x.contact_name,
        contact_email: x.contact_email, contact_phone: x.contact_phone, owner_user_id: id.user[x.owner], status: x.status, notes: x.notes,
      });
    }
    for (const r of ds.rfqs) {
      id.rfq[r.k] = await ins(c, 'rfqs', {
        customer_id: id.customer[r.c], title: r.title, description: r.description, target_price: r.target_price, due_date: r.due,
        status: r.status, owner_user_id: id.user[r.owner], received_date: r.received,
      });
    }
    const quoteTotal = {};
    for (const q of ds.quotes) {
      quoteTotal[q.k] = q.total;
      id.quote[q.k] = await ins(c, 'quotes', {
        rfq_id: q.rfq ? id.rfq[q.rfq] : null, customer_id: id.customer[q.c], quote_number: q.number, total_amount: q.total,
        status: q.status, valid_until: q.valid, owner_user_id: id.user[q.owner],
      });
    }
    for (const b of ds.bom) {
      await ins(c, 'bill_of_materials', {
        quote_id: id.quote[b.q], part_name: b.part_name, material: b.material, quantity: b.quantity,
        unit_of_measure: b.uom, unit_cost: b.unit_cost, notes: b.notes,
      });
    }
    for (const s of ds.suppliers) {
      id.supplier[s.k] = await ins(c, 'suppliers', {
        name: s.name, specialty: s.specialty, contact_name: s.contact_name, contact_email: s.contact_email,
        contact_phone: s.contact_phone, lead_time_days: s.lead_time_days, notes: s.notes,
      });
    }
    for (const p of ds.purchaseOrders) {
      await ins(c, 'purchase_orders', {
        supplier_id: id.supplier[p.s], po_number: p.po, status: p.status, total_amount: p.total,
        order_date: p.order, expected_date: p.expected, notes: p.notes,
      });
    }
    const woMeta = {};
    for (const w of ds.workOrders) {
      woMeta[w.k] = w;
      id.wo[w.k] = await ins(c, 'work_orders', {
        quote_id: w.q ? id.quote[w.q] : null, customer_id: id.customer[w.c], work_order_number: w.number, status: w.status,
        owner_user_id: id.user[w.owner], start_date: w.start, due_date: w.due, notes: w.notes,
      });
    }
    for (const i of ds.inspections) {
      await ins(c, 'quality_inspections', {
        work_order_id: id.wo[i.wo], inspector_user_id: id.user.quality, inspection_date: i.date, result: i.result, notes: i.notes,
      });
    }
    for (const s of ds.shipments) {
      await ins(c, 'shipments', {
        work_order_id: id.wo[s.wo], customer_id: id.customer[woMeta[s.wo].c], ship_date: s.ship, carrier: s.carrier,
        tracking_number: s.tracking, status: s.status,
      });
    }
    for (const v of ds.invoices) {
      const w = woMeta[v.wo];
      await ins(c, 'invoices', {
        work_order_id: id.wo[v.wo], customer_id: id.customer[w.c], invoice_number: v.number,
        amount: v.amount ?? (w.q ? quoteTotal[w.q] : 0), status: v.status, issue_date: v.issue, due_date: v.due,
      });
    }
    const relTable = { rfq: id.rfq, quote: id.quote, work_order: id.wo };
    for (const a of ds.activities) {
      const [relType, relKey] = a.rel;
      await ins(c, 'activities', {
        type: a.type, subject: a.subject, related_type: relType, related_id: relType && relKey ? relTable[relType][relKey] : null,
        owner_user_id: id.user[a.owner], occurred_at: a.at, notes: null,
      });
    }
    for (const a of ds.automations) {
      await ins(c, 'automations', { name: a.name, trigger_desc: a.trigger_desc, action_desc: a.action_desc, active: a.active, runs_30d: a.runs_30d });
    }
    const itemCreated = dayOnly(new Date(today.getTime() - 65 * DAY));
    const itemCost = {};
    for (const i of ds.inventory) {
      itemCost[i.k] = i.unit_cost;
      id.item[i.k] = await ins(c, 'inventory_items', {
        sku: i.sku, name: i.name, material: i.material, uom: i.uom, min_stock: i.min_stock, unit_cost: i.unit_cost,
        location: i.location, barcode: i.barcode, tracking: i.tracking, created_at: itemCreated,
      });
    }
    for (const m of ds.stockMoves) {
      await ins(c, 'stock_moves', {
        item_id: id.item[m.item], qty: m.qty, reason: m.reason, lot: m.lot ?? null, work_order_id: m.wo ? id.wo[m.wo] : null,
        unit_cost: itemCost[m.item], note: m.note ?? null, created_at: new Date(today.getTime() - m.ago * DAY).toISOString(),
      });
    }
    for (const l of ds.labor) {
      await ins(c, 'work_order_labor', {
        work_order_id: id.wo[l.wo], work_date: dayOnly(new Date(today.getTime() - l.ago * DAY)), hours: l.hours, rate: l.rate, note: l.note,
      });
    }
    await c.query(
      `INSERT INTO sample_data_meta (id, anchor_date, loaded_at) VALUES (1, $1, now())
       ON CONFLICT (id) DO UPDATE SET anchor_date = EXCLUDED.anchor_date, loaded_at = now()`,
      [dayOnly(today)]
    );
    const counts = await sampleCounts(c);
    return { already: false, created: sum(counts), counts };
  });
}

// Remove SÓ o que é de exemplo. Registro de exemplo que dado real ainda usa fica (contado em `kept`).
export async function removeSampleData() {
  return inTx(async (c) => {
    const removed = {};
    for (const [table, guards] of REMOVE_PLAN) {
      const notUsed = guards.map(([child, col]) => `NOT EXISTS (SELECT 1 FROM ${child} WHERE ${child}.${col} = ${table}.id)`).join(' AND ');
      const r = await c.query(`DELETE FROM ${table} WHERE is_sample${notUsed ? ` AND ${notUsed}` : ''}`);
      removed[table] = r.rowCount;
    }
    const kept = sum(await sampleCounts(c));
    if (kept === 0) await c.query('DELETE FROM sample_data_meta');
    return { removed: sum(removed), counts: removed, kept };
  });
}

// Empurra as datas dos exemplos para acompanhar o calendário (só linhas is_sample). Devolve quantos dias moveu.
export async function rollSampleDates({ today = new Date() } = {}) {
  return inTx(async (c) => {
    const meta = (await c.query('SELECT anchor_date FROM sample_data_meta WHERE id = 1')).rows[0];
    if (!meta) return 0;
    const days = diffDays(dayOnly(today), meta.anchor_date);
    if (days < 1) return 0;
    for (const [table, col, kind] of ROLL_COLUMNS) {
      const expr = kind === 'timestamptz'
        ? `${col} + make_interval(hours => $1::int * 24)`
        : kind === 'datetime'
          ? `to_char(substr(${col}, 1, 10)::date + $1::int, 'YYYY-MM-DD') || substr(${col}, 11)`
          : `to_char(${col}::date + $1::int, 'YYYY-MM-DD')`;
      const guard = kind === 'timestamptz' ? '' : ` AND ${col} ~ '^\\d{4}-\\d{2}-\\d{2}'`;
      await c.query(`UPDATE ${table} SET ${col} = ${expr} WHERE is_sample${guard}`, [days]);
    }
    await c.query('UPDATE sample_data_meta SET anchor_date = $1 WHERE id = 1', [dayOnly(today)]);
    return days;
  });
}

export function sampleSeedEnabled() {
  return /^(true|1|yes)$/i.test(String(process.env.SEED_SAMPLE_DATA || '').trim());
}

// No boot: SÓ com SEED_SAMPLE_DATA=true e SÓ se a base não tem dado real (loadSampleData confere). Nunca derruba o servidor.
export async function seedSampleOnBoot() {
  if (!sampleSeedEnabled()) return null;
  try {
    const r = await loadSampleData();
    console.log(r.already ? 'SEED_SAMPLE_DATA: sample data already loaded - nothing added.' : `SEED_SAMPLE_DATA: loaded ${r.created} sample records.`);
    return r;
  } catch (e) {
    if (e.code === 'sample_has_real_data') console.log('SEED_SAMPLE_DATA is on, but this installation already has real data: sample data NOT loaded.');
    else console.error('SEED_SAMPLE_DATA: could not load sample data:', e.message);
    return null;
  }
}

export function startSampleScheduler() {
  const tick = () => rollSampleDates().catch((e) => console.error('Sample data date roll failed:', e.message));
  setTimeout(tick, 20000).unref();
  setInterval(tick, 6 * 60 * 60 * 1000).unref();
}

// Rotas do dono (Configurações). Mantidas fora do index.js para o arquivo principal crescer só uma linha.
export function mountSampleData(app, ar, requireOwner, blockDemo) {
  const fail = (res, e) => {
    if (e instanceof SampleError) return res.status(e.status).json({ error: e.message, code: e.code });
    throw e;
  };
  app.get('/api/sample-data/status', requireOwner, blockDemo, ar(async (_req, res) => {
    res.json(await sampleStatus());
  }));
  app.post('/api/sample-data/load', requireOwner, blockDemo, ar(async (_req, res) => {
    try {
      const r = await loadSampleData();
      res.status(r.already ? 200 : 201).json({ ok: true, already: r.already, created: r.created, status: await sampleStatus() });
    } catch (e) { fail(res, e); }
  }));
  app.post('/api/sample-data/remove', requireOwner, blockDemo, ar(async (_req, res) => {
    try {
      const r = await removeSampleData();
      res.json({ ok: true, removed: r.removed, kept: r.kept, status: await sampleStatus() });
    } catch (e) { fail(res, e); }
  }));
}
