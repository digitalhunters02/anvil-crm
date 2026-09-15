import db from './db.js';

// -------------------- skip if already seeded --------------------
// The DB persists across server restarts (schema.sql uses CREATE TABLE IF NOT
// EXISTS, not DROP), and this seed script is safe to run on every boot. Only
// seed a fresh, empty database so real records created through the app are
// never wiped out.
const alreadySeeded = db.prepare(`SELECT COUNT(*) AS n FROM customers`).get().n > 0;
if (alreadySeeded) {
  console.log('Database already has data — skipping seed.');
  process.exit(0);
}

// -------------------- wipe (fresh DB only) --------------------
const tables = [
  'automations', 'activities', 'invoices', 'shipments', 'quality_inspections',
  'work_orders', 'purchase_orders', 'suppliers', 'bill_of_materials', 'quotes',
  'rfqs', 'customers', 'users',
];
for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();

// -------------------- users (shop & office staff) --------------------
const userRows = [
  { name: 'Derek Malone', email: 'derek.malone@vanguardfab.com', role: 'VP of Operations', initials: 'DM', color: '#8a1f18' },
  { name: 'Sofia Reyes', email: 'sofia.reyes@vanguardfab.com', role: 'Sales Engineer', initials: 'SR', color: '#1d5c8a' },
  { name: 'Walter Krupa', email: 'walter.krupa@vanguardfab.com', role: 'Shop Foreman', initials: 'WK', color: '#57621f' },
  { name: 'Angela Byrne', email: 'angela.byrne@vanguardfab.com', role: 'Quality Manager', initials: 'AB', color: '#6a4a8a' },
  { name: 'Marcus Todd', email: 'marcus.todd@vanguardfab.com', role: 'Purchasing Agent', initials: 'MT', color: '#8a6a1a' },
  { name: 'Jenna Okafor', email: 'jenna.okafor@vanguardfab.com', role: 'Sales Engineer', initials: 'JO', color: '#1d5c8a' },
];
const insertUser = db.prepare(`INSERT INTO users (name, email, role, initials, color) VALUES (@name, @email, @role, @initials, @color)`);
const userIds = userRows.map((r) => insertUser.run(r).lastInsertRowid);
const [DEREK, SOFIA, WALTER, ANGELA, MARCUS, JENNA] = userIds;

