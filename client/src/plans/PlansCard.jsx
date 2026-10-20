import { useEffect, useState } from 'react';
import api from '../api.js';
import { Card, CardHead, Badge, Button } from '../components/ui.jsx';
import { usePlan } from './PlanContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useT } from '../auth/i18n.js';
import PlanBadge from './PlanBadge.jsx';
import { planStr, planFill, gateText } from './planStrings.js';

// Cartões de plano (mensal / anual -10%) + gerenciar assinatura. Só o dono escolhe plano.
// Só o que NÃO é recurso bloqueável. Os recursos com selo de cada plano vêm do servidor (billing.catalog[].adds, de
// FEATURE_MIN_PLAN em server/src/planConfig.js).
const BASE_BULLETS = ["Customers, quotes and invoices", "Suppliers and activities"];

export default function PlansCard() {
  const { billing, refresh, me } = usePlan();
  const { account } = useAuth();
  const { lang } = useT();
  const ps = planStr(lang);
  const [interval, setIntervalV] = useState('month');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const isOwner = account?.role === 'owner';

  useEffect(() => {
    const q = new URLSearchParams((window.location.hash.split('?')[1]) || '').get('billing');
    if (q === 'success') { refresh(); setTimeout(refresh, 4000); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Ver planos" (janelinha do selo de plano) chega aqui com ?plans=1: rola até este cartão quando ele já carregou.
  const ready = !!billing;
  useEffect(() => {
    if (ready && /[?&]plans=1/.test(window.location.hash)) document.getElementById('billing')?.scrollIntoView({ block: 'start' });
  }, [ready]);

  if (!billing) return null;
  const previewPlan = billing.previewPlan || null; // o dono da plataforma está vendo como outro plano: nada de assinar/cobrar
  const catalog = me?.catalog || [];
  const yearlyOk = (billing.yearlyPlans || []).length > 0;
  const yearly = interval === 'year' && yearlyOk;
  const paid = billing.configured && billing.subscribedPlan && billing.status === 'active';

  async function choose(plan) {
    setBusy(plan); setError('');
    try {
      const link = (yearly ? billing.paymentLinksYearly : billing.paymentLinks)?.[plan];
      if (link) { window.location.href = link; return; }
      const { url } = await api.billingCheckout(plan, yearly ? 'year' : 'month');
      window.location.href = url;
    } catch (e) { setError(e.message); setBusy(null); }
  }
  async function manage() {
    setBusy('manage'); setError('');
    try { const { url } = await api.billingPortal(); window.location.href = url; } catch (e) { setError(e.message); setBusy(null); }
  }

  const current = billing.plan; // plano EM VIGOR (o da prévia, se houver)
  const nameOf = (key) => catalog.find((c) => c.key === key)?.name || billing.plans.find((p) => p.id === key)?.label || key;
  const currentLabel = nameOf(current);
  return (
    <div id="billing" data-testid="plans-card">
    <Card className="p-1">
      <CardHead
        title="Plan & billing"
        sub={previewPlan ? `Your plan: ${currentLabel}` : billing.licensed ? `Your plan: ${currentLabel} · managed by Impact Digital (contact support to change it)` : billing.configured ? `Your plan: ${currentLabel}${billing.status !== 'active' ? ` (${billing.status})` : ''}` : 'Billing is not set up on this server, so every feature is unlocked.'}
        action={isOwner && paid ? <Button variant="outline" size="sm" className="min-h-[40px]" disabled={busy === 'manage' || !!previewPlan} onClick={manage}>{busy === 'manage' ? '…' : 'Manage subscription'}</Button> : null}
      />
      <div className="px-5 pb-5">
        <p className="text-xs text-muted mb-3">
          Staff logins: {billing.users}{billing.userLimit ? ` of ${billing.userLimit}` : ' (unlimited)'}
        </p>
        {previewPlan && <p className="text-xs text-brand mb-3" data-testid="plans-preview-note">{ps.previewBlocked}</p>}
        {error && <div className="mb-3 text-xs text-rose bg-roseTint border border-rose/30 rounded-lg px-3 py-2">{error}</div>}
        {yearlyOk && (
          <div className="flex gap-2 mb-4" role="group" aria-label="Billing period">
            {[['month', 'Monthly'], ['year', 'Yearly · save 10%']].map(([k, label]) => (
              <button key={k} type="button" aria-pressed={interval === k} onClick={() => setIntervalV(k)}
                className={`h-10 px-3 rounded-full text-xs font-semibold border ${interval === k ? 'border-brand bg-brandTint text-brand' : 'border-line text-muted'}`}>{label}</button>
            ))}
          </div>
        )}
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
          {billing.plans.map((p, pi) => {
            const isCurrent = current === p.id;
            const price = yearly ? p.yearly : p.monthly;
            const cat = catalog.find((c) => c.key === p.id);
            // o que ESTE plano acrescenta ao anterior (do servidor), cada um com o selo do plano onde entra
            const adds = ((cat && cat.adds) || []).filter((g) => gateText(g, lang));
            const prev = pi > 0 ? billing.plans[pi - 1] : null;
            const canBuy = !previewPlan && isOwner && billing.configured && !billing.licensed && (p.available && (!yearly || billing.yearlyPlans.includes(p.id)));
            return (
              <div key={p.id} data-plan-card={p.id} className={`rounded-xl border p-4 flex flex-col ${isCurrent ? 'border-brand bg-brandTint/30' : 'border-line'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink text-sm">{nameOf(p.id)}<PlanBadge plan={p.id} /></span>
                  {isCurrent && <Badge tone="brand">Current</Badge>}
                </div>
                <div className="mt-1.5 text-2xl font-bold text-ink">${price.toLocaleString('en-US')}<span className="text-xs font-normal text-muted">{yearly ? '/year' : '/month'}</span></div>
                <ul className="mt-3 space-y-1 text-xs text-muted">
                  {(pi === 0 ? BASE_BULLETS : []).map((b) => <li key={b}>• {b}</li>)}
                  <li>• {p.userLimit ? `Up to ${p.userLimit} staff logins` : 'Unlimited staff logins'}</li>
                </ul>
                <div className="mt-2 mb-4 flex-1">
                  {prev && adds.length > 0 && (
                    <div data-plan-adds={p.id}>
                      <div className="text-[11px] text-faint mb-1">{planFill(ps.everythingIn, { prev: nameOf(prev.id) })}</div>
                      <ul className="text-xs text-ink space-y-1 list-none p-0 m-0">
                        {adds.map((g) => (
                          <li key={g} data-add={g} className="flex items-center flex-wrap gap-y-0.5">
                            <span className="min-w-0">{gateText(g, lang).name}</span><PlanBadge plan={p.id} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {!isCurrent && (
                  <Button variant="brand" size="sm" className="justify-center min-h-[40px]" data-testid={`choose-${p.id}`} disabled={!canBuy || busy === p.id} onClick={() => choose(p.id)}>
                    {busy === p.id ? '…' : canBuy ? 'Choose plan' : p.available || !billing.configured ? 'Choose plan' : 'Coming soon'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
    </div>
  );
}
