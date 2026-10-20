// previewPlan.js
// PARA QUE SERVE: o trecho do login (requireAuth) que lê o cabeçalho X-Preview-Plan e o aplica SÓ para o dono da plataforma
// (e-mail em OWNER_EMAILS). Para qualquer outra conta o cabeçalho é ignorado. Também traz `blockInPreview`, que recusa
// (409) ações que mexem em plano/cobrança enquanto o dono está olhando como outro plano.
// (Cópia adaptada do kit de selo de plano do Rex: lib/previewPlan.js.)
import { store, previewPlans, isOwnerEmail } from './owner.js';

export function applyPreview(req, account, next) {
  const want = String(req.headers['x-preview-plan'] || '').trim().toLowerCase();
  if (want && previewPlans().includes(want) && isOwnerEmail(account?.email)) {
    req.previewPlan = want;
    return store.run({ accountId: account.id, plan: want }, next);
  }
  return next();
}

export function blockInPreview(req, res, next) {
  if (req.previewPlan) {
    return res.status(409).json({
      error: 'You are viewing another plan. Go back to your plan to change the subscription or payments.',
      code: 'preview_readonly',
    });
  }
  return next();
}