// -------------------- customers --------------------
const customerRows = [
  { name: 'Continental Bridge & Iron', industry: 'Construction', address: '1180 Broadway Ave', city: 'Gary', state: 'IN', contact_name: 'Grace Ferraro', contact_email: 'grace.ferraro@continentalbridge.com', contact_phone: '(219) 555-0118', owner_user_id: SOFIA, status: 'Active', notes: 'Long-running structural steel account; repeat bridge deck girder orders.' },
  { name: 'Lakeshore Grain Systems', industry: 'Agriculture', address: '600 Silo Rd', city: 'Valparaiso', state: 'IN', contact_name: 'Owen Baptiste', contact_email: 'owen.baptiste@lakeshoregrain.com', contact_phone: '(219) 555-0142', owner_user_id: JENNA, status: 'Active', notes: 'Grain elevator platforms and catwalks, seasonal ordering pattern.' },
  { name: 'Bulwark Rail Components', industry: 'Rail', address: '2200 Sohl Ave', city: 'Hammond', state: 'IN', contact_name: 'Renata Choi', contact_email: 'renata.choi@bulwarkrail.com', contact_phone: '(219) 555-0177', owner_user_id: SOFIA, status: 'Active', notes: 'AAR-spec welded frame assemblies; strict weld inspection requirements.' },
  { name: 'Drayton Oilfield Services', industry: 'Oil & Gas', address: '4410 W County Rd', city: 'Odessa', state: 'TX', contact_name: 'Hollis Vance', contact_email: 'hollis.vance@draytonoil.com', contact_phone: '(432) 555-0193', owner_user_id: JENNA, status: 'Prospect', notes: 'New RFQ inbound for wellhead skid frames; first order pending.' },
  { name: 'Titan Material Handling', industry: 'Industrial Equipment', address: '7750 Broadway', city: 'Merrillville', state: 'IN', contact_name: 'Priya Nandakumar', contact_email: 'priya.nandakumar@titanmh.com', contact_phone: '(219) 555-0164', owner_user_id: SOFIA, status: 'Active', notes: 'Conveyor support structures and custom hoppers.' },
  { name: 'Heartland Mining Equipment', industry: 'Mining', address: '900 Lake Ave', city: 'Duluth', state: 'MN', contact_name: 'Dale Oduya', contact_email: 'dale.oduya@heartlandmining.com', contact_phone: '(218) 555-0129', owner_user_id: JENNA, status: 'Watch', notes: 'Payment terms slipping on last two invoices — monitor closely.' },
  { name: 'Superior Energy Structures', industry: 'Energy', address: '3100 Chester Ave', city: 'Cleveland', state: 'OH', contact_name: 'Faye Lindqvist', contact_email: 'faye.lindqvist@superiorenergy.com', contact_phone: '(216) 555-0155', owner_user_id: SOFIA, status: 'Active', notes: 'Turbine base frames and transformer enclosures.' },
  { name: 'Ashcroft Defense Fabrication', industry: 'Defense', address: '5200 Redstone Rd', city: 'Huntsville', state: 'AL', contact_name: 'Miles Stroud', contact_email: 'miles.stroud@ashcroftdefense.com', contact_phone: '(256) 555-0187', owner_user_id: JENNA, status: 'Prospect', notes: 'ITAR-controlled program; requires additional documentation on every RFQ.' },
];
const insertCustomer = db.prepare(`
  INSERT INTO customers (name, industry, address, city, state, contact_name, contact_email, contact_phone, owner_user_id, status, notes)
  VALUES (@name, @industry, @address, @city, @state, @contact_name, @contact_email, @contact_phone, @owner_user_id, @status, @notes)
`);
const customerIds = customerRows.map((r) => insertCustomer.run(r).lastInsertRowid);

// -------------------- rfqs --------------------
const rfqSeed = [
  { c: 0, title: 'Bridge Deck Girder Assembly — Lot 14', description: 'Welded A36 plate girders, 6 units, shot-blast finish.', target_price: 118000, due: '2026-09-22', status: 'Quoted', owner: SOFIA, received: '2026-08-20' },
  { c: 0, title: 'Pedestrian Overpass Truss Repair Kit', description: 'Field-repair truss segments for existing structure.', target_price: 42000, due: '2026-10-05', status: 'New', owner: SOFIA, received: '2026-09-05' },
  { c: 1, title: 'Grain Elevator Catwalk & Handrail Package', description: 'Galvanized catwalk sections, 180 linear ft.', target_price: 76000, due: '2026-09-25', status: 'Won', owner: JENNA, received: '2026-08-12' },
  { c: 1, title: 'Silo Support Leg Reinforcement', description: 'Retrofit reinforcement gussets for six silo legs.', target_price: 31000, due: '2026-10-15', status: 'New', owner: JENNA, received: '2026-09-08' },
  { c: 2, title: 'AAR Welded Frame Assembly — Rev D', description: 'Rail car frame assemblies, AAR M-1003 certified welding.', target_price: 214000, due: '2026-09-18', status: 'Won', owner: SOFIA, received: '2026-08-01' },
  { c: 3, title: 'Wellhead Skid Frame — Prototype', description: 'First-article skid frame for wellhead package, 304 stainless fasteners.', target_price: 58000, due: '2026-09-30', status: 'Quoted', owner: JENNA, received: '2026-08-28' },
  { c: 4, title: 'Conveyor Support Structure — Line 3', description: 'Structural steel support towers for new conveyor line.', target_price: 96000, due: '2026-09-20', status: 'Won', owner: SOFIA, received: '2026-08-05' },
  { c: 4, title: 'Custom Hopper, 40 cu ft', description: 'Stainless-lined carbon steel hopper with vibration isolators.', target_price: 27500, due: '2026-10-10', status: 'Quoted', owner: SOFIA, received: '2026-09-10' },
  { c: 5, title: 'Dragline Bucket Reinforcement Plates', description: 'AR400 wear plate kits for dragline buckets.', target_price: 39000, due: '2026-09-12', status: 'Lost', owner: JENNA, received: '2026-07-28' },
  { c: 6, title: 'Turbine Base Frame — 2.5MW', description: 'Heavy weldment base frame, precision-machined mounting faces.', target_price: 168000, due: '2026-09-28', status: 'Quoted', owner: SOFIA, received: '2026-08-22' },
  { c: 6, title: 'Transformer Enclosure Panels', description: 'Louvered enclosure panels, powder coat finish.', target_price: 44500, due: '2026-10-18', status: 'New', owner: SOFIA, received: '2026-09-11' },
  { c: 7, title: 'Ruggedized Equipment Rack Frames', description: 'ITAR program frames, MIL-SPEC welding documentation required.', target_price: 87000, due: '2026-10-01', status: 'New', owner: JENNA, received: '2026-09-06' },
];
const insertRfq = db.prepare(`
  INSERT INTO rfqs (customer_id, title, description, target_price, due_date, status, owner_user_id, received_date)
  VALUES (@customer_id, @title, @description, @target_price, @due_date, @status, @owner_user_id, @received_date)
`);
const rfqIds = rfqSeed.map((r) => insertRfq.run({
  customer_id: customerIds[r.c], title: r.title, description: r.description, target_price: r.target_price,
  due_date: r.due, status: r.status, owner_user_id: r.owner, received_date: r.received,
}).lastInsertRowid);

