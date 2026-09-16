import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4360;

// -------------------- helpers --------------------
function missingField(body, fields) {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || body[f] === '') return f;
  }
  return null;
}

function rowExists(table, id) {
  if (id === undefined || id === null || id === '') return false;
  return !!db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id);
}

function countWhere(table, column, id) {
  return db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`).get(id).n;
}

function checkBlockers(res, blockers, id) {
  for (const [table, col, label] of blockers) {
    const n = countWhere(table, col, id);
    if (n > 0) {
      res.status(409).json({ error: `Cannot delete: ${n} ${label}${n === 1 ? '' : 's'} still reference this record.` });
      return true;
    }
  }
  return false;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// -------------------- users --------------------
function userRow(id) {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
}

app.get('/api/users', (req, res) => {
  res.json(db.prepare(`SELECT * FROM users ORDER BY name`).all());
});

app.post('/api/users', (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['name', 'email', 'role', 'initials', 'color']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  const info = db.prepare(`
    INSERT INTO users (name, email, role, initials, color)
    VALUES (@name, @email, @role, @initials, @color)
  `).run({ name: b.name, email: b.email, role: b.role, initials: b.initials, color: b.color });
  res.status(201).json(userRow(info.lastInsertRowid));
});

app.put('/api/users/:id', (req, res) => {
  const existing = userRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['name', 'email', 'role', 'initials', 'color']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  db.prepare(`UPDATE users SET name=@name, email=@email, role=@role, initials=@initials, color=@color WHERE id=@id`)
    .run({ id: req.params.id, name: b.name, email: b.email, role: b.role, initials: b.initials, color: b.color });
  res.json(userRow(req.params.id));
});

app.delete('/api/users/:id', (req, res) => {
  const existing = userRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const blockers = [
    ['customers', 'owner_user_id', 'customer'],
    ['rfqs', 'owner_user_id', 'RFQ'],
    ['quotes', 'owner_user_id', 'quote'],
    ['work_orders', 'owner_user_id', 'work order'],
    ['quality_inspections', 'inspector_user_id', 'quality inspection'],
    ['activities', 'owner_user_id', 'activity'],
  ];
  if (checkBlockers(res, blockers, req.params.id)) return;
  db.prepare(`DELETE FROM users WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});

// -------------------- customers --------------------
const CUSTOMER_SELECT = `
  SELECT c.*, u.name AS owner_name, u.initials AS owner_initials, u.color AS owner_color,
    (SELECT COUNT(*) FROM rfqs r WHERE r.customer_id = c.id) AS rfq_count,
    (SELECT COUNT(*) FROM work_orders w WHERE w.customer_id = c.id) AS work_order_count
  FROM customers c
  JOIN users u ON u.id = c.owner_user_id
`;
function customerRow(id) {
  return db.prepare(`${CUSTOMER_SELECT} WHERE c.id = ?`).get(id);
}

app.get('/api/customers', (req, res) => {
  res.json(db.prepare(`${CUSTOMER_SELECT} ORDER BY c.name`).all());
});

const CUSTOMER_FIELDS = ['name', 'industry', 'address', 'city', 'state', 'contact_name', 'contact_email', 'contact_phone', 'owner_user_id', 'status', 'notes'];

app.post('/api/customers', (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['name', 'industry', 'address', 'city', 'state', 'contact_name', 'contact_email', 'contact_phone', 'owner_user_id', 'status']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!rowExists('users', b.owner_user_id)) return res.status(400).json({ error: 'owner_user_id does not reference a real user' });
  const info = db.prepare(`
    INSERT INTO customers (name, industry, address, city, state, contact_name, contact_email, contact_phone, owner_user_id, status, notes)
    VALUES (@name, @industry, @address, @city, @state, @contact_name, @contact_email, @contact_phone, @owner_user_id, @status, @notes)
  `).run({ ...Object.fromEntries(CUSTOMER_FIELDS.map((f) => [f, b[f] ?? null])) });
  res.status(201).json(customerRow(info.lastInsertRowid));
});

app.put('/api/customers/:id', (req, res) => {
  const existing = customerRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['name', 'industry', 'address', 'city', 'state', 'contact_name', 'contact_email', 'contact_phone', 'owner_user_id', 'status']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!rowExists('users', b.owner_user_id)) return res.status(400).json({ error: 'owner_user_id does not reference a real user' });
  db.prepare(`
    UPDATE customers SET name=@name, industry=@industry, address=@address, city=@city, state=@state,
      contact_name=@contact_name, contact_email=@contact_email, contact_phone=@contact_phone,
      owner_user_id=@owner_user_id, status=@status, notes=@notes
    WHERE id=@id
  `).run({ id: req.params.id, ...Object.fromEntries(CUSTOMER_FIELDS.map((f) => [f, b[f] ?? null])) });
  res.json(customerRow(req.params.id));
});

