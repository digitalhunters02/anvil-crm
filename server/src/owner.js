// owner.js
// PARA QUE SERVE: reconhece a(s) conta(s) do DONO da plataforma (variável de servidor OWNER_EMAILS, e-mails separados por vírgula).
// O dono pode VER o Parcel como qualquer plano à venda (cabeçalho X-Preview-Plan) sem mudar a assinatura.
// `store` guarda, durante um pedido em modo "ver como plano", { accountId, plan }; billing.effectivePlan() lê daqui.
// Os planos aceitos na prévia vêm do catálogo do servidor (billing.js, planKeys) — nada de lista repetida.
// (Cópia adaptada do kit de selo de plano do Rex: lib/owner.js.)
import { AsyncLocalStorage } from 'node:async_hooks';
import { planKeys } from './billing.js';

export const store = new AsyncLocalStorage(); // { accountId, plan } durante um pedido em modo "ver como plano"

export const previewPlans = () => planKeys();
export const ownerEmails = () => new Set((process.env.OWNER_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
export const isOwnerEmail = (email) => ownerEmails().has(String(email || '').trim().toLowerCase());
