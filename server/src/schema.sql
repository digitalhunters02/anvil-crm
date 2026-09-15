-- Anvil schema
-- Vanguard Fabrication Works — Gary, IN
-- RFQ -> Quote -> Bill of Materials -> Purchase Orders -> Work Orders -> Quality Inspection -> Shipment -> Invoice

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  initials TEXT NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  owner_user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS rfqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  title TEXT NOT NULL,
  description TEXT,
  target_price REAL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL,
  owner_user_id INTEGER NOT NULL REFERENCES users(id),
  received_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rfq_id INTEGER REFERENCES rfqs(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  quote_number TEXT NOT NULL,
  total_amount REAL NOT NULL,
  status TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  owner_user_id INTEGER NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS bill_of_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL REFERENCES quotes(id),
  part_name TEXT NOT NULL,
  material TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_of_measure TEXT NOT NULL,
  unit_cost REAL NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  lead_time_days INTEGER NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  po_number TEXT NOT NULL,
  status TEXT NOT NULL,
  total_amount REAL NOT NULL,
  order_date TEXT NOT NULL,
  expected_date TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS work_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER REFERENCES quotes(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  work_order_number TEXT NOT NULL,
  status TEXT NOT NULL,
  owner_user_id INTEGER NOT NULL REFERENCES users(id),
  start_date TEXT,
  due_date TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS quality_inspections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
  inspector_user_id INTEGER NOT NULL REFERENCES users(id),
  inspection_date TEXT NOT NULL,
  result TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  ship_date TEXT,
  carrier TEXT NOT NULL,
  tracking_number TEXT,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  invoice_number TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  related_type TEXT,
  related_id INTEGER,
  owner_user_id INTEGER NOT NULL REFERENCES users(id),
  occurred_at TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS automations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  trigger_desc TEXT NOT NULL,
  action_desc TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  runs_30d INTEGER NOT NULL DEFAULT 0
);