app.delete('/api/customers/:id', (req, res) => {
  const existing = customerRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const blockers = [
    ['rfqs', 'customer_id', 'RFQ'],
    ['quotes', 'customer_id', 'quote'],
    ['work_orders', 'customer_id', 'work order'],
    ['shipments', 'customer_id', 'shipment'],
    ['invoices', 'customer_id', 'invoice'],
  ];
  if (checkBlockers(res, blockers, req.params.id)) return;
  db.prepare(`DELETE FROM customers WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});

// -------------------- rfqs --------------------
const RFQ_SELECT = `
  SELECT rf.*, c.name AS customer_name, u.name AS owner_name, u.initials AS owner_initials, u.color AS owner_color,
    (SELECT COUNT(*) FROM quotes q WHERE q.rfq_id = rf.id) AS quote_count
  FROM rfqs rf
  JOIN customers c ON c.id = rf.customer_id
  JOIN users u ON u.id = rf.owner_user_id
`;
function rfqRow(id) {
  return db.prepare(`${RFQ_SELECT} WHERE rf.id = ?`).get(id);
}

app.get('/api/rfqs', (req, res) => {
  res.json(db.prepare(`${RFQ_SELECT} ORDER BY rf.due_date`).all());
});

const RFQ_FIELDS = ['customer_id', 'title', 'description', 'target_price', 'due_date', 'status', 'owner_user_id', 'received_date'];

app.post('/api/rfqs', (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['customer_id', 'title', 'due_date', 'status', 'owner_user_id', 'received_date']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!rowExists('customers', b.customer_id)) return res.status(400).json({ error: 'customer_id does not reference a real customer' });
  if (!rowExists('users', b.owner_user_id)) return res.status(400).json({ error: 'owner_user_id does not reference a real user' });
  const info = db.prepare(`
    INSERT INTO rfqs (customer_id, title, description, target_price, due_date, status, owner_user_id, received_date)
    VALUES (@customer_id, @title, @description, @target_price, @due_date, @status, @owner_user_id, @received_date)
  `).run({ ...Object.fromEntries(RFQ_FIELDS.map((f) => [f, b[f] === '' ? null : b[f] ?? null])), target_price: b.target_price ? Number(b.target_price) : null });
  res.status(201).json(rfqRow(info.lastInsertRowid));
});

app.put('/api/rfqs/:id', (req, res) => {
  const existing = rfqRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['customer_id', 'title', 'due_date', 'status', 'owner_user_id', 'received_date']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!rowExists('customers', b.customer_id)) return res.status(400).json({ error: 'customer_id does not reference a real customer' });
  if (!rowExists('users', b.owner_user_id)) return res.status(400).json({ error: 'owner_user_id does not reference a real user' });
  db.prepare(`
    UPDATE rfqs SET customer_id=@customer_id, title=@title, description=@description, target_price=@target_price,
      due_date=@due_date, status=@status, owner_user_id=@owner_user_id, received_date=@received_date
    WHERE id=@id
  `).run({ id: req.params.id, ...Object.fromEntries(RFQ_FIELDS.map((f) => [f, b[f] === '' ? null : b[f] ?? null])), target_price: b.target_price ? Number(b.target_price) : null });
  res.json(rfqRow(req.params.id));
});

app.delete('/api/rfqs/:id', (req, res) => {
  const existing = rfqRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  if (checkBlockers(res, [['quotes', 'rfq_id', 'quote']], req.params.id)) return;
  db.prepare(`DELETE FROM rfqs WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});

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
function quoteRow(id) {
  return db.prepare(`${QUOTE_SELECT} WHERE q.id = ?`).get(id);
}

app.get('/api/quotes', (req, res) => {
  res.json(db.prepare(`${QUOTE_SELECT} ORDER BY q.quote_number DESC`).all());
});

app.post('/api/quotes', (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['customer_id', 'quote_number', 'total_amount', 'status', 'valid_until', 'owner_user_id']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!rowExists('customers', b.customer_id)) return res.status(400).json({ error: 'customer_id does not reference a real customer' });
  if (!rowExists('users', b.owner_user_id)) return res.status(400).json({ error: 'owner_user_id does not reference a real user' });
  if (b.rfq_id && !rowExists('rfqs', b.rfq_id)) return res.status(400).json({ error: 'rfq_id does not reference a real RFQ' });
  const info = db.prepare(`
    INSERT INTO quotes (rfq_id, customer_id, quote_number, total_amount, status, valid_until, owner_user_id)
    VALUES (@rfq_id, @customer_id, @quote_number, @total_amount, @status, @valid_until, @owner_user_id)
  `).run({
    rfq_id: b.rfq_id || null, customer_id: b.customer_id, quote_number: b.quote_number,
    total_amount: Number(b.total_amount) || 0, status: b.status, valid_until: b.valid_until, owner_user_id: b.owner_user_id,
  });
  res.status(201).json(quoteRow(info.lastInsertRowid));
});

