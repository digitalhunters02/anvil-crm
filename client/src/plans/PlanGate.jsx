import Layout from '../components/Layout.jsx';
import { Spinner } from '../components/ui.jsx';
import { useT } from '../auth/i18n.js';
import PlanBadge, { usePlan as useBadgePlan, usePlanGate } from './PlanBadge.jsx';
import { planStr, planFill, gateText } from './planStrings.js';

// Envolve uma TELA inteira: se o plano não libera o recurso (aberta pelo menu, pelo endereço ou por um atalho), mostra o cartão
// amigável "Disponível no plano X" com o botão que abre a janelinha, em vez da tela. Enquanto o servidor ainda não disse o plano,
// mostra só o carregando (a tela de dentro não chama a API antes da hora).
export default function PlanGate({ feature, title, children }) {
  const { enabled } = useBadgePlan();
  const g = usePlanGate(feature);
  const { lang } = useT();
  if (!enabled) return <Layout title={title}><Spinner /></Layout>;
  if (!g.locked) return children;
  const x = planStr(lang);
  const text = gateText(feature, lang);
  return (
    <Layout title={title}>
      <div className="max-w-xl mx-auto bg-surface border border-line rounded-xl p-6 text-center" data-testid="plan-locked-page" data-plan-locked={g.minPlan}>
        <div className="text-base font-semibold text-ink mb-1">
          {text ? text.name : title}<PlanBadge plan={g.minPlan} />
        </div>
        <p className="text-sm text-muted m-0 mb-4">
          {text ? planFill(x.notInPlanBody, { what: text.what, plan: g.minName }) : planFill(x.modalTitle, { plan: g.minName })}
        </p>
        <button
          type="button" onClick={g.open} data-testid="plan-locked-details"
          className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand/90"
        >
          {x.details}
        </button>
      </div>
    </Layout>
  );
}
