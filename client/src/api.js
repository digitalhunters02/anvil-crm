// In local dev, "/api" is proxied to the local server (see vite.config.js).
// In production there's no such proxy, so VITE_API_URL must point at the
// deployed backend's base URL (e.g. https://anvil-crm-api.onrender.com).
export const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

async function handle(r) {
  if (r.status === 204) return null;
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error((data && data.error) || `Request failed (${r.status})`);
    err.status = r.status;
    err.body = data;
    throw err;
  }
  return data;
}

function get(path) {
  return fetch(BASE + path).then(handle);
}

function post(path, body) {
  return fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(handle);
}

function put(path, body) {
  return fetch(BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(handle);
}

function patch(path, body) {
  return fetch(BASE + path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(handle);
}

function del(path) {
  return fetch(BASE + path, { method: 'DELETE' }).then(handle);
}

export const api = {
  dashboard: () => get('/dashboard'),
  reports: () => get('/reports'),

  users: () => get('/users'),
  createUser: (body) => post('/users', body),
  updateUser: (id, body) => put(`/users/${id}`, body),
  deleteUser: (id) => del(`/users/${id}`),

  customers: () => get('/customers'),
  createCustomer: (body) => post('/customers', body),
  updateCustomer: (id, body) => put(`/customers/${id}`, body),
  deleteCustomer: (id) => del(`/customers/${id}`),

  rfqs: () => get('/rfqs'),
  createRfq: (body) => post('/rfqs', body),
  updateRfq: (id, body) => put(`/rfqs/${id}`, body),
  deleteRfq: (id) => del(`/rfqs/${id}`),

  quotes: () => get('/quotes'),
  createQuote: (body) => post('/quotes', body),
  updateQuote: (id, body) => put(`/quotes/${id}`, body),
  deleteQuote: (id) => del(`/quotes/${id}`),

  bom: () => get('/bill-of-materials'),
  createBom: (body) => post('/bill-of-materials', body),
  updateBom: (id, body) => put(`/bill-of-materials/${id}`, body),
  deleteBom: (id) => del(`/bill-of-materials/${id}`),

  suppliers: () => get('/suppliers'),
  createSupplier: (body) => post('/suppliers', body),
  updateSupplier: (id, body) => put(`/suppliers/${id}`, body),
  deleteSupplier: (id) => del(`/suppliers/${id}`),

  purchaseOrders: () => get('/purchase-orders'),
  createPurchaseOrder: (body) => post('/purchase-orders', body),
  updatePurchaseOrder: (id, body) => put(`/purchase-orders/${id}`, body),
  deletePurchaseOrder: (id) => del(`/purchase-orders/${id}`),

  workOrders: () => get('/work-orders'),
  createWorkOrder: (body) => post('/work-orders', body),
  updateWorkOrder: (id, body) => put(`/work-orders/${id}`, body),
  deleteWorkOrder: (id) => del(`/work-orders/${id}`),

  qualityInspections: () => get('/quality-inspections'),
  createQualityInspection: (body) => post('/quality-inspections', body),
  updateQualityInspection: (id, body) => put(`/quality-inspections/${id}`, body),
  deleteQualityInspection: (id) => del(`/quality-inspections/${id}`),

  shipments: () => get('/shipments'),
  createShipment: (body) => post('/shipments', body),
  updateShipment: (id, body) => put(`/shipments/${id}`, body),
  deleteShipment: (id) => del(`/shipments/${id}`),

  invoices: () => get('/invoices'),
  createInvoice: (body) => post('/invoices', body),
  updateInvoice: (id, body) => put(`/invoices/${id}`, body),
  deleteInvoice: (id) => del(`/invoices/${id}`),

  activities: () => get('/activities'),

  automations: () => get('/automations'),
  createAutomation: (body) => post('/automations', body),
  setAutomationActive: (id, active) => patch(`/automations/${id}/active`, { active }),
  deleteAutomation: (id) => del(`/automations/${id}`),

  whatsappStatus: () => get('/integrations/whatsapp/status'),
  whatsappConnect: (body) => post('/integrations/whatsapp/connect', body),
  whatsappDisconnect: () => post('/integrations/whatsapp/disconnect', {}),
  whatsappConversations: () => get('/integrations/whatsapp/conversations'),
  whatsappConversation: (phone) => get(`/integrations/whatsapp/conversations/${encodeURIComponent(phone)}`),
  whatsappSend: (to, text) => post('/integrations/whatsapp/send', { to, text }),
};

export default api;