app.put('/api/quotes/:id', (req, res) => {
  const existing = quoteRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['customer_id', 'quote_number', 'total_amount', 'status', 'valid_until', 'owner_user_id']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!rowExists('customers', b.customer_id)) return res.status(400).json({ error: 'customer_id does not reference a real customer' });
  if (!rowExists('users', b.owner_user_id)) return res.status(400).json({ error: 'owner_user_id does not reference a real user' });
  if (b.rfq_id && !rowExists('rfqs', b.rfq_id)) return res.status(400).json({ error: 'rfq_id does not reference a real RFQ' });
  db.prepare(`
    UPDATE quotes SET rfq_id=@rfq_id, customer_id=@customer_id, quote_number=@quote_number, total_amount=@total_amount,
      status=@status, valid_until=@valid_until, owner_user_id=@owner_user_id
    WHERE id=@id
  `).run({
    id: req.params.id, rfq_id: b.rfq_id || null, customer_id: b.customer_id, quote_number: b.quote_number,
    total_amount: Number(b.total_amount) || 0, status: b.status, valid_until: b.valid_until, owner_user_id: b.owner_user_id,
  });
  res.json(quoteRow(req.params.id));
});

app.delete('/api/quotes/:id', (req, res) => {
  const existing = quoteRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const blockers = [
    ['bill_of_materials', 'quote_id', 'BOM line item'],
    ['work_orders', 'quote_id', 'work order'],
  ];
  if (checkBlockers(res, blockers, req.params.id)) return;
  db.prepare(`DELETE FROM quotes WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});

// -------------------- bill of materials --------------------
const BOM_SELECT = `
  SELECT b.*, q.quote_number, c.name AS customer_name
  FROM bill_of_materials b
  JOIN quotes q ON q.id = b.quote_id
  JOIN customers c ON c.id = q.customer_id
`;
function bomRow(id) {
  return db.prepare(`${BOM_SELECT} WHERE b.id = ?`).get(id);
}

app.get('/api/bill-of-materials', (req, res) => {
  res.json(db.prepare(`${BOM_SELECT} ORDER BY b.id DESC`).all());
});

app.post('/api/bill-of-materials', (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['quote_id', 'part_name', 'material', 'quantity', 'unit_of_measure', 'unit_cost']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!rowExists('quotes', b.quote_id)) return res.status(400).json({ error: 'quote_id does not reference a real quote' });
  const info = db.prepare(`
    INSERT INTO bill_of_materials (quote_id, part_name, material, quantity, unit_of_measure, unit_cost, notes)
    VALUES (@quote_id, @part_name, @material, @quantity, @unit_of_measure, @unit_cost, @notes)
  `).run({
    quote_id: b.quote_id, part_name: b.part_name, material: b.material,
    quantity: Number(b.quantity) || 0, unit_of_measure: b.unit_of_measure, unit_cost: Number(b.unit_cost) || 0,
    notes: b.notes || null,
  });
  res.status(201).json(bomRow(info.lastInsertRowid));
});

app.put('/api/bill-of-materials/:id', (req, res) => {
  const existing = bomRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['quote_id', 'part_name', 'material', 'quantity', 'unit_of_measure', 'unit_cost']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!rowExists('quotes', b.quote_id)) return res.status(400).json({ error: 'quote_id does not reference a real quote' });
  db.prepare(`
    UPDATE bill_of_materials SET quote_id=@quote_id, part_name=@part_name, material=@material, quantity=@quantity,
      unit_of_measure=@unit_of_measure, unit_cost=@unit_cost, notes=@notes
    WHERE id=@id
  `).run({
    id: req.params.id, quote_id: b.quote_id, part_name: b.part_name, material: b.material,
    quantity: Number(b.quantity) || 0, unit_of_measure: b.unit_of_measure, unit_cost: Number(b.unit_cost) || 0,
    notes: b.notes || null,
  });
  res.json(bomRow(req.params.id));
});

app.delete('/api/bill-of-materials/:id', (req, res) => {
  const existing = bomRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  db.prepare(`DELETE FROM bill_of_materials WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});

// -------------------- suppliers --------------------
function supplierRow(id) {
  return db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM purchase_orders p WHERE p.supplier_id = s.id) AS po_count FROM suppliers s WHERE s.id = ?`).get(id);
}

app.get('/api/suppliers', (req, res) => {
  res.json(db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM purchase_orders p WHERE p.supplier_id = s.id) AS po_count FROM suppliers s ORDER BY s.name`).all());
});

