// Rotas de plano e cobrança. O webhook do Stripe é público (vai antes do login) e usa o corpo cru guardado em req.rawBody.
import * as billing from './billing.js';
import { blockInPreview } from './previewPlan.js';
import { isOwnerEmail, store } from './owner.js';

const frontendBaseUrl = () => (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/+$/, '');

export function mountBillingWebhook(app, ar) {
  // Catálogo público (sem login): mesmo mapa do app logado, sem `locked`.
  app.get('/api/public/plans', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ catalog: billing.publicCatalog(), gates: billing.publicGates() });
  });
  app.post('/api/billing/webhook', ar(async (req, res) => {
    try {
      await billing.handleWebhook(req.rawBody, req.headers['stripe-signature']);
      res.sendStatus(200);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }));
}

// Depois do login: status do plano para qualquer conta; escolher plano e gerenciar assinatura só o dono.
export function mountBilling(app, ar, requireOwner) {
  // Plano em vigor (o da prévia, se o dono da plataforma estiver olhando como outro plano) + mapa recurso -> plano mínimo + catálogo.
  app.get('/api/billing/status', ar(async (req, res) => {
    const realPlan = await store.exit(() => billing.effectivePlan()); // plano de verdade: nunca muda pela prévia
    res.json({ ...(await billing.status()), owner: isOwnerEmail(req.account?.email), previewPlan: req.previewPlan || null, realPlan });
  }));
  app.post('/api/billing/checkout', requireOwner, blockInPreview, ar(async (req, res) => {
    try {
      res.json({ url: await billing.createCheckoutSession(String(req.body?.plan || ''), { frontendBaseUrl: frontendBaseUrl(), interval: req.body?.interval }) });
    } catch (e) { res.status(400).json({ error: e.message }); }
  }));
  app.post('/api/billing/portal', requireOwner, blockInPreview, ar(async (_req, res) => {
    try { res.json({ url: await billing.createPortalSession({ frontendBaseUrl: frontendBaseUrl() }) }); }
    catch (e) { res.status(400).json({ error: e.message }); }
  }));
}
