-- Anvil schema
-- Vanguard Fabrication Works — Gary, IN
-- RFQ -> Quote -> Bill of Materials -> Purchase Orders -> Work Orders -> Quality Inspection -> Shipment -> Invoice

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  initials TEXT NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
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
  id SERIAL PRIMARY KEY,
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
  id SERIAL PRIMARY KEY,
  rfq_id INTEGER REFERENCES rfqs(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  quote_number TEXT NOT NULL,
  total_amount REAL NOT NULL,
  status TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  owner_user_id INTEGER NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS bill_of_materials (
  id SERIAL PRIMARY KEY,
  quote_id INTEGER NOT NULL REFERENCES quotes(id),
  part_name TEXT NOT NULL,
  material TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_of_measure TEXT NOT NULL,
  unit_cost REAL NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  lead_time_days INTEGER NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  po_number TEXT NOT NULL,
  status TEXT NOT NULL,
  total_amount REAL NOT NULL,
  order_date TEXT NOT NULL,
  expected_date TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS work_orders (
  id SERIAL PRIMARY KEY,
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
  id SERIAL PRIMARY KEY,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
  inspector_user_id INTEGER NOT NULL REFERENCES users(id),
  inspection_date TEXT NOT NULL,
  result TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS shipments (
  id SERIAL PRIMARY KEY,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  ship_date TEXT,
  carrier TEXT NOT NULL,
  tracking_number TEXT,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  invoice_number TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  related_type TEXT,
  related_id INTEGER,
  owner_user_id INTEGER NOT NULL REFERENCES users(id),
  occurred_at TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS automations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_desc TEXT NOT NULL,
  action_desc TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  runs_30d INTEGER NOT NULL DEFAULT 0
);

-- A single shared WhatsApp Business number for the whole company — one row,
-- id is always 1.
CREATE TABLE IF NOT EXISTS whatsapp_connection (
  id INTEGER PRIMARY KEY DEFAULT 1,
  phone_number_id TEXT NOT NULL,
  business_account_id TEXT,
  access_token TEXT NOT NULL,
  verify_token TEXT,
  display_phone TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_connection_single_row CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id TEXT PRIMARY KEY,
  wa_message_id TEXT UNIQUE,
  contact_phone TEXT NOT NULL,
  direction TEXT NOT NULL,
  body TEXT,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_contact ON whatsapp_messages (contact_phone, created_at);

-- Login accounts (separate from "users", which are the shop staff
-- assigned to RFQs, work orders, etc.). Owner / staff roles; bcrypt password hashes.
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  token_version INTEGER NOT NULL DEFAULT 0,
  reset_token_hash TEXT,
  reset_token_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_lower_idx ON accounts (lower(email));
CREATE INDEX IF NOT EXISTS accounts_reset_token_idx ON accounts (reset_token_hash);

-- Plano e assinatura desta instalação (uma linha só): ver billing.js
CREATE TABLE IF NOT EXISTS subscription (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  plan TEXT NOT NULL DEFAULT 'basico',
  status TEXT NOT NULL DEFAULT 'active',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recursos pro (Essencial/Completo): estoque com lote e código de barras, compra do que falta, custeio, agenda de produção
CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  material TEXT NOT NULL DEFAULT '',
  uom TEXT NOT NULL DEFAULT 'ea',
  min_stock REAL NOT NULL DEFAULT 0,
  unit_cost REAL NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT '',
  barcode TEXT,
  tracking TEXT NOT NULL DEFAULT 'none',
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_sku_uq ON inventory_items (lower(sku));
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_barcode_uq ON inventory_items (lower(barcode)) WHERE barcode IS NOT NULL AND barcode <> '';

CREATE TABLE IF NOT EXISTS stock_moves (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  qty REAL NOT NULL,
  reason TEXT NOT NULL,
  lot TEXT,
  work_order_id INTEGER REFERENCES work_orders(id) ON DELETE SET NULL,
  unit_cost REAL NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_moves_item_idx ON stock_moves (item_id);

CREATE TABLE IF NOT EXISTS work_order_labor (
  id SERIAL PRIMARY KEY,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  work_date TEXT NOT NULL,
  hours REAL NOT NULL,
  rate REAL NOT NULL,
  note TEXT
);