const SUPPLIER_FIELDS = ['name', 'specialty', 'contact_name', 'contact_email', 'contact_phone', 'lead_time_days', 'notes'];

app.post('/api/suppliers', (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['name', 'specialty', 'contact_name', 'contact_email', 'contact_phone', 'lead_time_days']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  const info = db.prepare(`
    INSERT INTO suppliers (name, specialty, contact_name, contact_email, contact_phone, lead_time_days, notes)
    VALUES (@name, @specialty, @contact_name, @contact_email, @contact_phone, @lead_time_days, @notes)
  `).run({ ...Object.fromEntries(SUPPLIER_FIELDS.map((f) => [f, b[f] ?? null])), lead_time_days: Number(b.lead_time_days) || 0 });
  res.status(201).json(supplierRow(info.lastInsertRowid));
});

app.put('/api/suppliers/:id', (req, res) => {
  const existing = supplierRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['name', 'specialty', 'contact_name', 'contact_email', 'contact_phone', 'lead_time_days']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  db.prepare(`
    UPDATE suppliers SET name=@name, specialty=@specialty, contact_name=@contact_name, contact_email=@contact_email,
      contact_phone=@contact_phone, lead_time_days=@lead_time_days, notes=@notes
    WHERE id=@id
  `).run({ id: req.params.id, ...Object.fromEntries(SUPPLIER_FIELDS.map((f) => [f, b[f] ?? null])), lead_time_days: Number(b.lead_time_days) || 0 });
  res.json(supplierRow(req.params.id));
});

app.delete('/api/suppliers/:id', (req, res) => {
  const existing = supplierRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  if (checkBlockers(res, [['purchase_orders', 'supplier_id', 'purchase order']], req.params.id)) return;
  db.prepare(`DELETE FROM suppliers WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});

// -------------------- purchase orders --------------------
const PO_SELECT = `
  SELECT p.*, s.name AS supplier_name, s.specialty AS supplier_specialty
  FROM purchase_orders p
  JOIN suppliers s ON s.id = p.supplier_id
`;
function poRow(id) {
  return db.prepare(`${PO_SELECT} WHERE p.id = ?`).get(id);
}

app.get('/api/purchase-orders', (req, res) => {
  res.json(db.prepare(`${PO_SELECT} ORDER BY p.order_date DESC`).all());
});

app.post('/api/purchase-orders', (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['supplier_id', 'po_number', 'status', 'total_amount', 'order_date']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!rowExists('suppliers', b.supplier_id)) return res.status(400).json({ error: 'supplier_id does not reference a real supplier' });
  const info = db.prepare(`
    INSERT INTO purchase_orders (supplier_id, po_number, status, total_amount, order_date, expected_date, notes)
    VALUES (@supplier_id, @po_number, @status, @total_amount, @order_date, @expected_date, @notes)
  `).run({
    supplier_id: b.supplier_id, po_number: b.po_number, status: b.status, total_amount: Number(b.total_amount) || 0,
    order_date: b.order_date, expected_date: b.expected_date || null, notes: b.notes || null,
  });
  res.status(201).json(poRow(info.lastInsertRowid));
});

app.put('/api/purchase-orders/:id', (req, res) => {
  const existing = poRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['supplier_id', 'po_number', 'status', 'total_amount', 'order_date']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!rowExists('suppliers', b.supplier_id)) return res.status(400).json({ error: 'supplier_id does not reference a real supplier' });
  db.prepare(`
    UPDATE purchase_orders SET supplier_id=@supplier_id, po_number=@po_number, status=@status, total_amount=@total_amount,
      order_date=@order_date, expected_date=@expected_date, notes=@notes
    WHERE id=@id
  `).run({
    id: req.params.id, supplier_id: b.supplier_id, po_number: b.po_number, status: b.status, total_amount: Number(b.total_amount) || 0,
    order_date: b.order_date, expected_date: b.expected_date || null, notes: b.notes || null,
  });
  res.json(poRow(req.params.id));
});

app.delete('/api/purchase-orders/:id', (req, res) => {
  const existing = poRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  db.prepare(`DELETE FROM purchase_orders WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});

// -------------------- work orders --------------------
const WORK_ORDER_SELECT = `
  SELECT w.*, c.name AS customer_name, q.quote_number, u.name AS owner_name, u.initials AS owner_initials, u.color AS owner_color,
    (SELECT COUNT(*) FROM quality_inspections qi WHERE qi.work_order_id = w.id) AS inspection_count
  FROM work_orders w
  JOIN customers c ON c.id = w.customer_id
  LEFT JOIN quotes q ON q.id = w.quote_id
  JOIN users u ON u.id = w.owner_user_id
`;
function workOrderRow(id) {
  return db.prepare(`${WORK_ORDER_SELECT} WHERE w.id = ?`).get(id);
}

app.get('/api/work-orders', (req, res) => {
  res.json(db.prepare(`${WORK_ORDER_SELECT} ORDER BY w.due_date`).all());
});

app.post('/api/work-orders', (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['customer_id', 'work_order_number', 'status', 'owner_user_id', 'due_date']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!rowExists('customers', b.customer_id)) return res.status(400).json({ error: 'customer_id does not reference a real customer' });
  if (!rowExists('users', b.owner_user_id)) return res.status(400).json({ error: 'owner_user_id does not reference a real user' });
  if (b.quote_id && !rowExists('quotes', b.quote_id)) return res.status(400).json({ error: 'quote_id does not reference a real quote' });
  const info = db.prepare(`
    INSERT INTO work_orders (quote_id, customer_id, work_order_number, status, owner_user_id, start_date, due_date, notes)
    VALUES (@quote_id, @customer_id, @work_order_number, @status, @owner_user_id, @start_date, @due_date, @notes)
  `).run({
    quote_id: b.quote_id || null, customer_id: b.customer_id, work_order_number: b.work_order_number, status: b.status,
    owner_user_id: b.owner_user_id, start_date: b.start_date || null, due_date: b.due_date, notes: b.notes || null,
  });
  res.status(201).json(workOrderRow(info.lastInsertRowid));
});