// -------------------- quotes --------------------
// One quote per RFQ that reached Quoted, Won or Lost.
const quotable = rfqSeed
  .map((r, i) => ({ r, idx: i }))
  .filter((x) => ['Quoted', 'Won', 'Lost'].includes(x.r.status));
const insertQuote = db.prepare(`
  INSERT INTO quotes (rfq_id, customer_id, quote_number, total_amount, status, valid_until, owner_user_id)
  VALUES (@rfq_id, @customer_id, @quote_number, @total_amount, @status, @valid_until, @owner_user_id)
`);
const quoteIds = [];
const quoteMeta = [];
quotable.forEach((x, n) => {
  const r = x.r;
  const total = Math.round(r.target_price * (0.96 + (n % 5) * 0.02) * 100) / 100;
  const status = r.status === 'Lost' ? 'Rejected' : r.status === 'Won' ? 'Accepted' : 'Sent';
  const row = {
    rfq_id: rfqIds[x.idx],
    customer_id: customerIds[r.c],
    quote_number: `Q-2026-${1000 + n}`,
    total_amount: total,
    status,
    valid_until: '2026-1' + (0 + (n % 2)) + '-15',
    owner_user_id: r.owner,
  };
  const id = insertQuote.run(row).lastInsertRowid;
  quoteIds.push(id);
  quoteMeta.push({ id, row, customerIdx: r.c, rfqTitle: r.title });
});

