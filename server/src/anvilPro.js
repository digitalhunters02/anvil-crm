// Recursos de Anvil que vencem a concorrência (por plano):
//   Professional: estoque com mínimo, lote e código de barras (entrada, saída para a ordem de serviço, rastreio do lote)
//   Complete: comprar o que falta (cria pedido de compra), custeio por ordem de serviço (material real + mão de obra), agenda de produção
import { get, all, run } from './db.js';

const ar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const todayISO = () => new Date().toISOString().slice(0, 10);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (n) => Math.round(n * 100) / 100;
const round3 = (n) => Math.round(n * 1000) / 1000;

const ITEM_SELECT = `SELECT i.*, COALESCE((SELECT SUM(m.qty) FROM stock_moves m WHERE m.item_id = i.id), 0) AS on_hand FROM inventory_items i`;
const shapeItem = (i) => {
  const on_hand = round3(i.on_hand);
  return { ...i, on_hand, value: round2(on_hand * i.unit_cost), low: i.min_stock > 0 && on_hand <= i.min_stock };
};
const itemById = async (id) => { const r = await get(`${ITEM_SELECT} WHERE i.id = ?`, [id]); return r ? shapeItem(r) : null; };
const lotBalances = async (itemId) => (await all(`SELECT lot, SUM(qty) AS qty FROM stock_moves WHERE item_id = ? AND lot IS NOT NULL GROUP BY lot HAVING ABS(SUM(qty)) > 0.0001 ORDER BY lot`, [itemId])).map((l) => ({ lot: l.lot, qty: round3(l.qty) }));

function parseItem(b, { partial = false } = {}) {
  const sku = clean(b.sku, 60), name = clean(b.name, 120);
  if (!sku || !name) return { error: 'SKU and name are required.' };
  const tracking = b.tracking === 'lot' ? 'lot' : 'none';
  const min_stock = Number(b.min_stock ?? 0), unit_cost = Number(b.unit_cost ?? 0);
  if (!(min_stock >= 0) || !(unit_cost >= 0)) return { error: 'Minimum stock and unit cost must be numbers (0 or more).' };
  return { sku, name, material: clean(b.material, 80), uom: clean(b.uom, 12) || 'ea', min_stock, unit_cost, location: clean(b.location, 60), barcode: clean(b.barcode, 80) || null, tracking };
}

// Código/SKU repetido vira mensagem clara em vez de erro do banco.
const dupMessage = (e) => (e && e.code === '23505' ? (/barcode/.test(e.constraint || '') ? 'This barcode is already used by another item.' : 'This SKU is already in inventory.') : null);

