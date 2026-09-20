import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { get, all, run, initSchema } from './db.js';
import * as whatsapp from './whatsapp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4360;

// Wraps an async route handler so a rejected promise reaches Express's
// error handler instead of crashing the process or hanging the request.
const ar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Public — Meta calls these directly (webhook verification handshake, then
// message delivery), so they can't carry any auth. Anvil's API has no
// auth-gate middleware (unlike Harbor, which registers these two routes
// before `app.use('/api', requireAuth)`), but they're kept at the very top
// of the route table regardless, so this stays the one obvious place to look
// if auth is ever added later.
app.get('/api/integrations/whatsapp/webhook', ar(async (req, res) => {
  const conn = await whatsapp.getConnection();
  const challenge = whatsapp.verifyWebhook(req.query, conn?.verify_token);
  if (challenge) return res.status(200).send(challenge);
  res.sendStatus(403);
}));

app.post('/api/integrations/whatsapp/webhook', ar(async (req, res) => {
  await whatsapp.handleWebhookEvent(req.body);
  res.sendStatus(200);
}));

// -------------------- helpers --------------------
function missingField(body, fields) {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || body[f] === '') return f;
  }
  return null;
}

async function rowExists(table, id) {
  if (id === undefined || id === null || id === '') return false;
  return !!(await get(`SELECT 1 FROM ${table} WHERE id = ?`, id));
}