// -------------------- bill of materials --------------------
const materialCycle = [
  ['A36 Steel Plate, 1/2in', 'ea', 'A36 Steel Plate'],
  ['304 Stainless Tube, 2in OD', 'ft', '304 Stainless Tube'],
  ['Structural I-Beam, W8x18', 'ft', 'A992 Structural Steel'],
  ['Galvanized Angle, 3x3x1/4', 'ft', 'Galvanized Steel Angle'],
  ['AR400 Wear Plate, 3/8in', 'sheet', 'AR400 Abrasion-Resistant Plate'],
  ['Hex Bolt Kit, Grade 8', 'kit', 'Zinc-Plated Fasteners'],
  ['Welding Wire, ER70S-6', 'spool', 'Welding Consumable'],
  ['Powder Coat Finish, Gray RAL7024', 'sqft', 'Powder Coat Finish'],
];
const insertBom = db.prepare(`
  INSERT INTO bill_of_materials (quote_id, part_name, material, quantity, unit_of_measure, unit_cost, notes)
  VALUES (@quote_id, @part_name, @material, @quantity, @unit_of_measure, @unit_cost, @notes)
`);
let bomCount = 0;
quoteMeta.forEach((q, qi) => {
  const lineCount = 2 + (qi % 2); // 2-3 line items per quote
  for (let li = 0; li < lineCount; li++) {
    const m = materialCycle[(qi * 3 + li) % materialCycle.length];
    const qty = [4, 8, 12, 20, 40, 60, 100][(qi + li) % 7];
    const unitCost = [38.5, 12.75, 54.0, 9.2, 61.0, 145.0, 22.5, 6.4][(qi + li) % 8];
    insertBom.run({
      quote_id: q.id,
      part_name: `${m[0]} — ${q.rfqTitle.split(' — ')[0]}`,
      material: m[2],
      quantity: qty,
      unit_of_measure: m[1],
      unit_cost: unitCost,
      notes: li === 0 ? 'Primary structural component' : null,
    });
    bomCount++;
  }
});

// -------------------- suppliers --------------------
const supplierRows = [
  { name: 'Heartland Steel Supply', specialty: 'Steel Plate & Bar', contact_name: 'Nora Fitzgerald', contact_email: 'nora.fitzgerald@heartlandsteel.com', contact_phone: '(219) 555-0210', lead_time_days: 10, notes: 'Primary plate and bar vendor; holds safety stock for A36 and A992.' },
  { name: 'Midwest Tube & Pipe', specialty: 'Tube & Pipe Stock', contact_name: 'Aiden Whitcomb', contact_email: 'aiden.whitcomb@midwesttube.com', contact_phone: '(219) 555-0234', lead_time_days: 14, notes: 'Stainless and carbon tube, cut-to-length service available.' },
  { name: 'Ironclad Fastener Co.', specialty: 'Fasteners & Hardware', contact_name: 'Bianca Solano', contact_email: 'bianca.solano@ironcladfastener.com', contact_phone: '(312) 555-0261', lead_time_days: 5, notes: 'Grade 8 and stainless fastener kits, quick-turn for rush orders.' },
  { name: 'Blackstone Coatings', specialty: 'Coatings & Finishing', contact_name: 'Trent Okafor', contact_email: 'trent.okafor@blackstonecoatings.com', contact_phone: '(219) 555-0288', lead_time_days: 7, notes: 'Powder coat and hot-dip galvanizing subcontractor.' },
  { name: 'Praxis Welding Supply', specialty: 'Welding Consumables & Gas', contact_name: 'Yvonne Pruitt', contact_email: 'yvonne.pruitt@praxiswelding.com', contact_phone: '(219) 555-0305', lead_time_days: 4, notes: 'Shielding gas, wire and rod; weekly delivery route to Gary shop.' },
  { name: 'Continental Alloys', specialty: 'Specialty & Stainless Alloys', contact_name: 'Callum Bregman', contact_email: 'callum.bregman@continentalalloys.com', contact_phone: '(713) 555-0327', lead_time_days: 21, notes: 'Longer lead times but only regional source for AR400 and duplex stainless.' },
];
const insertSupplier = db.prepare(`
  INSERT INTO suppliers (name, specialty, contact_name, contact_email, contact_phone, lead_time_days, notes)
  VALUES (@name, @specialty, @contact_name, @contact_email, @contact_phone, @lead_time_days, @notes)
`);
const supplierIds = supplierRows.map((r) => insertSupplier.run(r).lastInsertRowid);