export function mountAnvilPro(app) {
  // ---------------------------------------------------------------- estoque
  app.get('/api/inventory', ar(async (_req, res) => {
    res.json((await all(`${ITEM_SELECT} ORDER BY lower(i.sku)`)).map(shapeItem));
  }));
  app.get('/api/inventory/lookup', ar(async (req, res) => {
    const code = clean(req.query.code, 80).toLowerCase();
    if (!code) return res.status(400).json({ error: 'code is required' });
    const r = await get(`${ITEM_SELECT} WHERE lower(i.sku) = ? OR lower(i.barcode) = ? LIMIT 1`, [code, code]);
    if (!r) return res.status(404).json({ error: 'No item with that code.' });
    const item = shapeItem(r);
    res.json({ ...item, lots: item.tracking === 'lot' ? await lotBalances(item.id) : [] });
  }));
  // Rastreio de lote (recall): por onde o lote passou, em qual ordem de serviço foi usado.
  app.get('/api/inventory/trace', ar(async (req, res) => {
    const lot = clean(req.query.lot, 80);
    if (!lot) return res.status(400).json({ error: 'lot is required' });
    const moves = await all(`SELECT m.id, m.qty, m.reason, m.lot, m.note, m.created_at, i.sku, i.name, w.work_order_number, c.name AS customer_name
      FROM stock_moves m JOIN inventory_items i ON i.id = m.item_id LEFT JOIN work_orders w ON w.id = m.work_order_id LEFT JOIN customers c ON c.id = w.customer_id
      WHERE lower(m.lot) = lower(?) ORDER BY m.id`, [lot]);
    res.json({ lot, moves, received: round3(moves.filter((m) => m.qty > 0).reduce((a, m) => a + m.qty, 0)), used: round3(-moves.filter((m) => m.qty < 0).reduce((a, m) => a + m.qty, 0)) });
  }));
  app.post('/api/inventory', ar(async (req, res) => {
    const p = parseItem(req.body || {}); if (p.error) return res.status(400).json({ error: p.error });
    const opening = Number(req.body?.opening_qty || 0);
    if (!(opening >= 0)) return res.status(400).json({ error: 'Opening quantity must be 0 or more.' });
    let id;
    try {
      id = (await run(`INSERT INTO inventory_items (sku, name, material, uom, min_stock, unit_cost, location, barcode, tracking, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [p.sku, p.name, p.material, p.uom, p.min_stock, p.unit_cost, p.location, p.barcode, p.tracking, todayISO()])).rows[0].id;
    } catch (e) { const m = dupMessage(e); if (m) return res.status(409).json({ error: m }); throw e; }
    if (opening > 0) await run(`INSERT INTO stock_moves (item_id, qty, reason, lot, unit_cost, note) VALUES (?, ?, 'receive', ?, ?, 'Opening balance')`, [id, opening, p.tracking === 'lot' ? (clean(req.body?.opening_lot, 60).toUpperCase() || 'OPENING') : null, p.unit_cost]);
    res.status(201).json(await itemById(id));
  }));
  app.put('/api/inventory/:id', ar(async (req, res) => {
    const id = Number(req.params.id) || 0;
    if (!(await itemById(id))) return res.status(404).json({ error: 'not found' });
    const p = parseItem(req.body || {}); if (p.error) return res.status(400).json({ error: p.error });
    try { await run(`UPDATE inventory_items SET sku = ?, name = ?, material = ?, uom = ?, min_stock = ?, unit_cost = ?, location = ?, barcode = ?, tracking = ? WHERE id = ?`,
      [p.sku, p.name, p.material, p.uom, p.min_stock, p.unit_cost, p.location, p.barcode, p.tracking, id]); }
    catch (e) { const m = dupMessage(e); if (m) return res.status(409).json({ error: m }); throw e; }
    res.json(await itemById(id));
  }));
  app.delete('/api/inventory/:id', ar(async (req, res) => {
    const id = Number(req.params.id) || 0;
    if (!(await itemById(id))) return res.status(404).json({ error: 'not found' });
    if ((await get(`SELECT COUNT(*)::int AS n FROM stock_moves WHERE item_id = ?`, [id])).n > 0) return res.status(409).json({ error: 'This item has stock history and cannot be deleted. Set its minimum to 0 instead.' });
    await run(`DELETE FROM inventory_items WHERE id = ?`, [id]);
    res.status(204).end();
  }));
  app.get('/api/inventory/:id/moves', ar(async (req, res) => {
    const id = Number(req.params.id) || 0;
    const item = await itemById(id); if (!item) return res.status(404).json({ error: 'not found' });
    const moves = await all(`SELECT m.id, m.qty, m.reason, m.lot, m.note, m.unit_cost, m.created_at, w.work_order_number FROM stock_moves m LEFT JOIN work_orders w ON w.id = m.work_order_id WHERE m.item_id = ? ORDER BY m.id DESC LIMIT 200`, [id]);
    res.json({ item, moves, lots: item.tracking === 'lot' ? await lotBalances(id) : [] });
  }));
  // Entrada (receive), saída para ordem de serviço (issue) e ajuste de contagem (adjust, com sinal).
  app.post('/api/inventory/:id/move', ar(async (req, res) => {
    const id = Number(req.params.id) || 0;
    const item = await itemById(id); if (!item) return res.status(404).json({ error: 'not found' });
    const type = req.body?.type; const q = Number(req.body?.qty);
    if (!['receive', 'issue', 'adjust'].includes(type)) return res.status(400).json({ error: 'type must be receive, issue or adjust' });
    if (!Number.isFinite(q) || q === 0 || (type !== 'adjust' && q < 0)) return res.status(400).json({ error: type === 'adjust' ? 'Enter a quantity other than 0 (negative removes stock).' : 'Enter a quantity greater than 0.' });
    const lot = clean(req.body?.lot, 60).toUpperCase() || null; const note = clean(req.body?.note, 300) || null;
    if (type === 'adjust' && !note) return res.status(400).json({ error: 'Please write a reason for the adjustment.' });
    if (item.tracking === 'lot' && !lot) return res.status(400).json({ error: 'This item is tracked by lot — enter the lot code.' });
    let woId = null;
    if (req.body?.work_order_id) {
      woId = Number(req.body.work_order_id);
      if (!(await get(`SELECT 1 FROM work_orders WHERE id = ?`, [woId]))) return res.status(400).json({ error: 'work_order_id does not reference a real work order' });
    }
    if (type === 'issue' && !woId) return res.status(400).json({ error: 'Choose the work order that receives this material.' });
    const delta = type === 'issue' ? -Math.abs(q) : type === 'receive' ? Math.abs(q) : q;
    if (delta < 0) {
      if (item.on_hand + delta < -0.0001) return res.status(409).json({ error: `Only ${item.on_hand} ${item.uom} on hand.`, code: 'insufficient_stock' });
      if (item.tracking === 'lot') {
        const bal = (await lotBalances(id)).find((l) => l.lot.toLowerCase() === lot.toLowerCase());
        if ((bal?.qty || 0) + delta < -0.0001) return res.status(409).json({ error: `Lot ${lot} has only ${bal?.qty || 0} ${item.uom}.`, code: 'insufficient_lot' });
      }
    }
    await run(`INSERT INTO stock_moves (item_id, qty, reason, lot, work_order_id, unit_cost, note) VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, delta, type, lot, woId, item.unit_cost, note]);
    res.status(201).json(await itemById(id));
  }));

  // ---------------------------------------------------------------- comprar o que falta
  const OPEN_WO = `w.status <> 'Completed'`;
  app.get('/api/mrp/shortages', ar(async (_req, res) => {
    const items = (await all(`${ITEM_SELECT}`)).map(shapeItem);
    const byKey = new Map();
    for (const it of items) { byKey.set(it.sku.toLowerCase(), it); byKey.set(it.name.toLowerCase(), it); }
    const lines = await all(`SELECT b.part_name, b.material, b.quantity, w.id AS wo_id, w.work_order_number
      FROM work_orders w JOIN bill_of_materials b ON b.quote_id = w.quote_id WHERE ${OPEN_WO}`);
    const need = new Map(); const unmatched = new Map();
    for (const l of lines) {
      const it = byKey.get(String(l.part_name).trim().toLowerCase()) || byKey.get(String(l.material).trim().toLowerCase());
      if (!it) { const k = `${l.part_name}|${l.material}`; const u = unmatched.get(k) || { part_name: l.part_name, material: l.material, quantity: 0, work_orders: new Set() }; u.quantity += l.quantity; u.work_orders.add(l.work_order_number); unmatched.set(k, u); continue; }
      const n = need.get(it.id) || { required: 0, work_orders: new Set() }; n.required += l.quantity; n.work_orders.add(l.work_order_number); need.set(it.id, n);
    }
    const rows = [];
    for (const it of items) {
      const required = need.get(it.id)?.required || 0;
      const target = required + it.min_stock;
      const suggested = Math.max(0, round3(target - it.on_hand));
      if (suggested <= 0) continue;
      rows.push({ item_id: it.id, sku: it.sku, name: it.name, uom: it.uom, on_hand: it.on_hand, min_stock: it.min_stock, required: round3(required), suggested, unit_cost: it.unit_cost, est_cost: round2(suggested * it.unit_cost),
        reason: required > it.on_hand ? 'work_orders' : 'below_minimum', work_orders: [...(need.get(it.id)?.work_orders || [])] });
    }
    res.json({ rows, total: round2(rows.reduce((a, r) => a + r.est_cost, 0)),
      unmatched: [...unmatched.values()].map((u) => ({ ...u, work_orders: [...u.work_orders], quantity: round3(u.quantity) })) });
  }));
  // Cria um pedido de compra (rascunho) com o que o usuário marcou.
  app.post('/api/mrp/purchase-orders', ar(async (req, res) => {
    const supplier_id = Number(req.body?.supplier_id);
    if (!(await get(`SELECT 1 FROM suppliers WHERE id = ?`, [supplier_id]))) return res.status(400).json({ error: 'Choose a supplier.' });
    const list = Array.isArray(req.body?.items) ? req.body.items.slice(0, 100) : [];
    if (list.length === 0) return res.status(400).json({ error: 'Select at least one item.' });
    let total = 0; const notes = [];
    for (const x of list) {
      const qty = Number(x.qty); const it = await itemById(Number(x.item_id));
      if (!it) return res.status(400).json({ error: 'One of the items no longer exists.' });
      if (!(qty > 0)) return res.status(400).json({ error: `Enter a quantity for ${it.sku}.` });
      total += qty * it.unit_cost; notes.push(`${it.sku} ${it.name} x ${qty} ${it.uom}`);
    }
    const n = (await get(`SELECT COUNT(*)::int AS n FROM purchase_orders WHERE po_number LIKE ?`, [`PO-MRP-${todayISO().replace(/-/g, '')}-%`])).n + 1;
    const po_number = `PO-MRP-${todayISO().replace(/-/g, '')}-${n}`;
    const expected = ISO.test(req.body?.expected_date || '') ? req.body.expected_date : null;
    const id = (await run(`INSERT INTO purchase_orders (supplier_id, po_number, status, total_amount, order_date, expected_date, notes) VALUES (?, ?, 'Draft', ?, ?, ?, ?) RETURNING id`,
      [supplier_id, po_number, round2(total), todayISO(), expected, `Created from shortages: ${notes.join('; ')}`.slice(0, 2000)])).rows[0].id;
    res.status(201).json({ id, po_number, total_amount: round2(total) });
  }));

  // ---------------------------------------------------------------- custeio por ordem de serviço
  app.get('/api/costing', ar(async (_req, res) => {
    const wos = await all(`SELECT w.id, w.work_order_number, w.status, w.due_date, w.quote_id, c.name AS customer_name, q.total_amount AS revenue,
        COALESCE((SELECT SUM(b.quantity * b.unit_cost) FROM bill_of_materials b WHERE b.quote_id = w.quote_id), 0) AS materials_estimated,
        COALESCE((SELECT SUM(-m.qty * m.unit_cost) FROM stock_moves m WHERE m.work_order_id = w.id AND m.reason = 'issue'), 0) AS materials_actual,
        COALESCE((SELECT SUM(l.hours * l.rate) FROM work_order_labor l WHERE l.work_order_id = w.id), 0) AS labor,
        COALESCE((SELECT SUM(l.hours) FROM work_order_labor l WHERE l.work_order_id = w.id), 0) AS labor_hours,
        (SELECT COUNT(*)::int FROM stock_moves m WHERE m.work_order_id = w.id AND m.reason = 'issue') AS issue_count
      FROM work_orders w JOIN customers c ON c.id = w.customer_id LEFT JOIN quotes q ON q.id = w.quote_id ORDER BY w.due_date DESC`);
    const rows = wos.map((w) => {
      const materials = w.issue_count > 0 ? w.materials_actual : w.materials_estimated;
      const cost = materials + w.labor; const revenue = w.revenue == null ? null : w.revenue;
      const margin = revenue == null ? null : revenue - cost;
      return { id: w.id, work_order_number: w.work_order_number, status: w.status, due_date: w.due_date, customer_name: w.customer_name, revenue,
        materials_estimated: round2(w.materials_estimated), materials_actual: round2(w.materials_actual), materials_basis: w.issue_count > 0 ? 'actual' : 'estimated',
        labor: round2(w.labor), labor_hours: round2(w.labor_hours), cost: round2(cost),
        margin: margin == null ? null : round2(margin), margin_pct: margin == null || !(revenue > 0) ? null : Math.round((margin / revenue) * 1000) / 10 };
    });
    const priced = rows.filter((r) => r.revenue != null);
    const sum = (list, k) => round2(list.reduce((a, r) => a + (r[k] || 0), 0));
    const totals = { revenue: sum(priced, 'revenue'), cost: sum(priced, 'cost'), margin: sum(priced, 'margin') };
    totals.margin_pct = totals.revenue > 0 ? Math.round((totals.margin / totals.revenue) * 1000) / 10 : 0;
    res.json({ rows, totals });
  }));
  app.get('/api/costing/labor', ar(async (req, res) => {
    const id = Number(req.query.work_order_id) || 0;
    res.json(await all(`SELECT * FROM work_order_labor WHERE work_order_id = ? ORDER BY work_date DESC, id DESC`, [id]));
  }));
  app.post('/api/costing/labor', ar(async (req, res) => {
    const b = req.body || {}; const wo = Number(b.work_order_id); const hours = Number(b.hours); const rate = Number(b.rate);
    if (!(await get(`SELECT 1 FROM work_orders WHERE id = ?`, [wo]))) return res.status(400).json({ error: 'work_order_id does not reference a real work order' });
    if (!(hours > 0 && hours <= 1000) || !(rate >= 0 && rate <= 10000)) return res.status(400).json({ error: 'Enter hours (greater than 0) and an hourly rate.' });
    const date = ISO.test(b.work_date || '') ? b.work_date : todayISO();
    const id = (await run(`INSERT INTO work_order_labor (work_order_id, work_date, hours, rate, note) VALUES (?, ?, ?, ?, ?) RETURNING id`, [wo, date, hours, rate, clean(b.note, 200) || null])).rows[0].id;
    res.status(201).json(await get(`SELECT * FROM work_order_labor WHERE id = ?`, [id]));
  }));
  app.delete('/api/costing/labor/:id', ar(async (req, res) => {
    const r = await run(`DELETE FROM work_order_labor WHERE id = ?`, [Number(req.params.id) || 0]);
    if (!r.rowCount) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  }));

  // ---------------------------------------------------------------- agenda de produção
  app.get('/api/calendar', ar(async (req, res) => {
    const from = ISO.test(req.query.from || '') ? req.query.from : null; const to = ISO.test(req.query.to || '') ? req.query.to : null;
    const rows = await all(`SELECT w.id, w.work_order_number, w.status, w.start_date, w.due_date, c.name AS customer_name, u.name AS owner_name
      FROM work_orders w JOIN customers c ON c.id = w.customer_id LEFT JOIN users u ON u.id = w.owner_user_id
      WHERE ${OPEN_WO} AND (?::text IS NULL OR w.due_date >= ?) AND (?::text IS NULL OR COALESCE(w.start_date, w.due_date) <= ?) ORDER BY w.due_date, w.id`, [from, from, to, to]);
    const today = todayISO();
    res.json({ today, items: rows.map((r) => ({ ...r, overdue: r.due_date < today })) });
  }));
}
