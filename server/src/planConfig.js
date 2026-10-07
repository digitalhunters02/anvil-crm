// Planos de Anvil: preços, limites e o que cada plano libera. Chaves de plano seguem o portfólio
// (basico / essencial / completo); os nomes na tela são os de PLAN_LABELS.
export const PRODUCT = { key: 'anvil', name: 'Anvil' };
export const PLAN_RANK = { basico: 1, essencial: 2, completo: 3 };
export const PLAN_LABELS = { basico: 'Essential', essencial: 'Professional', completo: 'Complete' };
// US$ por mês (o anual é 10% abaixo de 12 mensalidades).
export const PLAN_PRICES = { basico: 59, essencial: 129, completo: 249 };
// Logins de equipe por plano. "Completo ilimitado" ainda será discutido: PLAN_COMPLETO_USER_LIMIT põe um teto.
const cap = Number(process.env.PLAN_COMPLETO_USER_LIMIT);
export const PLAN_USER_LIMITS = { basico: 3, essencial: 10, completo: cap > 0 ? cap : Infinity };
// Limites extras por tipo de registro (ex.: alunos).
export const PLAN_EXTRA_LIMITS = {};
// Recurso → menor plano que o libera (tudo que não está aqui vale para todos os planos).
export const FEATURE_MIN_PLAN = {
  rfqs: 'essencial',
  purchase_orders: 'essencial',
  bill_of_materials: 'essencial',
  work_orders: 'essencial',
  shipments: 'essencial',
  reports: 'essencial',
  inventory: 'essencial',
  mrp: 'completo',
  job_costing: 'completo',
  production_calendar: 'completo',
  quality_inspections: 'completo',
  automations: 'completo',
  whatsapp: 'completo',
};
// Rotas da API protegidas por plano: [prefixo, recurso]. Valem só depois do login.
export const API_GATES = [
  ['/api/inventory', 'inventory'],
  ['/api/mrp', 'mrp'],
  ['/api/costing', 'job_costing'],
  ['/api/calendar', 'production_calendar'],
  ['/api/rfqs', 'rfqs'],
  ['/api/purchase-orders', 'purchase_orders'],
  ['/api/bill-of-materials', 'bill_of_materials'],
  ['/api/work-orders', 'work_orders'],
  ['/api/shipments', 'shipments'],
  ['/api/reports', 'reports'],
  ['/api/quality-inspections', 'quality_inspections'],
  ['/api/automations', 'automations'],
  ['/api/integrations/whatsapp', 'whatsapp'],
];