app.put('/api/work-orders/:id', (req, res) => {
  const existing = workOrderRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['customer_id', 'work_order_number', 'status', 'owner_user_id', 'due_date']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!rowExists('customers', b.customer_id)) return res.status(400).json({ error: 'customer_id does not reference a real customer' });
  if (!rowExists('users', b.owner_user_id)) return res.status(400).json({ error: 'owner_user_id does not reference a real user' });
  if (b.quote_id && !rowExists('quotes', b.quote_id)) return res.status(400).json({ error: 'quote_id does not reference a real quote' });
  db.prepare(`
    UPDATE work_orders SET quote_id=@quote_id, customer_id=@customer_id, work_order_number=@work_order_number, status=@status,
      owner_user_id=@owner_user_id, start_date=@start_date, due_date=@due_date, notes=@notes
    WHERE id=@id
  `).run({
    id: req.params.id, quote_id: b.quote_id || null, customer_id: b.customer_id, work_order_number: b.work_order_number, status: b.status,
    owner_user_id: b.owner_user_id, start_date: b.start_date || null, due_date: b.due_date, notes: b.notes || null,
  });
  res.json(workOrderRow(req.params.id));
});

app.delete('/api/work-orders/:id', (req, res) => {
  const existing = workOrderRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const blockers = [
    ['quality_inspections', 'work_order_id', 'quality inspection'],
    ['shipments', 'work_order_id', 'shipment'],
    ['invoices', 'work_order_id', 'invoice'],
  ];
  if (checkBlockers(res, blockers, req.params.id)) return;
  db.prepare(`DELETE FROM work_orders WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});

// -------------------- quality inspections --------------------
const QI_SELECT = `
  SELECT qi.*, w.work_order_number, c.name AS customer_name, u.name AS inspector_name, u.initials AS inspector_initials, u.color AS inspector_color
  FROM quality_inspections qi
  JOIN work_orders w ON w.id = qi.work_order_id
  JOIN customers c ON c.id = w.customer_id
  JOIN users u ON u.id = qi.inspector_user_id
`;
function qiRow(id) {
  return db.prepare(`${QI_SELECT} WHERE qi.id = ?`).get(id);
}

app.get('/api/quality-inspections', (req, res) => {
  res.json(db.prepare(`${QI_SELECT} ORDER BY qi.inspection_date DESC`).all());
});

app.post('/api/quality-inspections', (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['work_order_id', 'inspector_user_id', 'inspection_date', 'result']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!rowExists('work_orders', b.work_order_id)) return res.status(400).json({ error: 'work_order_id does not reference a real work order' });
  if (!rowExists('users', b.inspector_user_id)) return res.status(400).json({ error: 'inspector_user_id does not reference a real user' });
  const info = db.prepare(`
    INSERT INTO quality_inspections (work_order_id, inspector_user_id, inspection_date, result, notes)
    VALUES (@work_order_id, @inspector_user_id, @inspection_date, @result, @notes)
  `).run({ work_order_id: b.work_order_id, inspector_user_id: b.inspector_user_id, inspection_date: b.inspection_date, result: b.result, notes: b.notes || null });
  res.status(201).json(qiRow(info.lastInsertRowid));
});

app.put('/api/quality-inspections/:id', (req, res) => {
  const existing = qiRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['work_order_id', 'inspector_user_id', 'inspection_date', 'result']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!rowExists('work_orders', b.work_order_id)) return res.status(400).json({ error: 'work_order_id does not reference a real work order' });
  if (!rowExists('users', b.inspector_user_id)) return res.status(400).json({ error: 'inspector_user_id does not reference a real user' });
  db.prepare(`
    UPDATE quality_inspections SET work_order_id=@work_order_id, inspector_user_id=@inspector_user_id,
      inspection_date=@inspection_date, result=@result, notes=@notes
    WHERE id=@id
  `).run({ id: req.params.id, work_order_id: b.work_order_id, inspector_user_id: b.inspector_user_id, inspection_date: b.inspection_date, result: b.result, notes: b.notes || null });
  res.json(qiRow(req.params.id));
});

app.delete('/api/quality-inspections/:id', (req, res) => {
  const existing = qiRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  db.prepare(`DELETE FROM quality_inspections WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});

// -------------------- shipments --------------------
const SHIPMENT_SELECT = `
  SELECT sh.*, w.work_order_number, c.name AS customer_name
  FROM shipments sh
  JOIN work_orders w ON w.id = sh.work_order_id
  JOIN customers c ON c.id = sh.customer_id
`;
function shipmentRow(id) {
  return db.prepare(`${SHIPMENT_SELECT} WHERE sh.id = ?`).get(id);
}

app.get('/api/shipments', (req, res) => {
  res.json(db.prepare(`${SHIPMENT_SELECT} ORDER BY sh.ship_date IS NULL, sh.ship_date DESC`).all());
});

app.post('/api/shipments', (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['work_order_id', 'customer_id', 'carrier', 'status']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!rowExists('work_orders', b.work_order_id)) return res.status(400).json({ error: 'work_order_id does not reference a real work order' });
  if (!rowExists('customers', b.customer_id)) return res.status(400).json({ error: 'customer_id does not reference a real customer' });
  const info = db.prepare(`
    INSERT INTO shipments (work_order_id, customer_id, ship_date, carrier, tracking_number, status)
    VALUES (@work_order_id, @customer_id, @ship_date, @carrier, @tracking_number, @status)
  `).run({
    work_order_id: b.work_order_id, customer_id: b.customer_id, ship_date: b.ship_date || null,
    carrier: b.carrier, tracking_number: b.tracking_number || null, status: b.status,
  });
  res.status(201).json(shipmentRow(info.lastInsertRowid));
});

