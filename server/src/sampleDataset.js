// sampleDataset.js
// PARA QUE SERVE: o CONTEÚDO dos dados de exemplo do Anvil (uma metalúrgica de estruturas soldadas, tudo FICTÍCIO):
// funcionários, clientes, cotações (RFQ), orçamentos, lista de materiais, fornecedores, pedidos de compra, ordens de serviço,
// inspeções de qualidade, remessas, faturas, atividades, automações, estoque com lotes, movimentos de estoque e horas de mão de obra.
// Quem GRAVA e REMOVE esses dados é sampleData.js; aqui só há dados puros, sem banco.
//
// Regras do conteúdo: nomes e empresas inventados; e-mails em example.test; telefones 555-01xx; valores em US$;
// TODAS as datas são relativas ao dia em que o dataset é montado (hoje), para as telas nunca ficarem "velhas".
// Os registros se ligam por chaves curtas (k: 'c1', 'wo3'...), nunca por número de banco; o carregador troca pelas ids reais.

const DAY = 864e5;

export function buildSampleDataset(today = new Date()) {
  const base = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const day = (n) => iso(base + n * DAY); // n dias a partir de hoje (negativo = passado)
  const monthStart = iso(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const thisMonth = (back) => (day(-back) < monthStart ? monthStart : day(-back)); // nunca antes do dia 1 (cartão "Receita do mês")
  const at = (n, hh, mm) => `${day(n)}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;

  const users = [
    { k: 'ops', name: 'Marcus Hale', email: 'marcus.hale@example.test', role: 'VP of Operations', initials: 'MH', color: '#8a1f18' },
    { k: 'sales1', name: 'Elena Voss', email: 'elena.voss@example.test', role: 'Sales Engineer', initials: 'EV', color: '#1d5c8a' },
    { k: 'foreman', name: 'Tomas Brandt', email: 'tomas.brandt@example.test', role: 'Shop Foreman', initials: 'TB', color: '#57621f' },
    { k: 'quality', name: 'Nadia Okoye', email: 'nadia.okoye@example.test', role: 'Quality Manager', initials: 'NO', color: '#6a4a8a' },
    { k: 'purch', name: 'Colin Reyes', email: 'colin.reyes@example.test', role: 'Purchasing Agent', initials: 'CR', color: '#8a6a1a' },
    { k: 'sales2', name: 'Priya Lindqvist', email: 'priya.lindqvist@example.test', role: 'Sales Engineer', initials: 'PL', color: '#1d5c8a' },
  ];

  const customers = [
    { k: 'c1', name: 'Ridgeline Bridge & Steel', industry: 'Construction', address: '1180 Mill St', city: 'Gary', state: 'IN', contact_name: 'Hannah Corwin', contact_email: 'hannah.corwin@example.test', contact_phone: '(219) 555-0118', owner: 'sales1', status: 'Active', notes: 'Repeat customer for bridge girders; pays net 30.' },
    { k: 'c2', name: 'Prairie Crest Grain Systems', industry: 'Agriculture', address: '600 Silo Rd', city: 'Valparaiso', state: 'IN', contact_name: 'Owen Baxter', contact_email: 'owen.baxter@example.test', contact_phone: '(219) 555-0142', owner: 'sales2', status: 'Active', notes: 'Seasonal: orders spike before harvest.' },
    { k: 'c3', name: 'Ironvale Rail Components', industry: 'Rail', address: '2200 Foundry Ave', city: 'Hammond', state: 'IN', contact_name: 'Renata Cho', contact_email: 'renata.cho@example.test', contact_phone: '(219) 555-0177', owner: 'sales1', status: 'Active', notes: 'Certified welding documentation required on every shipment.' },
    { k: 'c4', name: 'Basin Ridge Energy Services', industry: 'Oil & Gas', address: '4410 W County Rd 120', city: 'Odessa', state: 'TX', contact_name: 'Hollis Vance', contact_email: 'hollis.vance@example.test', contact_phone: '(432) 555-0193', owner: 'sales2', status: 'Active', notes: 'Prototype work first, production runs later.' },
    { k: 'c5', name: 'Summit Lift Material Handling', industry: 'Industrial Equipment', address: '7750 Broadway', city: 'Merrillville', state: 'IN', contact_name: 'Priya Nandan', contact_email: 'priya.nandan@example.test', contact_phone: '(219) 555-0164', owner: 'sales1', status: 'Active', notes: 'Prefers weekly status updates by email.' },
    { k: 'c6', name: 'Northern Pit Mining Supply', industry: 'Mining', address: '900 Lake Ave', city: 'Duluth', state: 'MN', contact_name: 'Dale Odom', contact_email: 'dale.odom@example.test', contact_phone: '(218) 555-0129', owner: 'sales2', status: 'Active', notes: 'Wear-plate kits; very price sensitive.' },
    { k: 'c7', name: 'Lakefront Energy Structures', industry: 'Energy', address: '3100 Chester Ave', city: 'Cleveland', state: 'OH', contact_name: 'Faye Lindahl', contact_email: 'faye.lindahl@example.test', contact_phone: '(216) 555-0155', owner: 'sales1', status: 'Active', notes: 'Large frames; needs crane-ready packing.' },
    { k: 'c8', name: 'Cedar Point Defense Fabrication', industry: 'Defense', address: '5200 Redstone Rd', city: 'Huntsville', state: 'AL', contact_name: 'Miles Strand', contact_email: 'miles.strand@example.test', contact_phone: '(256) 555-0187', owner: 'sales2', status: 'Prospect', notes: 'First program under evaluation; documentation heavy.' },
    { k: 'c9', name: 'Harbor Light Marine Works', industry: 'Marine', address: '14 Pier Rd', city: 'Michigan City', state: 'IN', contact_name: 'Gwen Ashby', contact_email: 'gwen.ashby@example.test', contact_phone: '(219) 555-0121', owner: 'sales1', status: 'Inactive', notes: 'No orders since the dock project closed.' },
  ];

  const rfqs = [
    { k: 'r1', c: 'c1', title: 'Bridge Deck Girder Assembly — Lot 14', description: 'Welded A36 plate girders, 6 units, shot-blast finish.', target_price: 118000, received: day(-62), due: day(-45), status: 'Won', owner: 'sales1' },
    { k: 'r2', c: 'c1', title: 'Pedestrian Overpass Truss Repair Kit', description: 'Field-repair truss segments for an existing structure.', target_price: 42000, received: day(-3), due: day(11), status: 'New', owner: 'sales1' },
    { k: 'r3', c: 'c2', title: 'Grain Elevator Catwalk & Handrail Package', description: 'Galvanized catwalk sections, 180 linear ft.', target_price: 76000, received: day(-44), due: day(-30), status: 'Won', owner: 'sales2' },
    { k: 'r4', c: 'c2', title: 'Silo Support Leg Reinforcement', description: 'Retrofit reinforcement gussets for six silo legs.', target_price: 31000, received: day(-2), due: day(14), status: 'New', owner: 'sales2' },
    { k: 'r5', c: 'c3', title: 'Welded Frame Assembly — Rev D', description: 'Rail car frame assemblies, certified welding procedure.', target_price: 214000, received: day(-38), due: day(-24), status: 'Won', owner: 'sales1' },
    { k: 'r6', c: 'c4', title: 'Wellhead Skid Frame — Prototype', description: 'First-article skid frame, 304 stainless fasteners.', target_price: 58000, received: day(-20), due: day(5), status: 'Quoted', owner: 'sales2' },
    { k: 'r7', c: 'c5', title: 'Conveyor Support Structure — Line 3', description: 'Structural steel support towers for a new conveyor line.', target_price: 96000, received: day(-40), due: day(-27), status: 'Won', owner: 'sales1' },
    { k: 'r8', c: 'c5', title: 'Custom Hopper, 40 cu ft', description: 'Stainless-lined carbon steel hopper with vibration isolators.', target_price: 27500, received: day(-12), due: day(9), status: 'Quoted', owner: 'sales1' },
    { k: 'r9', c: 'c6', title: 'Dragline Bucket Reinforcement Plates', description: 'AR400 wear plate kits for dragline buckets.', target_price: 39000, received: day(-55), due: day(-36), status: 'Lost', owner: 'sales2' },
    { k: 'r10', c: 'c7', title: 'Turbine Base Frame — 2.5MW', description: 'Heavy weldment base frame, precision-machined mounting faces.', target_price: 168000, received: day(-30), due: day(-14), status: 'Won', owner: 'sales1' },
    { k: 'r11', c: 'c7', title: 'Transformer Enclosure Panels', description: 'Louvered enclosure panels, powder coat finish.', target_price: 44500, received: day(-1), due: day(18), status: 'New', owner: 'sales1' },
    { k: 'r12', c: 'c8', title: 'Ruggedized Equipment Rack Frames', description: 'Program frames, MIL-SPEC welding documentation required.', target_price: 87000, received: day(-4), due: day(12), status: 'New', owner: 'sales2' },
    { k: 'r13', c: 'c3', title: 'Brake Beam Bracket Run — 400 units', description: 'Repeat bracket order with updated drawing revision.', target_price: 52000, received: day(-9), due: day(7), status: 'Quoted', owner: 'sales1' },
  ];

  const quotes = [
    { k: 'q1', rfq: 'r1', c: 'c1', number: 'Q-3101', total: 119400, status: 'Accepted', valid: day(-30), owner: 'sales1' },
    { k: 'q2', rfq: 'r3', c: 'c2', number: 'Q-3102', total: 77520, status: 'Accepted', valid: day(-18), owner: 'sales2' },
    { k: 'q3', rfq: 'r5', c: 'c3', number: 'Q-3103', total: 218500, status: 'Accepted', valid: day(-12), owner: 'sales1' },
    { k: 'q4', rfq: 'r7', c: 'c5', number: 'Q-3104', total: 98300, status: 'Accepted', valid: day(-15), owner: 'sales1' },
    { k: 'q5', rfq: 'r10', c: 'c7', number: 'Q-3105', total: 171800, status: 'Accepted', valid: day(-2), owner: 'sales1' },
    { k: 'q6', rfq: 'r6', c: 'c4', number: 'Q-3106', total: 59700, status: 'Sent', valid: day(16), owner: 'sales2' },
    { k: 'q7', rfq: 'r8', c: 'c5', number: 'Q-3107', total: 28450, status: 'Sent', valid: day(20), owner: 'sales1' },
    { k: 'q8', rfq: 'r13', c: 'c3', number: 'Q-3108', total: 53900, status: 'Sent', valid: day(23), owner: 'sales1' },
    { k: 'q9', rfq: 'r9', c: 'c6', number: 'Q-3109', total: 40200, status: 'Rejected', valid: day(-20), owner: 'sales2' },
    { k: 'q10', rfq: null, c: 'c4', number: 'Q-3110', total: 21800, status: 'Draft', valid: day(30), owner: 'sales2' },
    { k: 'q11', rfq: null, c: 'c1', number: 'Q-3111', total: 16400, status: 'Expired', valid: day(-8), owner: 'sales1' },
  ];

  // material = nome de um item do estoque (assim a tela "Comprar o que falta" casa a lista de materiais com o estoque)
  const bom = [
    { q: 'q1', part_name: 'Girder web plate, 1/2in', material: 'A36 Steel Plate', quantity: 18, uom: 'sheet', unit_cost: 148, notes: 'Primary structural component' },
    { q: 'q1', part_name: 'Girder flange beam W8x18', material: 'A992 Structural Steel', quantity: 240, uom: 'ft', unit_cost: 31.5, notes: null },
    { q: 'q1', part_name: 'Grade 8 hex bolt kit', material: 'Zinc-Plated Fasteners', quantity: 40, uom: 'kit', unit_cost: 36.5, notes: null },
    { q: 'q2', part_name: 'Catwalk angle frame 3x3x1/4', material: 'Galvanized Steel Angle', quantity: 420, uom: 'ft', unit_cost: 9.75, notes: 'Hot-dip galvanized after welding' },
    { q: 'q2', part_name: 'Handrail posts', material: '304 Stainless Tube', quantity: 160, uom: 'ft', unit_cost: 14.8, notes: null },
    { q: 'q2', part_name: 'Welding wire ER70S-6', material: 'Welding Consumable', quantity: 10, uom: 'spool', unit_cost: 58, notes: null },
    { q: 'q3', part_name: 'Frame side plate 3/4in', material: 'A36 Steel Plate', quantity: 30, uom: 'sheet', unit_cost: 148, notes: 'Primary structural component' },
    { q: 'q3', part_name: 'Cross member beam', material: 'A992 Structural Steel', quantity: 360, uom: 'ft', unit_cost: 31.5, notes: null },
    { q: 'q3', part_name: 'Shielding gas 75/25', material: 'Shielding Gas 75/25', quantity: 6, uom: 'cylinder', unit_cost: 62, notes: null },
    { q: 'q3', part_name: 'Welding wire ER70S-6', material: 'Welding Consumable', quantity: 14, uom: 'spool', unit_cost: 58, notes: null },
    { q: 'q4', part_name: 'Tower leg beam W8x18', material: 'A992 Structural Steel', quantity: 300, uom: 'ft', unit_cost: 31.5, notes: null },
    { q: 'q4', part_name: 'Base plate 1/2in', material: 'A36 Steel Plate', quantity: 12, uom: 'sheet', unit_cost: 148, notes: null },
    { q: 'q4', part_name: 'Conveyor guide rollers', material: 'Roller Assembly', quantity: 24, uom: 'ea', unit_cost: 38, notes: 'Bought out; not stocked' },
    { q: 'q4', part_name: 'Powder coat finish, gray RAL7024', material: 'Powder Coat Finish', quantity: 520, uom: 'sqft', unit_cost: 1.85, notes: null },
    { q: 'q5', part_name: 'Base frame plate 1in', material: 'A36 Steel Plate', quantity: 26, uom: 'sheet', unit_cost: 148, notes: 'Machined mounting faces' },
    { q: 'q5', part_name: 'Stiffener beams', material: 'A992 Structural Steel', quantity: 280, uom: 'ft', unit_cost: 31.5, notes: null },
    { q: 'q5', part_name: 'Grade 8 hex bolt kit', material: 'Zinc-Plated Fasteners', quantity: 28, uom: 'kit', unit_cost: 36.5, notes: null },
    { q: 'q6', part_name: 'Skid frame tube', material: '304 Stainless Tube', quantity: 220, uom: 'ft', unit_cost: 14.8, notes: null },
    { q: 'q6', part_name: 'Skid deck plate', material: 'A36 Steel Plate', quantity: 8, uom: 'sheet', unit_cost: 148, notes: null },
    { q: 'q7', part_name: 'Hopper liner plate', material: 'AR400 Abrasion-Resistant Plate', quantity: 4, uom: 'sheet', unit_cost: 412, notes: null },
    { q: 'q7', part_name: 'Vibration isolators', material: 'Rubber Vibration Isolator', quantity: 8, uom: 'ea', unit_cost: 24, notes: 'Bought out' },
    { q: 'q8', part_name: 'Bracket blank 1/4in', material: 'A36 Steel Plate', quantity: 14, uom: 'sheet', unit_cost: 148, notes: null },
    { q: 'q9', part_name: 'Wear plate kit', material: 'AR400 Abrasion-Resistant Plate', quantity: 6, uom: 'sheet', unit_cost: 412, notes: null },
    { q: 'q10', part_name: 'Skid fasteners', material: 'Zinc-Plated Fasteners', quantity: 12, uom: 'kit', unit_cost: 36.5, notes: null },
    { q: 'q11', part_name: 'Truss gusset plate', material: 'A36 Steel Plate', quantity: 5, uom: 'sheet', unit_cost: 148, notes: null },
  ];

  const suppliers = [
    { k: 's1', name: 'Midland Steel Supply', specialty: 'Steel Plate & Bar', contact_name: 'Nora Fielding', contact_email: 'nora.fielding@example.test', contact_phone: '(219) 555-0110', lead_time_days: 10, notes: 'Primary plate and bar vendor; holds safety stock for us.' },
    { k: 's2', name: 'Lakeview Tube & Pipe', specialty: 'Tube & Pipe Stock', contact_name: 'Aiden Whitlock', contact_email: 'aiden.whitlock@example.test', contact_phone: '(219) 555-0134', lead_time_days: 14, notes: 'Stainless and carbon tube, cut-to-length service.' },
    { k: 's3', name: 'Anchor Fastener Co.', specialty: 'Fasteners & Hardware', contact_name: 'Bianca Soto', contact_email: 'bianca.soto@example.test', contact_phone: '(312) 555-0161', lead_time_days: 5, notes: 'Grade 8 and stainless kits, quick turnaround.' },
    { k: 's4', name: 'Bluestone Coatings', specialty: 'Coatings & Finishing', contact_name: 'Trent Adeyemi', contact_email: 'trent.adeyemi@example.test', contact_phone: '(219) 555-0188', lead_time_days: 7, notes: 'Powder coat and galvanizing subcontractor.' },
    { k: 's5', name: 'Pinnacle Welding Supply', specialty: 'Welding Consumables & Gas', contact_name: 'Yvonne Prewitt', contact_email: 'yvonne.prewitt@example.test', contact_phone: '(219) 555-0105', lead_time_days: 4, notes: 'Shielding gas, wire and rod; weekly delivery route.' },
    { k: 's6', name: 'Cornerstone Alloys', specialty: 'Specialty & Stainless Alloys', contact_name: 'Callum Breck', contact_email: 'callum.breck@example.test', contact_phone: '(713) 555-0127', lead_time_days: 21, notes: 'Longer lead times, but the only regional source for AR plate.' },
  ];

  const purchaseOrders = [
    { s: 's1', po: 'PO-4101', status: 'Received', total: 18450, order: day(-60), expected: day(-50), notes: 'A36 plate stock for the girder run.' },
    { s: 's1', po: 'PO-4102', status: 'Confirmed', total: 12200, order: day(-6), expected: day(4), notes: 'Restock W8x18 beam for the conveyor job.' },
    { s: 's2', po: 'PO-4103', status: 'Sent', total: 9400, order: day(-4), expected: day(10), notes: '304 stainless tube for the wellhead skid prototype.' },
    { s: 's3', po: 'PO-4104', status: 'Received', total: 4300, order: day(-40), expected: day(-34), notes: 'Grade 8 fastener kits, rush order.' },
    { s: 's4', po: 'PO-4105', status: 'Confirmed', total: 6800, order: day(-8), expected: day(6), notes: 'Powder coat run for enclosure panels.' },
    { s: 's5', po: 'PO-4106', status: 'Draft', total: 2100, order: day(-1), expected: null, notes: 'Monthly welding wire and gas replenishment.' },
    { s: 's6', po: 'PO-4107', status: 'Sent', total: 15600, order: day(-14), expected: day(-2), notes: 'AR400 wear plate; delivery is late — follow up with supplier.' },
    { s: 's1', po: 'PO-4108', status: 'Received', total: 21750, order: day(-52), expected: day(-44), notes: 'Galvanized angle for the grain elevator catwalk.' },
    { s: 's2', po: 'PO-4109', status: 'Cancelled', total: 5200, order: day(-45), expected: day(-31), notes: 'Duplicate order, cancelled after inventory count.' },
  ];

  const workOrders = [
    { k: 'wo1', q: 'q1', c: 'c1', number: 'WO-5101', status: 'Completed', owner: 'foreman', start: day(-50), due: day(-22), notes: null },
    { k: 'wo2', q: 'q2', c: 'c2', number: 'WO-5102', status: 'Ready to Ship', owner: 'foreman', start: day(-30), due: day(2), notes: 'Packed and waiting for the carrier pickup.' },
    { k: 'wo3', q: 'q3', c: 'c3', number: 'WO-5103', status: 'In Welding', owner: 'foreman', start: day(-16), due: day(9), notes: 'Welding cell 2, certified procedure on file.' },
    { k: 'wo4', q: 'q4', c: 'c5', number: 'WO-5104', status: 'Quality Inspection', owner: 'foreman', start: day(-20), due: day(3), notes: 'Re-inspection after rework.' },
    { k: 'wo5', q: 'q5', c: 'c7', number: 'WO-5105', status: 'In Fabrication', owner: 'foreman', start: day(-9), due: day(16), notes: null },
    { k: 'wo6', q: null, c: 'c1', number: 'WO-5201', status: 'Completed', owner: 'foreman', start: day(-75), due: day(-52), notes: 'Repeat girder run for the adjacent span.' },
    { k: 'wo7', q: null, c: 'c3', number: 'WO-5202', status: 'Ready to Ship', owner: 'foreman', start: day(-28), due: day(1), notes: 'Second batch of frame assemblies.' },
    { k: 'wo8', q: null, c: 'c5', number: 'WO-5203', status: 'In Fabrication', owner: 'foreman', start: day(-6), due: day(12), notes: 'Line 4 conveyor support towers.' },
    { k: 'wo9', q: null, c: 'c4', number: 'WO-5204', status: 'In Welding', owner: 'foreman', start: day(-12), due: day(-3), notes: 'Wellhead skid prototype. Running late.' },
    { k: 'wo10', q: null, c: 'c2', number: 'WO-5205', status: 'Queued', owner: 'foreman', start: null, due: day(20), notes: 'Waiting for shop capacity.' },
    { k: 'wo11', q: null, c: 'c6', number: 'WO-5206', status: 'On Hold', owner: 'foreman', start: day(-18), due: day(6), notes: 'Waiting on the customer-approved drawing revision.' },
    { k: 'wo12', q: null, c: 'c7', number: 'WO-5207', status: 'Queued', owner: 'foreman', start: day(4), due: day(26), notes: null },
    { k: 'wo13', q: null, c: 'c8', number: 'WO-5208', status: 'Completed', owner: 'foreman', start: day(-40), due: day(-12), notes: 'Pilot rack frames.' },
  ];

  const inspections = [
    { wo: 'wo6', date: day(-54), result: 'Pass', notes: 'Dimensional and weld inspection passed per drawing.' },
    { wo: 'wo1', date: day(-24), result: 'Pass', notes: 'Final visual and dimensional check cleared for shipment.' },
    { wo: 'wo13', date: day(-14), result: 'Pass', notes: 'Documentation package complete; first article approved.' },
    { wo: 'wo3', date: day(-8), result: 'Pass', notes: 'In-process weld check passed at the 50% mark.' },
    { wo: 'wo11', date: day(-9), result: 'Pending Rework', notes: 'Weld undercut flagged; drawing revision requested before continuing.' },
    { wo: 'wo4', date: day(-6), result: 'Fail', notes: 'Machined mounting face out of tolerance on tower base.' },
    { wo: 'wo4', date: day(-3), result: 'Pending Rework', notes: 'Re-machining done; second inspection scheduled.' },
    { wo: 'wo2', date: day(-3), result: 'Pass', notes: 'Galvanizing thickness and handrail height verified.' },
    { wo: 'wo7', date: day(-1), result: 'Pass', notes: 'Final check passed; ready for release.' },
  ];

  const shipments = [
    { wo: 'wo6', ship: day(-53), carrier: 'Old Dominion Freight Line', tracking: 'ODF210004417', status: 'Delivered' },
    { wo: 'wo1', ship: day(-23), carrier: 'Saia LTL', tracking: 'SAI210004552', status: 'Delivered' },
    { wo: 'wo13', ship: day(-10), carrier: 'XPO', tracking: 'XPO210004689', status: 'Delivered' },
    { wo: 'wo7', ship: day(0), carrier: 'Estes Express', tracking: 'EST210004726', status: 'Shipped' },
    { wo: 'wo2', ship: null, carrier: 'YRC Freight', tracking: null, status: 'Preparing' },
  ];

  // amount = null: usa o total do orçamento da ordem (ou o valor informado em fallback)
  const invoices = [
    { wo: 'wo6', number: 'INV-7100', amount: 30000, status: 'Paid', issue: day(-85), due: day(-71) }, // sinal (adiantamento) da mesma ordem
    { wo: 'wo6', number: 'INV-7101', amount: 61800, status: 'Paid', issue: day(-50), due: day(-36) },
    { wo: 'wo1', number: 'INV-7102', amount: null, status: 'Overdue', issue: day(-21), due: day(-7) },
    { wo: 'wo13', number: 'INV-7103', amount: 47200, status: 'Paid', issue: day(-10), due: day(4) },
    { wo: 'wo7', number: 'INV-7104', amount: 83600, status: 'Sent', issue: thisMonth(0), due: day(14) },
    { wo: 'wo2', number: 'INV-7105', amount: null, status: 'Sent', issue: thisMonth(1), due: day(13) },
    { wo: 'wo4', number: 'INV-7106', amount: null, status: 'Draft', issue: thisMonth(0), due: day(14) },
    { wo: 'wo3', number: 'INV-7107', amount: null, status: 'Draft', issue: thisMonth(0), due: day(14) },
    { wo: 'wo8', number: 'INV-7108', amount: 29500, status: 'Draft', issue: thisMonth(0), due: day(14) },
  ];

  const activities = [
    { type: 'Call', subject: 'Reviewed truss repair scope with Ridgeline Bridge & Steel', rel: ['rfq', 'r2'], owner: 'sales1', at: at(-1, 9, 30) },
    { type: 'Email', subject: 'Sent quote Q-3106 to Hollis Vance', rel: ['quote', 'q6'], owner: 'sales2', at: at(-1, 14, 10) },
    { type: 'Task', subject: 'Released the bill of materials for the turbine base frame', rel: ['quote', 'q5'], owner: 'sales1', at: at(-2, 11, 0) },
    { type: 'Meeting', subject: 'Weld inspection walkthrough on the conveyor towers', rel: ['work_order', 'wo4'], owner: 'quality', at: at(-2, 15, 45) },
    { type: 'Call', subject: 'Followed up with Midland Steel Supply on PO-4102', rel: ['purchase_order', null], owner: 'purch', at: at(-3, 10, 15) },
    { type: 'Task', subject: 'Logged the failed mounting-face inspection on WO-5104', rel: ['work_order', 'wo4'], owner: 'quality', at: at(-3, 8, 50) },
    { type: 'Email', subject: 'Sent invoice INV-7104 to Ironvale Rail Components', rel: ['invoice', null], owner: 'ops', at: at(-4, 13, 20) },
    { type: 'Call', subject: 'Chased late AR400 plate delivery with Cornerstone Alloys', rel: ['purchase_order', null], owner: 'purch', at: at(-5, 9, 5) },
    { type: 'Meeting', subject: 'Kickoff call for the wellhead skid prototype', rel: ['rfq', 'r6'], owner: 'sales2', at: at(-6, 16, 0) },
    { type: 'Task', subject: 'Scheduled the carrier pickup for WO-5102', rel: ['work_order', 'wo2'], owner: 'foreman', at: at(-6, 7, 40) },
    { type: 'Email', subject: 'Requested documentation requirements from Cedar Point Defense', rel: ['rfq', 'r12'], owner: 'sales2', at: at(-7, 12, 30) },
    { type: 'Call', subject: 'Escalated the overdue invoice INV-7102 with Ridgeline', rel: ['invoice', null], owner: 'ops', at: at(-8, 11, 15) },
    { type: 'Task', subject: 'Reworked the gusset weld per the quality note', rel: ['work_order', 'wo3'], owner: 'foreman', at: at(-9, 15, 0) },
    { type: 'Meeting', subject: 'Weekly production scheduling review', rel: [null, null], owner: 'ops', at: at(-10, 8, 0) },
  ];

  const automations = [
    { name: 'Overdue PO Alert', trigger_desc: 'Purchase order expected date passes while status is Sent or Confirmed', action_desc: 'Notify the purchasing agent to follow up with the supplier', active: 1, runs_30d: 9 },
    { name: 'Quote Acceptance Notice', trigger_desc: 'Quote status changes to Accepted', action_desc: 'Notify the sales engineer and draft the work order', active: 1, runs_30d: 14 },
    { name: 'Work Order Hold Escalation', trigger_desc: 'Work order stays On Hold for more than 5 days', action_desc: 'Flag the work order and notify the shop foreman', active: 1, runs_30d: 3 },
    { name: 'Shipment Created Notice', trigger_desc: 'New shipment record created for a work order', action_desc: 'Email the customer contact with carrier and tracking number', active: 1, runs_30d: 11 },
    { name: 'Failed Inspection Rework Routing', trigger_desc: 'Quality inspection result set to Fail or Pending Rework', action_desc: 'Send the work order back to the fabrication queue and notify quality', active: 1, runs_30d: 6 },
    { name: 'Invoice Overdue Reminder', trigger_desc: 'Invoice due date passes while status is Sent', action_desc: 'Send a reminder to the customer contact and flag the account owner', active: 0, runs_30d: 0 },
  ];

  // Estoque com lote e código de barras (tracking 'lot' = rastreio de lote para recall)
  const inventory = [
    { k: 'i1', sku: 'STL-A36-050', name: 'A36 Steel Plate', material: 'A36 carbon steel', uom: 'sheet', min_stock: 20, unit_cost: 148, location: 'Rack A1', barcode: '0850012300011', tracking: 'lot' },
    { k: 'i2', sku: 'TUB-304-200', name: '304 Stainless Tube', material: '304 stainless', uom: 'ft', min_stock: 200, unit_cost: 14.8, location: 'Rack B2', barcode: '0850012300028', tracking: 'lot' },
    { k: 'i3', sku: 'BEAM-W8X18', name: 'A992 Structural Steel', material: 'A992 steel', uom: 'ft', min_stock: 120, unit_cost: 31.5, location: 'Yard 1', barcode: '0850012300035', tracking: 'lot' },
    { k: 'i4', sku: 'ANG-GALV-3X3', name: 'Galvanized Steel Angle', material: 'Galvanized steel', uom: 'ft', min_stock: 150, unit_cost: 9.75, location: 'Rack C1', barcode: '0850012300042', tracking: 'none' },
    { k: 'i5', sku: 'AR400-038', name: 'AR400 Abrasion-Resistant Plate', material: 'AR400', uom: 'sheet', min_stock: 8, unit_cost: 412, location: 'Rack A3', barcode: '0850012300059', tracking: 'lot' },
    { k: 'i6', sku: 'FST-G8-KIT', name: 'Zinc-Plated Fasteners', material: 'Grade 8 zinc', uom: 'kit', min_stock: 40, unit_cost: 36.5, location: 'Bin D4', barcode: '0850012300066', tracking: 'none' },
    { k: 'i7', sku: 'WLD-ER70S6', name: 'Welding Consumable', material: 'ER70S-6 wire', uom: 'spool', min_stock: 12, unit_cost: 58, location: 'Weld cage', barcode: '0850012300073', tracking: 'lot' },
    { k: 'i8', sku: 'PC-RAL7024', name: 'Powder Coat Finish', material: 'Gray RAL7024', uom: 'sqft', min_stock: 300, unit_cost: 1.85, location: 'Paint room', barcode: '0850012300080', tracking: 'none' },
    { k: 'i9', sku: 'GAS-ARCO2', name: 'Shielding Gas 75/25', material: 'Argon/CO2', uom: 'cylinder', min_stock: 4, unit_cost: 62, location: 'Gas cage', barcode: '0850012300097', tracking: 'none' },
    { k: 'i10', sku: 'DSC-7IN', name: 'Cut-off Wheel 7in', material: 'Abrasive', uom: 'ea', min_stock: 50, unit_cost: 4.2, location: 'Tool crib', barcode: '0850012300103', tracking: 'none' },
  ];

  // ago = há quantos dias; wo = ordem que recebeu o material (só nas saídas "issue")
  const stockMoves = [
    { item: 'i1', qty: 60, reason: 'receive', lot: 'HT-5531', ago: 60, note: 'PO-4101' },
    { item: 'i1', qty: 40, reason: 'receive', lot: 'HT-5602', ago: 22, note: 'PO-4101 second delivery' },
    { item: 'i1', qty: -24, reason: 'issue', lot: 'HT-5531', wo: 'wo1', ago: 44 },
    { item: 'i1', qty: -16, reason: 'issue', lot: 'HT-5531', wo: 'wo3', ago: 12 },
    { item: 'i1', qty: -20, reason: 'issue', lot: 'HT-5602', wo: 'wo2', ago: 20 },
    { item: 'i1', qty: -12, reason: 'issue', lot: 'HT-5602', wo: 'wo5', ago: 4 },
    { item: 'i2', qty: 600, reason: 'receive', lot: 'LT-2207', ago: 50, note: 'Mill cert on file' },
    { item: 'i2', qty: -180, reason: 'issue', lot: 'LT-2207', wo: 'wo9', ago: 10 },
    { item: 'i2', qty: -90, reason: 'issue', lot: 'LT-2207', wo: 'wo3', ago: 8 },
    { item: 'i3', qty: 480, reason: 'receive', lot: 'BM-9931', ago: 35 },
    { item: 'i3', qty: -160, reason: 'issue', lot: 'BM-9931', wo: 'wo4', ago: 18 },
    { item: 'i3', qty: -120, reason: 'issue', lot: 'BM-9931', wo: 'wo8', ago: 5 },
    { item: 'i4', qty: 400, reason: 'receive', lot: null, ago: 30 },
    { item: 'i4', qty: -210, reason: 'issue', lot: null, wo: 'wo2', ago: 27 },
    { item: 'i4', qty: -60, reason: 'issue', lot: null, wo: 'wo7', ago: 6 },
    { item: 'i5', qty: 20, reason: 'receive', lot: 'AR-7720', ago: 40 },
    { item: 'i5', qty: -14, reason: 'issue', lot: 'AR-7720', wo: 'wo11', ago: 16 },
    { item: 'i6', qty: 130, reason: 'receive', lot: null, ago: 45 },
    { item: 'i6', qty: -52, reason: 'issue', lot: null, wo: 'wo1', ago: 44 },
    { item: 'i6', qty: -30, reason: 'issue', lot: null, wo: 'wo3', ago: 11 },
    { item: 'i7', qty: 36, reason: 'receive', lot: 'WR-4418', ago: 33 },
    { item: 'i7', qty: -14, reason: 'issue', lot: 'WR-4418', wo: 'wo3', ago: 11 },
    { item: 'i7', qty: -13, reason: 'issue', lot: 'WR-4418', wo: 'wo9', ago: 9 },
    { item: 'i8', qty: 900, reason: 'receive', lot: null, ago: 28 },
    { item: 'i8', qty: -240, reason: 'issue', lot: null, wo: 'wo2', ago: 3 },
    { item: 'i9', qty: 12, reason: 'receive', lot: null, ago: 30 },
    { item: 'i9', qty: -5, reason: 'issue', lot: null, wo: 'wo9', ago: 12 },
    { item: 'i9', qty: -3, reason: 'issue', lot: null, wo: 'wo3', ago: 7 },
    { item: 'i10', qty: 200, reason: 'receive', lot: null, ago: 40 },
    { item: 'i10', qty: -166, reason: 'adjust', lot: null, ago: 2, note: 'Shop-floor usage count' },
  ];

  const labor = [
    { wo: 'wo6', ago: 60, hours: 96, rate: 48, note: 'Fit-up and welding' },
    { wo: 'wo1', ago: 42, hours: 112, rate: 48, note: 'Fit-up and welding' },
    { wo: 'wo1', ago: 30, hours: 36, rate: 42, note: 'Shot blast and paint' },
    { wo: 'wo13', ago: 28, hours: 64, rate: 52, note: 'Machining and weld documentation' },
    { wo: 'wo2', ago: 22, hours: 58, rate: 48, note: 'Fabrication' },
    { wo: 'wo2', ago: 8, hours: 20, rate: 42, note: 'Packing and crating' },
    { wo: 'wo3', ago: 10, hours: 74, rate: 52, note: 'Certified welding' },
    { wo: 'wo4', ago: 12, hours: 66, rate: 48, note: 'Fabrication and machining' },
    { wo: 'wo5', ago: 5, hours: 40, rate: 48, note: 'Plate cutting and fit-up' },
    { wo: 'wo9', ago: 6, hours: 52, rate: 52, note: 'Prototype welding' },
  ];

  return { users, customers, rfqs, quotes, bom, suppliers, purchaseOrders, workOrders, inspections, shipments, invoices, activities, automations, inventory, stockMoves, labor };
}