// -------------------- purchase orders --------------------
const poSeed = [
  { s: 0, po: 'PO-2026-3001', status: 'Received', total: 18450, order: '2026-08-14', expected: '2026-08-24', notes: 'A36 plate stock for bridge girder run.' },
  { s: 0, po: 'PO-2026-3002', status: 'Confirmed', total: 12200, order: '2026-09-02', expected: '2026-09-14', notes: 'Restock W8x18 I-beam for Titan conveyor job.' },
  { s: 1, po: 'PO-2026-3003', status: 'Sent', total: 9400, order: '2026-09-08', expected: '2026-09-22', notes: '304 stainless tube for wellhead skid prototype.' },
  { s: 2, po: 'PO-2026-3004', status: 'Received', total: 4300, order: '2026-08-20', expected: '2026-08-27', notes: 'Grade 8 fastener kits, rush order.' },
  { s: 3, po: 'PO-2026-3005', status: 'Confirmed', total: 6800, order: '2026-09-05', expected: '2026-09-19', notes: 'Powder coat run for transformer enclosure panels.' },
  { s: 4, po: 'PO-2026-3006', status: 'Draft', total: 2100, order: '2026-09-13', expected: null, notes: 'Monthly welding wire and gas replenishment.' },
  { s: 5, po: 'PO-2026-3007', status: 'Sent', total: 15600, order: '2026-09-09', expected: '2026-10-01', notes: 'AR400 wear plate for dragline reinforcement (backup stock despite lost RFQ).' },
  { s: 0, po: 'PO-2026-3008', status: 'Received', total: 21750, order: '2026-07-30', expected: '2026-08-08', notes: 'Galvanized angle for grain elevator catwalk package.' },
  { s: 1, po: 'PO-2026-3009', status: 'Cancelled', total: 5200, order: '2026-08-02', expected: '2026-08-16', notes: 'Duplicate order, cancelled after inventory reconciliation.' },
];
const insertPo = db.prepare(`
  INSERT INTO purchase_orders (supplier_id, po_number, status, total_amount, order_date, expected_date, notes)
  VALUES (@supplier_id, @po_number, @status, @total_amount, @order_date, @expected_date, @notes)
`);
poSeed.forEach((p) => insertPo.run({
  supplier_id: supplierIds[p.s], po_number: p.po, status: p.status, total_amount: p.total,
  order_date: p.order, expected_date: p.expected, notes: p.notes,
}));

// -------------------- work orders --------------------
// Won quotes become work orders; add a couple of standalone reorders too.
const wonQuotes = quoteMeta.filter((q) => q.row.status === 'Accepted');
const workOrderStatusCycle = ['Completed', 'Ready to Ship', 'Quality Inspection', 'In Welding', 'In Fabrication', 'Queued', 'On Hold'];
const insertWo = db.prepare(`
  INSERT INTO work_orders (quote_id, customer_id, work_order_number, status, owner_user_id, start_date, due_date, notes)
  VALUES (@quote_id, @customer_id, @work_order_number, @status, @owner_user_id, @start_date, @due_date, @notes)
`);
const woRows = [];
wonQuotes.forEach((q, n) => {
  const status = workOrderStatusCycle[n % workOrderStatusCycle.length];
  woRows.push({
    quote_id: q.id,
    customer_id: customerIds[q.customerIdx],
    work_order_number: `WO-2026-${5000 + n}`,
    status,
    owner_user_id: WALTER,
    start_date: '2026-08-' + String(18 + (n % 10)).padStart(2, '0'),
    due_date: '2026-09-' + String(18 + (n % 12)).padStart(2, '0'),
    notes: status === 'On Hold' ? 'Waiting on customer-approved drawing revision.' : null,
  });
});
// Extra standalone work orders (repeat business, no linked quote) for status variety.
const extraWoSeed = [
  { c: 0, status: 'Completed', start: '2026-07-10', due: '2026-08-01', notes: 'Repeat girder run for adjacent span.' },
  { c: 2, status: 'Ready to Ship', start: '2026-08-05', due: '2026-09-10', notes: 'Second batch of AAR frame assemblies.' },
  { c: 4, status: 'In Fabrication', start: '2026-08-28', due: '2026-09-24', notes: 'Line 4 conveyor support towers.' },
  { c: 6, status: 'Quality Inspection', start: '2026-08-15', due: '2026-09-16', notes: 'Second turbine base frame in program.' },
  { c: 1, status: 'Queued', start: null, due: '2026-10-02', notes: 'Awaiting shop capacity after current catwalk run.' },
  { c: 3, status: 'In Welding', start: '2026-09-01', due: '2026-09-27', notes: 'Wellhead skid frame prototype, welding cell 2.' },
  { c: 5, status: 'On Hold', start: '2026-08-22', due: '2026-09-20', notes: 'Waiting on customer-approved drawing revision after QC rework flag.' },
];
extraWoSeed.forEach((e, n) => {
  woRows.push({
    quote_id: null,
    customer_id: customerIds[e.c],
    work_order_number: `WO-2026-${6000 + n}`,
    status: e.status,
    owner_user_id: WALTER,
    start_date: e.start,
    due_date: e.due,
    notes: e.notes,
  });
});
const workOrderIds = woRows.map((r) => insertWo.run(r).lastInsertRowid);