async function countWhere(table, column, id) {
  return (await get(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`, id)).n;
}

async function checkBlockers(res, blockers, id) {
  for (const [table, col, label] of blockers) {
    const n = await countWhere(table, col, id);
    if (n > 0) {
      res.status(409).json({ error: `Cannot delete: ${n} ${label}${n === 1 ? '' : 's'} still reference this record.` });
      return true;
    }
  }
  return false;
}

// -------------------- users --------------------
async function userRow(id) {
  return get(`SELECT * FROM users WHERE id = ?`, id);
}

app.get('/api/users', ar(async (req, res) => {
  res.json(await all(`SELECT * FROM users ORDER BY name`));
}));

app.post('/api/users', ar(async (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['name', 'email', 'role', 'initials', 'color']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  const info = await run(`
    INSERT INTO users (name, email, role, initials, color)
    VALUES (@name, @email, @role, @initials, @color) RETURNING id
  `, { name: b.name, email: b.email, role: b.role, initials: b.initials, color: b.color });
  res.status(201).json(await userRow(info.rows[0].id));
}));

app.put('/api/users/:id', ar(async (req, res) => {
  const existing = await userRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['name', 'email', 'role', 'initials', 'color']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  await run(`UPDATE users SET name=@name, email=@email, role=@role, initials=@initials, color=@color WHERE id=@id`,
    { id: req.params.id, name: b.name, email: b.email, role: b.role, initials: b.initials, color: b.color });
  res.json(await userRow(req.params.id));
}));

app.delete('/api/users/:id', ar(async (req, res) => {
  const existing = await userRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const blockers = [
    ['customers', 'owner_user_id', 'customer'],
    ['rfqs', 'owner_user_id', 'RFQ'],
    ['quotes', 'owner_user_id', 'quote'],
    ['work_orders', 'owner_user_id', 'work order'],
    ['quality_inspections', 'inspector_user_id', 'quality inspection'],
    ['activities', 'owner_user_id', 'activity'],
  ];
  if (await checkBlockers(res, blockers, req.params.id)) return;
  await run(`DELETE FROM users WHERE id = ?`, req.params.id);
  res.status(204).end();
}));

// -------------------- customers --------------------
const CUSTOMER_SELECT = `
  SELECT c.*, u.name AS owner_name, u.initials AS owner_initials, u.color AS owner_color,
    (SELECT COUNT(*) FROM rfqs r WHERE r.customer_id = c.id) AS rfq_count,
    (SELECT COUNT(*) FROM work_orders w WHERE w.customer_id = c.id) AS work_order_count
  FROM customers c
  JOIN users u ON u.id = c.owner_user_id
`;
async function customerRow(id) {
  return get(`${CUSTOMER_SELECT} WHERE c.id = ?`, id);
}

app.get('/api/customers', ar(async (req, res) => {
  res.json(await all(`${CUSTOMER_SELECT} ORDER BY c.name`));
}));

const CUSTOMER_FIELDS = ['name', 'industry', 'address', 'city', 'state', 'contact_name', 'contact_email', 'contact_phone', 'owner_user_id', 'status', 'notes'];

app.post('/api/customers', ar(async (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['name', 'industry', 'address', 'city', 'state', 'contact_name', 'contact_email', 'contact_phone', 'owner_user_id', 'status']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!(await rowExists('users', b.owner_user_id))) return res.status(400).json({ error: 'owner_user_id does not reference a real user' });
  const info = await run(`
    INSERT INTO customers (name, industry, address, city, state, contact_name, contact_email, contact_phone, owner_user_id, status, notes)
    VALUES (@name, @industry, @address, @city, @state, @contact_name, @contact_email, @contact_phone, @owner_user_id, @status, @notes) RETURNING id
  `, { ...Object.fromEntries(CUSTOMER_FIELDS.map((f) => [f, b[f] ?? null])) });
  res.status(201).json(await customerRow(info.rows[0].id));
}));

app.put('/api/customers/:id', ar(async (req, res) => {
  const existing = await customerRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['name', 'industry', 'address', 'city', 'state', 'contact_name', 'contact_email', 'contact_phone', 'owner_user_id', 'status']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!(await rowExists('users', b.owner_user_id))) return res.status(400).json({ error: 'owner_user_id does not reference a real user' });
  await run(`
    UPDATE customers SET name=@name, industry=@industry, address=@address, city=@city, state=@state,
      contact_name=@contact_name, contact_email=@contact_email, contact_phone=@contact_phone,
      owner_user_id=@owner_user_id, status=@status, notes=@notes
    WHERE id=@id
  `, { id: req.params.id, ...Object.fromEntries(CUSTOMER_FIELDS.map((f) => [f, b[f] ?? null])) });
  res.json(await customerRow(req.params.id));
}));

app.delete('/api/customers/:id', ar(async (req, res) => {
  const existing = await customerRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const blockers = [
    ['rfqs', 'customer_id', 'RFQ'],
    ['quotes', 'customer_id', 'quote'],
    ['work_orders', 'customer_id', 'work order'],
    ['shipments', 'customer_id', 'shipment'],
    ['invoices', 'customer_id', 'invoice'],
  ];
  if (await checkBlockers(res, blockers, req.params.id)) return;
  await run(`DELETE FROM customers WHERE id = ?`, req.params.id);
  res.status(204).end();
}));

// -------------------- rfqs --------------------
const RFQ_SELECT = `
  SELECT rf.*, c.name AS customer_name, u.name AS owner_name, u.initials AS owner_initials, u.color AS owner_color,
    (SELECT COUNT(*) FROM quotes q WHERE q.rfq_id = rf.id) AS quote_count
  FROM rfqs rf
  JOIN customers c ON c.id = rf.customer_id
  JOIN users u ON u.id = rf.owner_user_id
`;
async function rfqRow(id) {
  return get(`${RFQ_SELECT} WHERE rf.id = ?`, id);
}

app.get('/api/rfqs', ar(async (req, res) => {
  res.json(await all(`${RFQ_SELECT} ORDER BY rf.due_date`));
}));

const RFQ_FIELDS = ['customer_id', 'title', 'description', 'target_price', 'due_date', 'status', 'owner_user_id', 'received_date'];

app.post('/api/rfqs', ar(async (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['customer_id', 'title', 'due_date', 'status', 'owner_user_id', 'received_date']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!(await rowExists('customers', b.customer_id))) return res.status(400).json({ error: 'customer_id does not reference a real customer' });
  if (!(await rowExists('users', b.owner_user_id))) return res.status(400).json({ error: 'owner_user_id does not reference a real user' });
  const info = await run(`
    INSERT INTO rfqs (customer_id, title, description, target_price, due_date, status, owner_user_id, received_date)
    VALUES (@customer_id, @title, @description, @target_price, @due_date, @status, @owner_user_id, @received_date) RETURNING id
  `, { ...Object.fromEntries(RFQ_FIELDS.map((f) => [f, b[f] === '' ? null : b[f] ?? null])), target_price: b.target_price ? Number(b.target_price) : null });
  res.status(201).json(await rfqRow(info.rows[0].id));
}));

app.put('/api/rfqs/:id', ar(async (req, res) => {
  const existing = await rfqRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['customer_id', 'title', 'due_date', 'status', 'owner_user_id', 'received_date']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!(await rowExists('customers', b.customer_id))) return res.status(400).json({ error: 'customer_id does not reference a real customer' });
  if (!(await rowExists('users', b.owner_user_id))) return res.status(400).json({ error: 'owner_user_id does not reference a real user' });
  await run(`
    UPDATE rfqs SET customer_id=@customer_id, title=@title, description=@description, target_price=@target_price,
      due_date=@due_date, status=@status, owner_user_id=@owner_user_id, received_date=@received_date
    WHERE id=@id
  `, { id: req.params.id, ...Object.fromEntries(RFQ_FIELDS.map((f) => [f, b[f] === '' ? null : b[f] ?? null])), target_price: b.target_price ? Number(b.target_price) : null });
  res.json(await rfqRow(req.params.id));
}));

app.delete('/api/rfqs/:id', ar(async (req, res) => {
  const existing = await rfqRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  if (await checkBlockers(res, [['quotes', 'rfq_id', 'quote']], req.params.id)) return;
  await run(`DELETE FROM rfqs WHERE id = ?`, req.params.id);
  res.status(204).end();
}));

// -------------------- quotes --------------------
const QUOTE_SELECT = `
  SELECT q.*, c.name AS customer_name, rf.title AS rfq_title, u.name AS owner_name, u.initials AS owner_initials, u.color AS owner_color,
    (SELECT COUNT(*) FROM bill_of_materials b WHERE b.quote_id = q.id) AS bom_count,
    (SELECT COUNT(*) FROM work_orders w WHERE w.quote_id = q.id) AS work_order_count
  FROM quotes q
  JOIN customers c ON c.id = q.customer_id
  LEFT JOIN rfqs rf ON rf.id = q.rfq_id
  JOIN users u ON u.id = q.owner_user_id
`;
async function quoteRow(id) {
  return get(`${QUOTE_SELECT} WHERE q.id = ?`, id);
}

app.get('/api/quotes', ar(async (req, res) => {
  res.json(await all(`${QUOTE_SELECT} ORDER BY q.quote_number DESC`));
}));

app.post('/api/quotes', ar(async (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['customer_id', 'quote_number', 'total_amount', 'status', 'valid_until', 'owner_user_id']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!(await rowExists('customers', b.customer_id))) return res.status(400).json({ error: 'customer_id does not reference a real customer' });
  if (!(await rowExists('users', b.owner_user_id))) return res.status(400).json({ error: 'owner_user_id does not reference a real user' });
  if (b.rfq_id && !(await rowExists('rfqs', b.rfq_id))) return res.status(400).json({ error: 'rfq_id does not reference a real RFQ' });
  const info = await run(`
    INSERT INTO quotes (rfq_id, customer_id, quote_number, total_amount, status, valid_until, owner_user_id)
    VALUES (@rfq_id, @customer_id, @quote_number, @total_amount, @status, @valid_until, @owner_user_id) RETURNING id
  `, {
    rfq_id: b.rfq_id || null, customer_id: b.customer_id, quote_number: b.quote_number,
    total_amount: Number(b.total_amount) || 0, status: b.status, valid_until: b.valid_until, owner_user_id: b.owner_user_id,
  });
  res.status(201).json(await quoteRow(info.rows[0].id));
}));

app.put('/api/quotes/:id', ar(async (req, res) => {
  const existing = await quoteRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['customer_id', 'quote_number', 'total_amount', 'status', 'valid_until', 'owner_user_id']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!(await rowExists('customers', b.customer_id))) return res.status(400).json({ error: 'customer_id does not reference a real customer' });
  if (!(await rowExists('users', b.owner_user_id))) return res.status(400).json({ error: 'owner_user_id does not reference a real user' });
  if (b.rfq_id && !(await rowExists('rfqs', b.rfq_id))) return res.status(400).json({ error: 'rfq_id does not reference a real RFQ' });
  await run(`
    UPDATE quotes SET rfq_id=@rfq_id, customer_id=@customer_id, quote_number=@quote_number, total_amount=@total_amount,
      status=@status, valid_until=@valid_until, owner_user_id=@owner_user_id
    WHERE id=@id
  `, {
    id: req.params.id, rfq_id: b.rfq_id || null, customer_id: b.customer_id, quote_number: b.quote_number,
    total_amount: Number(b.total_amount) || 0, status: b.status, valid_until: b.valid_until, owner_user_id: b.owner_user_id,
  });
  res.json(await quoteRow(req.params.id));
}));

app.delete('/api/quotes/:id', ar(async (req, res) => {
  const existing = await quoteRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const blockers = [
    ['bill_of_materials', 'quote_id', 'BOM line item'],
    ['work_orders', 'quote_id', 'work order'],
  ];
  if (await checkBlockers(res, blockers, req.params.id)) return;
  await run(`DELETE FROM quotes WHERE id = ?`, req.params.id);
  res.status(204).end();
}));

// -------------------- bill of materials --------------------
const BOM_SELECT = `
  SELECT b.*, q.quote_number, c.name AS customer_name
  FROM bill_of_materials b
  JOIN quotes q ON q.id = b.quote_id
  JOIN customers c ON c.id = q.customer_id
`;
async function bomRow(id) {
  return get(`${BOM_SELECT} WHERE b.id = ?`, id);
}

app.get('/api/bill-of-materials', ar(async (req, res) => {
  res.json(await all(`${BOM_SELECT} ORDER BY b.id DESC`));
}));

app.post('/api/bill-of-materials', ar(async (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['quote_id', 'part_name', 'material', 'quantity', 'unit_of_measure', 'unit_cost']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!(await rowExists('quotes', b.quote_id))) return res.status(400).json({ error: 'quote_id does not reference a real quote' });
  const info = await run(`
    INSERT INTO bill_of_materials (quote_id, part_name, material, quantity, unit_of_measure, unit_cost, notes)
    VALUES (@quote_id, @part_name, @material, @quantity, @unit_of_measure, @unit_cost, @notes) RETURNING id
  `, {
    quote_id: b.quote_id, part_name: b.part_name, material: b.material,
    quantity: Number(b.quantity) || 0, unit_of_measure: b.unit_of_measure, unit_cost: Number(b.unit_cost) || 0,
    notes: b.notes || null,
  });
  res.status(201).json(await bomRow(info.rows[0].id));
}));

app.put('/api/bill-of-materials/:id', ar(async (req, res) => {
  const existing = await bomRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['quote_id', 'part_name', 'material', 'quantity', 'unit_of_measure', 'unit_cost']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!(await rowExists('quotes', b.quote_id))) return res.status(400).json({ error: 'quote_id does not reference a real quote' });
  await run(`
    UPDATE bill_of_materials SET quote_id=@quote_id, part_name=@part_name, material=@material, quantity=@quantity,
      unit_of_measure=@unit_of_measure, unit_cost=@unit_cost, notes=@notes
    WHERE id=@id
  `, {
    id: req.params.id, quote_id: b.quote_id, part_name: b.part_name, material: b.material,
    quantity: Number(b.quantity) || 0, unit_of_measure: b.unit_of_measure, unit_cost: Number(b.unit_cost) || 0,
    notes: b.notes || null,
  });
  res.json(await bomRow(req.params.id));
}));

app.delete('/api/bill-of-materials/:id', ar(async (req, res) => {
  const existing = await bomRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  await run(`DELETE FROM bill_of_materials WHERE id = ?`, req.params.id);
  res.status(204).end();
}));

// -------------------- suppliers --------------------
async function supplierRow(id) {
  return get(`SELECT s.*, (SELECT COUNT(*) FROM purchase_orders p WHERE p.supplier_id = s.id) AS po_count FROM suppliers s WHERE s.id = ?`, id);
}

app.get('/api/suppliers', ar(async (req, res) => {
  res.json(await all(`SELECT s.*, (SELECT COUNT(*) FROM purchase_orders p WHERE p.supplier_id = s.id) AS po_count FROM suppliers s ORDER BY s.name`));
}));

const SUPPLIER_FIELDS = ['name', 'specialty', 'contact_name', 'contact_email', 'contact_phone', 'lead_time_days', 'notes'];

app.post('/api/suppliers', ar(async (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['name', 'specialty', 'contact_name', 'contact_email', 'contact_phone', 'lead_time_days']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  const info = await run(`
    INSERT INTO suppliers (name, specialty, contact_name, contact_email, contact_phone, lead_time_days, notes)
    VALUES (@name, @specialty, @contact_name, @contact_email, @contact_phone, @lead_time_days, @notes) RETURNING id
  `, { ...Object.fromEntries(SUPPLIER_FIELDS.map((f) => [f, b[f] ?? null])), lead_time_days: Number(b.lead_time_days) || 0 });
  res.status(201).json(await supplierRow(info.rows[0].id));
}));

app.put('/api/suppliers/:id', ar(async (req, res) => {
  const existing = await supplierRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['name', 'specialty', 'contact_name', 'contact_email', 'contact_phone', 'lead_time_days']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  await run(`
    UPDATE suppliers SET name=@name, specialty=@specialty, contact_name=@contact_name, contact_email=@contact_email,
      contact_phone=@contact_phone, lead_time_days=@lead_time_days, notes=@notes
    WHERE id=@id
  `, { id: req.params.id, ...Object.fromEntries(SUPPLIER_FIELDS.map((f) => [f, b[f] ?? null])), lead_time_days: Number(b.lead_time_days) || 0 });
  res.json(await supplierRow(req.params.id));
}));

app.delete('/api/suppliers/:id', ar(async (req, res) => {
  const existing = await supplierRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  if (await checkBlockers(res, [['purchase_orders', 'supplier_id', 'purchase order']], req.params.id)) return;
  await run(`DELETE FROM suppliers WHERE id = ?`, req.params.id);
  res.status(204).end();
}));

// -------------------- purchase orders --------------------
const PO_SELECT = `
  SELECT p.*, s.name AS supplier_name, s.specialty AS supplier_specialty
  FROM purchase_orders p
  JOIN suppliers s ON s.id = p.supplier_id
`;
async function poRow(id) {
  return get(`${PO_SELECT} WHERE p.id = ?`, id);
}

app.get('/api/purchase-orders', ar(async (req, res) => {
  res.json(await all(`${PO_SELECT} ORDER BY p.order_date DESC`));
}));

app.post('/api/purchase-orders', ar(async (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['supplier_id', 'po_number', 'status', 'total_amount', 'order_date']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!(await rowExists('suppliers', b.supplier_id))) return res.status(400).json({ error: 'supplier_id does not reference a real supplier' });
  const info = await run(`
    INSERT INTO purchase_orders (supplier_id, po_number, status, total_amount, order_date, expected_date, notes)
    VALUES (@supplier_id, @po_number, @status, @total_amount, @order_date, @expected_date, @notes) RETURNING id
  `, {
    supplier_id: b.supplier_id, po_number: b.po_number, status: b.status, total_amount: Number(b.total_amount) || 0,
    order_date: b.order_date, expected_date: b.expected_date || null, notes: b.notes || null,
  });
  res.status(201).json(await poRow(info.rows[0].id));
}));

app.put('/api/purchase-orders/:id', ar(async (req, res) => {
  const existing = await poRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['supplier_id', 'po_number', 'status', 'total_amount', 'order_date']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!(await rowExists('suppliers', b.supplier_id))) return res.status(400).json({ error: 'supplier_id does not reference a real supplier' });
  await run(`
    UPDATE purchase_orders SET supplier_id=@supplier_id, po_number=@po_number, status=@status, total_amount=@total_amount,
      order_date=@order_date, expected_date=@expected_date, notes=@notes
    WHERE id=@id
  `, {
    id: req.params.id, supplier_id: b.supplier_id, po_number: b.po_number, status: b.status, total_amount: Number(b.total_amount) || 0,
    order_date: b.order_date, expected_date: b.expected_date || null, notes: b.notes || null,
  });
  res.json(await poRow(req.params.id));
}));

app.delete('/api/purchase-orders/:id', ar(async (req, res) => {
  const existing = await poRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  await run(`DELETE FROM purchase_orders WHERE id = ?`, req.params.id);
  res.status(204).end();
}));

// -------------------- work orders --------------------
const WORK_ORDER_SELECT = `
  SELECT w.*, c.name AS customer_name, q.quote_number, u.name AS owner_name, u.initials AS owner_initials, u.color AS owner_color,
    (SELECT COUNT(*) FROM quality_inspections qi WHERE qi.work_order_id = w.id) AS inspection_count
  FROM work_orders w
  JOIN customers c ON c.id = w.customer_id
  LEFT JOIN quotes q ON q.id = w.quote_id
  JOIN users u ON u.id = w.owner_user_id
`;
async function workOrderRow(id) {
  return get(`${WORK_ORDER_SELECT} WHERE w.id = ?`, id);
}

app.get('/api/work-orders', ar(async (req, res) => {
  res.json(await all(`${WORK_ORDER_SELECT} ORDER BY w.due_date`));
}));

app.post('/api/work-orders', ar(async (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['customer_id', 'work_order_number', 'status', 'owner_user_id', 'due_date']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!(await rowExists('customers', b.customer_id))) return res.status(400).json({ error: 'customer_id does not reference a real customer' });
  if (!(await rowExists('users', b.owner_user_id))) return res.status(400).json({ error: 'owner_user_id does not reference a real user' });
  if (b.quote_id && !(await rowExists('quotes', b.quote_id))) return res.status(400).json({ error: 'quote_id does not reference a real quote' });
  const info = await run(`
    INSERT INTO work_orders (quote_id, customer_id, work_order_number, status, owner_user_id, start_date, due_date, notes)
    VALUES (@quote_id, @customer_id, @work_order_number, @status, @owner_user_id, @start_date, @due_date, @notes) RETURNING id
  `, {
    quote_id: b.quote_id || null, customer_id: b.customer_id, work_order_number: b.work_order_number, status: b.status,
    owner_user_id: b.owner_user_id, start_date: b.start_date || null, due_date: b.due_date, notes: b.notes || null,
  });
  res.status(201).json(await workOrderRow(info.rows[0].id));
}));

app.put('/api/work-orders/:id', ar(async (req, res) => {
  const existing = await workOrderRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['customer_id', 'work_order_number', 'status', 'owner_user_id', 'due_date']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!(await rowExists('customers', b.customer_id))) return res.status(400).json({ error: 'customer_id does not reference a real customer' });
  if (!(await rowExists('users', b.owner_user_id))) return res.status(400).json({ error: 'owner_user_id does not reference a real user' });
  if (b.quote_id && !(await rowExists('quotes', b.quote_id))) return res.status(400).json({ error: 'quote_id does not reference a real quote' });
  await run(`
    UPDATE work_orders SET quote_id=@quote_id, customer_id=@customer_id, work_order_number=@work_order_number, status=@status,
      owner_user_id=@owner_user_id, start_date=@start_date, due_date=@due_date, notes=@notes
    WHERE id=@id
  `, {
    id: req.params.id, quote_id: b.quote_id || null, customer_id: b.customer_id, work_order_number: b.work_order_number, status: b.status,
    owner_user_id: b.owner_user_id, start_date: b.start_date || null, due_date: b.due_date, notes: b.notes || null,
  });
  res.json(await workOrderRow(req.params.id));
}));

app.delete('/api/work-orders/:id', ar(async (req, res) => {
  const existing = await workOrderRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const blockers = [
    ['quality_inspections', 'work_order_id', 'quality inspection'],
    ['shipments', 'work_order_id', 'shipment'],
    ['invoices', 'work_order_id', 'invoice'],
  ];
  if (await checkBlockers(res, blockers, req.params.id)) return;
  await run(`DELETE FROM work_orders WHERE id = ?`, req.params.id);
  res.status(204).end();
}));

// -------------------- quality inspections --------------------
const QI_SELECT = `
  SELECT qi.*, w.work_order_number, c.name AS customer_name, u.name AS inspector_name, u.initials AS inspector_initials, u.color AS inspector_color
  FROM quality_inspections qi
  JOIN work_orders w ON w.id = qi.work_order_id
  JOIN customers c ON c.id = w.customer_id
  JOIN users u ON u.id = qi.inspector_user_id
`;
async function qiRow(id) {
  return get(`${QI_SELECT} WHERE qi.id = ?`, id);
}

app.get('/api/quality-inspections', ar(async (req, res) => {
  res.json(await all(`${QI_SELECT} ORDER BY qi.inspection_date DESC`));
}));

app.post('/api/quality-inspections', ar(async (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['work_order_id', 'inspector_user_id', 'inspection_date', 'result']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!(await rowExists('work_orders', b.work_order_id))) return res.status(400).json({ error: 'work_order_id does not reference a real work order' });
  if (!(await rowExists('users', b.inspector_user_id))) return res.status(400).json({ error: 'inspector_user_id does not reference a real user' });
  const info = await run(`
    INSERT INTO quality_inspections (work_order_id, inspector_user_id, inspection_date, result, notes)
    VALUES (@work_order_id, @inspector_user_id, @inspection_date, @result, @notes) RETURNING id
  `, { work_order_id: b.work_order_id, inspector_user_id: b.inspector_user_id, inspection_date: b.inspection_date, result: b.result, notes: b.notes || null });
  res.status(201).json(await qiRow(info.rows[0].id));
}));

app.put('/api/quality-inspections/:id', ar(async (req, res) => {
  const existing = await qiRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['work_order_id', 'inspector_user_id', 'inspection_date', 'result']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!(await rowExists('work_orders', b.work_order_id))) return res.status(400).json({ error: 'work_order_id does not reference a real work order' });
  if (!(await rowExists('users', b.inspector_user_id))) return res.status(400).json({ error: 'inspector_user_id does not reference a real user' });
  await run(`
    UPDATE quality_inspections SET work_order_id=@work_order_id, inspector_user_id=@inspector_user_id,
      inspection_date=@inspection_date, result=@result, notes=@notes
    WHERE id=@id
  `, { id: req.params.id, work_order_id: b.work_order_id, inspector_user_id: b.inspector_user_id, inspection_date: b.inspection_date, result: b.result, notes: b.notes || null });
  res.json(await qiRow(req.params.id));
}));

app.delete('/api/quality-inspections/:id', ar(async (req, res) => {
  const existing = await qiRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  await run(`DELETE FROM quality_inspections WHERE id = ?`, req.params.id);
  res.status(204).end();
}));

// -------------------- shipments --------------------
const SHIPMENT_SELECT = `
  SELECT sh.*, w.work_order_number, c.name AS customer_name
  FROM shipments sh
  JOIN work_orders w ON w.id = sh.work_order_id
  JOIN customers c ON c.id = sh.customer_id
`;
async function shipmentRow(id) {
  return get(`${SHIPMENT_SELECT} WHERE sh.id = ?`, id);
}

app.get('/api/shipments', ar(async (req, res) => {
  res.json(await all(`${SHIPMENT_SELECT} ORDER BY sh.ship_date IS NULL, sh.ship_date DESC`));
}));

app.post('/api/shipments', ar(async (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['work_order_id', 'customer_id', 'carrier', 'status']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!(await rowExists('work_orders', b.work_order_id))) return res.status(400).json({ error: 'work_order_id does not reference a real work order' });
  if (!(await rowExists('customers', b.customer_id))) return res.status(400).json({ error: 'customer_id does not reference a real customer' });
  const info = await run(`
    INSERT INTO shipments (work_order_id, customer_id, ship_date, carrier, tracking_number, status)
    VALUES (@work_order_id, @customer_id, @ship_date, @carrier, @tracking_number, @status) RETURNING id
  `, {
    work_order_id: b.work_order_id, customer_id: b.customer_id, ship_date: b.ship_date || null,
    carrier: b.carrier, tracking_number: b.tracking_number || null, status: b.status,
  });
  res.status(201).json(await shipmentRow(info.rows[0].id));
}));

app.put('/api/shipments/:id', ar(async (req, res) => {
  const existing = await shipmentRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['work_order_id', 'customer_id', 'carrier', 'status']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!(await rowExists('work_orders', b.work_order_id))) return res.status(400).json({ error: 'work_order_id does not reference a real work order' });
  if (!(await rowExists('customers', b.customer_id))) return res.status(400).json({ error: 'customer_id does not reference a real customer' });
  await run(`
    UPDATE shipments SET work_order_id=@work_order_id, customer_id=@customer_id, ship_date=@ship_date,
      carrier=@carrier, tracking_number=@tracking_number, status=@status
    WHERE id=@id
  `, {
    id: req.params.id, work_order_id: b.work_order_id, customer_id: b.customer_id, ship_date: b.ship_date || null,
    carrier: b.carrier, tracking_number: b.tracking_number || null, status: b.status,
  });
  res.json(await shipmentRow(req.params.id));
}));

app.delete('/api/shipments/:id', ar(async (req, res) => {
  const existing = await shipmentRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  await run(`DELETE FROM shipments WHERE id = ?`, req.params.id);
  res.status(204).end();
}));

// -------------------- invoices --------------------
const INVOICE_SELECT = `
  SELECT i.*, w.work_order_number, c.name AS customer_name
  FROM invoices i
  JOIN work_orders w ON w.id = i.work_order_id
  JOIN customers c ON c.id = i.customer_id
`;
async function invoiceRow(id) {
  return get(`${INVOICE_SELECT} WHERE i.id = ?`, id);
}

app.get('/api/invoices', ar(async (req, res) => {
  res.json(await all(`${INVOICE_SELECT} ORDER BY i.due_date`));
}));

app.post('/api/invoices', ar(async (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['work_order_id', 'customer_id', 'invoice_number', 'amount', 'status', 'issue_date', 'due_date']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!(await rowExists('work_orders', b.work_order_id))) return res.status(400).json({ error: 'work_order_id does not reference a real work order' });
  if (!(await rowExists('customers', b.customer_id))) return res.status(400).json({ error: 'customer_id does not reference a real customer' });
  const info = await run(`
    INSERT INTO invoices (work_order_id, customer_id, invoice_number, amount, status, issue_date, due_date)
    VALUES (@work_order_id, @customer_id, @invoice_number, @amount, @status, @issue_date, @due_date) RETURNING id
  `, {
    work_order_id: b.work_order_id, customer_id: b.customer_id, invoice_number: b.invoice_number,
    amount: Number(b.amount) || 0, status: b.status, issue_date: b.issue_date, due_date: b.due_date,
  });
  res.status(201).json(await invoiceRow(info.rows[0].id));
}));

app.put('/api/invoices/:id', ar(async (req, res) => {
  const existing = await invoiceRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['work_order_id', 'customer_id', 'invoice_number', 'amount', 'status', 'issue_date', 'due_date']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!(await rowExists('work_orders', b.work_order_id))) return res.status(400).json({ error: 'work_order_id does not reference a real work order' });
  if (!(await rowExists('customers', b.customer_id))) return res.status(400).json({ error: 'customer_id does not reference a real customer' });
  await run(`
    UPDATE invoices SET work_order_id=@work_order_id, customer_id=@customer_id, invoice_number=@invoice_number,
      amount=@amount, status=@status, issue_date=@issue_date, due_date=@due_date
    WHERE id=@id
  `, {
    id: req.params.id, work_order_id: b.work_order_id, customer_id: b.customer_id, invoice_number: b.invoice_number,
    amount: Number(b.amount) || 0, status: b.status, issue_date: b.issue_date, due_date: b.due_date,
  });
  res.json(await invoiceRow(req.params.id));
}));

app.delete('/api/invoices/:id', ar(async (req, res) => {
  const existing = await invoiceRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  await run(`DELETE FROM invoices WHERE id = ?`, req.params.id);
  res.status(204).end();
}));

// -------------------- activities --------------------
app.get('/api/activities', ar(async (req, res) => {
  const rows = await all(`
    SELECT a.*, u.name AS owner_name, u.initials AS owner_initials, u.color AS owner_color
    FROM activities a
    JOIN users u ON u.id = a.owner_user_id
    ORDER BY a.occurred_at DESC
  `);
  res.json(rows);
}));

// -------------------- automations --------------------
app.get('/api/automations', ar(async (req, res) => {
  res.json(await all(`SELECT * FROM automations ORDER BY name`));
}));

app.post('/api/automations', ar(async (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['name', 'trigger_desc', 'action_desc']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  const info = await run(`
    INSERT INTO automations (name, trigger_desc, action_desc, active, runs_30d)
    VALUES (@name, @trigger_desc, @action_desc, @active, 0) RETURNING id
  `, { name: b.name, trigger_desc: b.trigger_desc, action_desc: b.action_desc, active: b.active === false ? 0 : 1 });
  res.status(201).json(await get(`SELECT * FROM automations WHERE id = ?`, info.rows[0].id));
}));

app.patch('/api/automations/:id/active', ar(async (req, res) => {
  const existing = await get(`SELECT * FROM automations WHERE id = ?`, req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const { active } = req.body || {};
  await run(`UPDATE automations SET active = ? WHERE id = ?`, active ? 1 : 0, req.params.id);
  res.json(await get(`SELECT * FROM automations WHERE id = ?`, req.params.id));
}));

app.delete('/api/automations/:id', ar(async (req, res) => {
  const existing = await get(`SELECT * FROM automations WHERE id = ?`, req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  await run(`DELETE FROM automations WHERE id = ?`, req.params.id);
  res.status(204).end();
}));

// -------------------- whatsapp business integration --------------------
app.get('/api/integrations/whatsapp/status', ar(async (req, res) => {
  const conn = await whatsapp.getConnection();
  res.json({ connected: !!conn, displayPhone: conn?.display_phone || null });
}));

app.post('/api/integrations/whatsapp/connect', ar(async (req, res) => {
  const { phoneNumberId, accessToken, businessAccountId, verifyToken } = req.body || {};
  if (!phoneNumberId || !accessToken) {
    return res.status(400).json({ error: 'Phone Number ID and Access Token are required.' });
  }
  try {
    const displayPhone = await whatsapp.saveConnection({ phoneNumberId, accessToken, businessAccountId, verifyToken });
    res.json({ connected: true, displayPhone });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}));

app.post('/api/integrations/whatsapp/disconnect', ar(async (req, res) => {
  await whatsapp.disconnect();
  res.status(204).end();
}));

app.get('/api/integrations/whatsapp/conversations', ar(async (req, res) => {
  res.json(await whatsapp.listConversations());
}));

app.get('/api/integrations/whatsapp/conversations/:phone', ar(async (req, res) => {
  res.json(await whatsapp.getConversation(req.params.phone));
}));

app.post('/api/integrations/whatsapp/send', ar(async (req, res) => {
  const { to, text } = req.body || {};
  if (!to || !text) return res.status(400).json({ error: 'to and text are required' });
  try {
    await whatsapp.sendMessage(to, text);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}));

// -------------------- dashboard --------------------
app.get('/api/dashboard', ar(async (req, res) => {
  const openRfqs = (await get(`SELECT COUNT(*) AS n FROM rfqs WHERE status = 'New'`)).n;
  const quotesAwaiting = (await get(`SELECT COUNT(*) AS n FROM quotes WHERE status = 'Sent'`)).n;
  const workOrdersInProduction = (await get(`
    SELECT COUNT(*) AS n FROM work_orders WHERE status IN ('Queued', 'In Fabrication', 'In Welding', 'Quality Inspection')
  `)).n;
  const posAwaitingDelivery = (await get(`SELECT COUNT(*) AS n FROM purchase_orders WHERE status IN ('Sent', 'Confirmed')`)).n;
  const revenueThisMonth = (await get(`
    SELECT COALESCE(SUM(amount), 0) AS v FROM invoices WHERE issue_date >= '2026-09-01'
  `)).v;

  const workOrdersDueSoon = await all(`
    SELECT w.id, w.work_order_number, w.status, w.due_date, c.name AS customer_name, u.name AS owner_name, u.initials AS owner_initials, u.color AS owner_color
    FROM work_orders w JOIN customers c ON c.id = w.customer_id JOIN users u ON u.id = w.owner_user_id
    WHERE w.status NOT IN ('Completed')
    ORDER BY w.due_date LIMIT 6
  `);

  const recentActivity = await all(`
    SELECT a.id, a.type, a.subject, a.occurred_at, a.notes, u.name AS owner_name, u.initials AS owner_initials, u.color AS owner_color
    FROM activities a JOIN users u ON u.id = a.owner_user_id
    ORDER BY a.occurred_at DESC LIMIT 8
  `);

  const workOrdersByStatus = await all(`
    SELECT status, COUNT(*) AS count FROM work_orders GROUP BY status
  `);

  const posAwaiting = await all(`
    SELECT p.id, p.po_number, p.status, p.expected_date, p.total_amount, s.name AS supplier_name
    FROM purchase_orders p JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.status IN ('Sent', 'Confirmed')
    ORDER BY p.expected_date LIMIT 6
  `);

  res.json({
    kpis: { openRfqs, quotesAwaiting, workOrdersInProduction, posAwaitingDelivery, revenueThisMonth },
    workOrdersByStatus,
    workOrdersDueSoon,
    recentActivity,
    posAwaiting,
  });
}));

// -------------------- reports --------------------
app.get('/api/reports', ar(async (req, res) => {
  const totalRfqs = (await get(`SELECT COUNT(*) AS n FROM rfqs`)).n;
  const wonRfqs = (await get(`SELECT COUNT(*) AS n FROM rfqs WHERE status = 'Won'`)).n;
  const lostRfqs = (await get(`SELECT COUNT(*) AS n FROM rfqs WHERE status = 'Lost'`)).n;
  const decided = wonRfqs + lostRfqs;
  const winRate = decided > 0 ? Math.round((wonRfqs / decided) * 100) : 0;

  const shipmentsTotal = (await get(`SELECT COUNT(*) AS n FROM shipments WHERE status = 'Delivered'`)).n;
  const workOrdersCompleted = (await get(`SELECT COUNT(*) AS n FROM work_orders WHERE status = 'Completed'`)).n;
  const workOrdersOnHold = (await get(`SELECT COUNT(*) AS n FROM work_orders WHERE status = 'On Hold'`)).n;
  const onTimeDeliveryRate = shipmentsTotal > 0
    ? Math.round(((await get(`SELECT COUNT(*) AS n FROM shipments s JOIN work_orders w ON w.id = s.work_order_id WHERE s.status = 'Delivered' AND s.ship_date <= w.due_date`)).n / shipmentsTotal) * 100)
    : 100;

  const revenueByMonth = await all(`
    SELECT substr(issue_date, 1, 7) AS month, COALESCE(SUM(amount), 0) AS revenue, COUNT(*) AS invoice_count
    FROM invoices GROUP BY month ORDER BY month
  `);

  const inspectionResults = await all(`
    SELECT result, COUNT(*) AS count FROM quality_inspections GROUP BY result
  `);

  const revenueByCustomer = await all(`
    SELECT c.name AS customer_name, c.industry, COALESCE(SUM(i.amount), 0) AS revenue, COUNT(i.id) AS invoice_count
    FROM customers c LEFT JOIN invoices i ON i.customer_id = c.id
    GROUP BY c.id ORDER BY revenue DESC
  `);

  const poStatusBreakdown = await all(`
    SELECT status, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS amount FROM purchase_orders GROUP BY status
  `);

  const quoteCount = (await get(`SELECT COUNT(*) AS n FROM quotes`)).n;
  const acceptedQuotes = (await get(`SELECT COUNT(*) AS n FROM quotes WHERE status = 'Accepted'`)).n;
  const quoteAcceptRate = quoteCount > 0 ? Math.round((acceptedQuotes / quoteCount) * 100) : 0;

  res.json({
    winRate, wonRfqs, lostRfqs, totalRfqs,
    onTimeDeliveryRate, workOrdersCompleted, workOrdersOnHold,
    revenueByMonth, inspectionResults, revenueByCustomer, poStatusBreakdown,
    quoteCount, acceptedQuotes, quoteAcceptRate,
  });
}));

// Serve the built React app for every non-API route. Placed after all
// /api/* routes above so it only ever catches page loads, never API calls.
app.use(express.static(CLIENT_DIST));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

initSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Anvil API listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database schema:', err);
    process.exit(1);
  });