app.put('/api/shipments/:id', (req, res) => {
  const existing = shipmentRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['work_order_id', 'customer_id', 'carrier', 'status']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!rowExists('work_orders', b.work_order_id)) return res.status(400).json({ error: 'work_order_id does not reference a real work order' });
  if (!rowExists('customers', b.customer_id)) return res.status(400).json({ error: 'customer_id does not reference a real customer' });
  db.prepare(`
    UPDATE shipments SET work_order_id=@work_order_id, customer_id=@customer_id, ship_date=@ship_date,
      carrier=@carrier, tracking_number=@tracking_number, status=@status
    WHERE id=@id
  `).run({
    id: req.params.id, work_order_id: b.work_order_id, customer_id: b.customer_id, ship_date: b.ship_date || null,
    carrier: b.carrier, tracking_number: b.tracking_number || null, status: b.status,
  });
  res.json(shipmentRow(req.params.id));
});

app.delete('/api/shipments/:id', (req, res) => {
  const existing = shipmentRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  db.prepare(`DELETE FROM shipments WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});

// -------------------- invoices --------------------
const INVOICE_SELECT = `
  SELECT i.*, w.work_order_number, c.name AS customer_name
  FROM invoices i
  JOIN work_orders w ON w.id = i.work_order_id
  JOIN customers c ON c.id = i.customer_id
`;
function invoiceRow(id) {
  return db.prepare(`${INVOICE_SELECT} WHERE i.id = ?`).get(id);
}

app.get('/api/invoices', (req, res) => {
  res.json(db.prepare(`${INVOICE_SELECT} ORDER BY i.due_date`).all());
});

app.post('/api/invoices', (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['work_order_id', 'customer_id', 'invoice_number', 'amount', 'status', 'issue_date', 'due_date']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!rowExists('work_orders', b.work_order_id)) return res.status(400).json({ error: 'work_order_id does not reference a real work order' });
  if (!rowExists('customers', b.customer_id)) return res.status(400).json({ error: 'customer_id does not reference a real customer' });
  const info = db.prepare(`
    INSERT INTO invoices (work_order_id, customer_id, invoice_number, amount, status, issue_date, due_date)
    VALUES (@work_order_id, @customer_id, @invoice_number, @amount, @status, @issue_date, @due_date)
  `).run({
    work_order_id: b.work_order_id, customer_id: b.customer_id, invoice_number: b.invoice_number,
    amount: Number(b.amount) || 0, status: b.status, issue_date: b.issue_date, due_date: b.due_date,
  });
  res.status(201).json(invoiceRow(info.lastInsertRowid));
});

app.put('/api/invoices/:id', (req, res) => {
  const existing = invoiceRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const missing = missingField(b, ['work_order_id', 'customer_id', 'invoice_number', 'amount', 'status', 'issue_date', 'due_date']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  if (!rowExists('work_orders', b.work_order_id)) return res.status(400).json({ error: 'work_order_id does not reference a real work order' });
  if (!rowExists('customers', b.customer_id)) return res.status(400).json({ error: 'customer_id does not reference a real customer' });
  db.prepare(`
    UPDATE invoices SET work_order_id=@work_order_id, customer_id=@customer_id, invoice_number=@invoice_number,
      amount=@amount, status=@status, issue_date=@issue_date, due_date=@due_date
    WHERE id=@id
  `).run({
    id: req.params.id, work_order_id: b.work_order_id, customer_id: b.customer_id, invoice_number: b.invoice_number,
    amount: Number(b.amount) || 0, status: b.status, issue_date: b.issue_date, due_date: b.due_date,
  });
  res.json(invoiceRow(req.params.id));
});

app.delete('/api/invoices/:id', (req, res) => {
  const existing = invoiceRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  db.prepare(`DELETE FROM invoices WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});

// -------------------- activities --------------------
app.get('/api/activities', (req, res) => {
  const rows = db.prepare(`
    SELECT a.*, u.name AS owner_name, u.initials AS owner_initials, u.color AS owner_color
    FROM activities a
    JOIN users u ON u.id = a.owner_user_id
    ORDER BY a.occurred_at DESC
  `).all();
  res.json(rows);
});

// -------------------- automations --------------------
app.get('/api/automations', (req, res) => {
  res.json(db.prepare(`SELECT * FROM automations ORDER BY name`).all());
});

app.post('/api/automations', (req, res) => {
  const b = req.body || {};
  const missing = missingField(b, ['name', 'trigger_desc', 'action_desc']);
  if (missing) return res.status(400).json({ error: `${missing} is required` });
  const info = db.prepare(`
    INSERT INTO automations (name, trigger_desc, action_desc, active, runs_30d)
    VALUES (@name, @trigger_desc, @action_desc, @active, 0)
  `).run({ name: b.name, trigger_desc: b.trigger_desc, action_desc: b.action_desc, active: b.active === false ? 0 : 1 });
  res.status(201).json(db.prepare(`SELECT * FROM automations WHERE id = ?`).get(info.lastInsertRowid));
});

app.patch('/api/automations/:id/active', (req, res) => {
  const existing = db.prepare(`SELECT * FROM automations WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const { active } = req.body || {};
  db.prepare(`UPDATE automations SET active = ? WHERE id = ?`).run(active ? 1 : 0, req.params.id);
  res.json(db.prepare(`SELECT * FROM automations WHERE id = ?`).get(req.params.id));
});

app.delete('/api/automations/:id', (req, res) => {
  const existing = db.prepare(`SELECT * FROM automations WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  db.prepare(`DELETE FROM automations WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});

// -------------------- dashboard --------------------
app.get('/api/dashboard', (req, res) => {
  const openRfqs = db.prepare(`SELECT COUNT(*) AS n FROM rfqs WHERE status = 'New'`).get().n;
  const quotesAwaiting = db.prepare(`SELECT COUNT(*) AS n FROM quotes WHERE status = 'Sent'`).get().n;
  const workOrdersInProduction = db.prepare(`
    SELECT COUNT(*) AS n FROM work_orders WHERE status IN ('Queued', 'In Fabrication', 'In Welding', 'Quality Inspection')
  `).get().n;
  const posAwaitingDelivery = db.prepare(`SELECT COUNT(*) AS n FROM purchase_orders WHERE status IN ('Sent', 'Confirmed')`).get().n;
  const revenueThisMonth = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS v FROM invoices WHERE issue_date >= '2026-09-01'
  `).get().v;

  const workOrdersDueSoon = db.prepare(`
    SELECT w.id, w.work_order_number, w.status, w.due_date, c.name AS customer_name, u.name AS owner_name, u.initials AS owner_initials, u.color AS owner_color
    FROM work_orders w JOIN customers c ON c.id = w.customer_id JOIN users u ON u.id = w.owner_user_id
    WHERE w.status NOT IN ('Completed')
    ORDER BY w.due_date LIMIT 6
  `).all();

  const recentActivity = db.prepare(`
    SELECT a.id, a.type, a.subject, a.occurred_at, a.notes, u.name AS owner_name, u.initials AS owner_initials, u.color AS owner_color
    FROM activities a JOIN users u ON u.id = a.owner_user_id
    ORDER BY a.occurred_at DESC LIMIT 8
  `).all();

  const workOrdersByStatus = db.prepare(`
    SELECT status, COUNT(*) AS count FROM work_orders GROUP BY status
  `).all();

  const posAwaiting = db.prepare(`
    SELECT p.id, p.po_number, p.status, p.expected_date, p.total_amount, s.name AS supplier_name
    FROM purchase_orders p JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.status IN ('Sent', 'Confirmed')
    ORDER BY p.expected_date LIMIT 6
  `).all();

  res.json({
    kpis: { openRfqs, quotesAwaiting, workOrdersInProduction, posAwaitingDelivery, revenueThisMonth },
    workOrdersByStatus,
    workOrdersDueSoon,
    recentActivity,
    posAwaiting,
  });
});

// -------------------- reports --------------------
app.get('/api/reports', (req, res) => {
  const totalRfqs = db.prepare(`SELECT COUNT(*) AS n FROM rfqs`).get().n;
  const wonRfqs = db.prepare(`SELECT COUNT(*) AS n FROM rfqs WHERE status = 'Won'`).get().n;
  const lostRfqs = db.prepare(`SELECT COUNT(*) AS n FROM rfqs WHERE status = 'Lost'`).get().n;
  const decided = wonRfqs + lostRfqs;
  const winRate = decided > 0 ? Math.round((wonRfqs / decided) * 100) : 0;

  const shipmentsTotal = db.prepare(`SELECT COUNT(*) AS n FROM shipments WHERE status = 'Delivered'`).get().n;
  const workOrdersCompleted = db.prepare(`SELECT COUNT(*) AS n FROM work_orders WHERE status = 'Completed'`).get().n;
  const workOrdersOnHold = db.prepare(`SELECT COUNT(*) AS n FROM work_orders WHERE status = 'On Hold'`).get().n;
  const onTimeDeliveryRate = shipmentsTotal > 0
    ? Math.round((db.prepare(`SELECT COUNT(*) AS n FROM shipments s JOIN work_orders w ON w.id = s.work_order_id WHERE s.status = 'Delivered' AND s.ship_date <= w.due_date`).get().n / shipmentsTotal) * 100)
    : 100;

  const revenueByMonth = db.prepare(`
    SELECT substr(issue_date, 1, 7) AS month, COALESCE(SUM(amount), 0) AS revenue, COUNT(*) AS invoice_count
    FROM invoices GROUP BY month ORDER BY month
  `).all();

  const inspectionResults = db.prepare(`
    SELECT result, COUNT(*) AS count FROM quality_inspections GROUP BY result
  `).all();

  const revenueByCustomer = db.prepare(`
    SELECT c.name AS customer_name, c.industry, COALESCE(SUM(i.amount), 0) AS revenue, COUNT(i.id) AS invoice_count
    FROM customers c LEFT JOIN invoices i ON i.customer_id = c.id
    GROUP BY c.id ORDER BY revenue DESC
  `).all();

  const poStatusBreakdown = db.prepare(`
    SELECT status, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS amount FROM purchase_orders GROUP BY status
  `).all();

  const quoteCount = db.prepare(`SELECT COUNT(*) AS n FROM quotes`).get().n;
  const acceptedQuotes = db.prepare(`SELECT COUNT(*) AS n FROM quotes WHERE status = 'Accepted'`).get().n;
  const quoteAcceptRate = quoteCount > 0 ? Math.round((acceptedQuotes / quoteCount) * 100) : 0;

  res.json({
    winRate, wonRfqs, lostRfqs, totalRfqs,
    onTimeDeliveryRate, workOrdersCompleted, workOrdersOnHold,
    revenueByMonth, inspectionResults, revenueByCustomer, poStatusBreakdown,
    quoteCount, acceptedQuotes, quoteAcceptRate,
  });
});

// Serve the built React app for every non-API route. Placed after all
// /api/* routes above so it only ever catches page loads, never API calls.
app.use(express.static(CLIENT_DIST));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Anvil API listening on http://localhost:${PORT}`);
});