// -------------------- quality inspections --------------------
// Indexed against workOrderIds: 0=Completed 1=Ready to Ship 2=Quality Inspection
// 3=Completed 4=Ready to Ship 5=In Fabrication 6=Quality Inspection 7=Queued
// 8=In Welding 9=On Hold
const insertQi = db.prepare(`
  INSERT INTO quality_inspections (work_order_id, inspector_user_id, inspection_date, result, notes)
  VALUES (@work_order_id, @inspector_user_id, @inspection_date, @result, @notes)
`);
const qiSeed = [
  { wo: 0, date: '2026-08-30', result: 'Pass', notes: 'Dimensional and weld inspection passed per drawing spec.' },
  { wo: 1, date: '2026-09-05', result: 'Pass', notes: 'Final visual and dimensional check cleared for shipment.' },
  { wo: 2, date: '2026-09-10', result: 'Pending Rework', notes: 'Weld porosity found on gusset joint 3; rework required before release.' },
  { wo: 3, date: '2026-08-15', result: 'Pass', notes: 'Repeat girder run passed first-pass inspection.' },
  { wo: 4, date: '2026-09-08', result: 'Pass', notes: 'AAR-spec weld inspection passed; ready for release.' },
  { wo: 6, date: '2026-09-09', result: 'Fail', notes: 'Machined mounting face out of tolerance on turbine base frame.' },
  { wo: 6, date: '2026-09-12', result: 'Pending Rework', notes: 'Re-machining scheduled; second inspection pending.' },
  { wo: 9, date: '2026-09-06', result: 'Pending Rework', notes: 'Weld undercut flagged; drawing revision requested before continuing.' },
];
qiSeed.forEach((q) => insertQi.run({
  work_order_id: workOrderIds[q.wo], inspector_user_id: ANGELA, inspection_date: q.date, result: q.result, notes: q.notes,
}));
const qiCount = qiSeed.length;

// -------------------- shipments --------------------
const carriers = ['Old Dominion Freight Line', 'Saia LTL', 'XPO', 'Estes Express', 'YRC Freight'];
const insertShipment = db.prepare(`
  INSERT INTO shipments (work_order_id, customer_id, ship_date, carrier, tracking_number, status)
  VALUES (@work_order_id, @customer_id, @ship_date, @carrier, @tracking_number, @status)
`);
const shipmentSeed = [
  { wo: 0, status: 'Delivered', ship: '2026-08-22' },
  { wo: 1, status: 'Shipped', ship: '2026-09-10' },
  { wo: 2, status: 'Preparing', ship: null },
  { wo: 3, status: 'Delivered', ship: '2026-08-05' },
  { wo: 4, status: 'Shipped', ship: '2026-09-11' },
  { wo: 6, status: 'Preparing', ship: null },
];
shipmentSeed.forEach((s, n) => {
  const carrier = carriers[n % carriers.length];
  insertShipment.run({
    work_order_id: workOrderIds[s.wo],
    customer_id: woRows[s.wo].customer_id,
    ship_date: s.ship,
    carrier,
    tracking_number: s.status !== 'Preparing' ? `${carrier.slice(0, 3).toUpperCase()}${100000000 + n * 137}` : null,
    status: s.status,
  });
});
const shipmentCount = shipmentSeed.length;

// -------------------- invoices --------------------
const insertInvoice = db.prepare(`
  INSERT INTO invoices (work_order_id, customer_id, invoice_number, amount, status, issue_date, due_date)
  VALUES (@work_order_id, @customer_id, @invoice_number, @amount, @status, @issue_date, @due_date)
`);
function invoiceAmount(woIdx) {
  const q = quoteMeta.find((qm) => qm.id === woRows[woIdx].quote_id);
  return q ? q.row.total_amount : 32000 + woIdx * 4100;
}
const invoiceSeed = [
  { wo: 0, status: 'Paid', issue: '2026-08-24', due: '2026-09-07' },
  { wo: 1, status: 'Sent', issue: '2026-09-11', due: '2026-09-25' },
  { wo: 2, status: 'Draft', issue: '2026-09-12', due: '2026-09-26' },
  { wo: 3, status: 'Overdue', issue: '2026-08-08', due: '2026-08-22' },
  { wo: 4, status: 'Sent', issue: '2026-09-12', due: '2026-09-26' },
  { wo: 6, status: 'Draft', issue: '2026-09-13', due: '2026-09-27' },
  { wo: 7, status: 'Draft', issue: '2026-09-14', due: '2026-09-28' },
  { wo: 8, status: 'Draft', issue: '2026-09-14', due: '2026-09-28' },
];
invoiceSeed.forEach((inv, n) => insertInvoice.run({
  work_order_id: workOrderIds[inv.wo],
  customer_id: woRows[inv.wo].customer_id,
  invoice_number: `INV-2026-${7000 + n}`,
  amount: invoiceAmount(inv.wo),
  status: inv.status,
  issue_date: inv.issue,
  due_date: inv.due,
}));
const invoiceCount = invoiceSeed.length;

// -------------------- activities --------------------
const insertActivity = db.prepare(`
  INSERT INTO activities (type, subject, related_type, related_id, owner_user_id, occurred_at, notes)
  VALUES (@type, @subject, @related_type, @related_id, @owner_user_id, @occurred_at, @notes)
`);
const activitySeed = [
  { type: 'Call', subject: 'Reviewed RFQ scope with Continental Bridge & Iron', related_type: 'rfq', related_id: rfqIds[0], owner: SOFIA, at: '2026-09-14T09:30:00' },
  { type: 'Email', subject: 'Sent revised quote Q-2026-1000 to Grace Ferraro', related_type: 'quote', related_id: quoteIds[0], owner: SOFIA, at: '2026-09-13T14:10:00' },
  { type: 'Task', subject: 'Released BOM for grain elevator catwalk package', related_type: 'quote', related_id: quoteIds[1], owner: JENNA, at: '2026-09-12T11:00:00' },
  { type: 'Meeting', subject: 'Weld inspection walkthrough — AAR frame assembly', related_type: 'work_order', related_id: workOrderIds[1], owner: ANGELA, at: '2026-09-12T15:45:00' },
  { type: 'Call', subject: 'Followed up with Heartland Steel Supply on PO-2026-3002', related_type: 'purchase_order', related_id: null, owner: MARCUS, at: '2026-09-11T10:15:00' },
  { type: 'Task', subject: 'Logged quality failure on dragline reinforcement rework', related_type: 'quality_inspection', related_id: null, owner: ANGELA, at: '2026-09-11T08:50:00' },
  { type: 'Email', subject: 'Sent invoice INV-2026-7001 to Bulwark Rail Components', related_type: 'invoice', related_id: null, owner: DEREK, at: '2026-09-10T13:20:00' },
  { type: 'Call', subject: 'Confirmed lead time with Continental Alloys for AR400 plate', related_type: 'purchase_order', related_id: null, owner: MARCUS, at: '2026-09-09T09:05:00' },
  { type: 'Meeting', subject: 'Kickoff call — wellhead skid frame prototype', related_type: 'rfq', related_id: rfqIds[5], owner: JENNA, at: '2026-09-08T16:00:00' },
  { type: 'Task', subject: 'Scheduled quality inspection for turbine base frame', related_type: 'work_order', related_id: workOrderIds[6] || workOrderIds[0], owner: WALTER, at: '2026-09-08T07:40:00' },
  { type: 'Email', subject: 'Requested ITAR documentation from Ashcroft Defense', related_type: 'rfq', related_id: rfqIds[11], owner: JENNA, at: '2026-09-07T12:30:00' },
  { type: 'Call', subject: 'Escalated overdue invoice with Heartland Mining Equipment', related_type: 'invoice', related_id: null, owner: DEREK, at: '2026-09-05T11:15:00' },
  { type: 'Task', subject: 'Reworked gusset weld per QC rework note', related_type: 'work_order', related_id: workOrderIds[2] || workOrderIds[0], owner: WALTER, at: '2026-09-04T15:00:00' },
  { type: 'Meeting', subject: 'Production scheduling review with shop foreman', related_type: null, related_id: null, owner: DEREK, at: '2026-09-03T08:00:00' },
];
activitySeed.forEach((a) => insertActivity.run({
  type: a.type, subject: a.subject, related_type: a.related_type, related_id: a.related_id,
  owner_user_id: a.owner, occurred_at: a.at, notes: a.notes || null,
}));

// -------------------- automations --------------------
const automationRows = [
  { name: 'Overdue PO Alert', trigger_desc: 'Purchase order expected_date passes while status is Sent or Confirmed', action_desc: 'Notify purchasing agent to follow up with supplier', active: 1, runs_30d: 9 },
  { name: 'Quote Acceptance Notice', trigger_desc: 'Quote status changes to Accepted', action_desc: 'Notify sales engineer and auto-draft the work order', active: 1, runs_30d: 14 },
  { name: 'Work Order Hold Escalation', trigger_desc: 'Work order stays On Hold for more than 5 days', action_desc: 'Flag work order and notify shop foreman', active: 1, runs_30d: 3 },
  { name: 'Shipment Created Notice', trigger_desc: 'New shipment record created for a work order', action_desc: 'Email customer contact with carrier and tracking number', active: 1, runs_30d: 11 },
  { name: 'Failed Inspection Rework Routing', trigger_desc: 'Quality inspection result set to Fail or Pending Rework', action_desc: 'Route work order back to fabrication queue and notify quality manager', active: 1, runs_30d: 6 },
  { name: 'Invoice Overdue Reminder', trigger_desc: 'Invoice due_date passes while status is Sent', action_desc: 'Send reminder to customer contact and flag account owner', active: 0, runs_30d: 0 },
];
const insertAutomation = db.prepare(`
  INSERT INTO automations (name, trigger_desc, action_desc, active, runs_30d)
  VALUES (@name, @trigger_desc, @action_desc, @active, @runs_30d)
`);
automationRows.forEach((r) => insertAutomation.run(r));

console.log(
  `Seeded: ${userIds.length} users, ${customerIds.length} customers, ${rfqIds.length} RFQs, ${quoteIds.length} quotes, ` +
  `${bomCount} BOM line items, ${supplierIds.length} suppliers, ${poSeed.length} purchase orders, ${workOrderIds.length} work orders, ` +
  `${qiCount} quality inspections, ${shipmentCount} shipments, ${invoiceCount} invoices, ${activitySeed.length} activities, ${automationRows.length} automations.`
);
