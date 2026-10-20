import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useT } from '../auth/i18n.js';
import { PlanProvider as BadgeProvider } from './PlanUpsellModal.jsx';
import { usePlan as useBadgePlan } from './PlanBadge.jsx';
import { PlanPreviewBar, PlanPreviewFrame } from './PlanPreview.jsx';
import { getPreviewPlan, setPreviewPlan } from './planPreview.js';
import { PLAN_NAMES } from './planConfig.js';

// Páginas travadas pelo plano respondem 402; chamadas de fundo (ex.: Configurações pedindo o WhatsApp) não devem
// virar erro vermelho no console: o convite de upgrade já aparece na tela.
if (typeof window !== 'undefined' && !window.__planRejectionGuard) {
  window.__planRejectionGuard = true;
  window.addEventListener('unhandledrejection', (e) => { if (e.reason && e.reason.status === 402) e.preventDefault(); });
}

// Plano em vigor desta instalação (vem de /api/billing/status): o menu e os botões mostram o SELO DE PLANO nos recursos
// que o plano não libera (a janelinha "Disponível no plano X" abre ao tocar), e o dono da plataforma pode "ver como plano".
// Este arquivo é a "cola" do kit de selo de plano com o Anvil (o kit mesmo: PlanBadge, PlanUpsellModal, PlanPreview).
const PlanCtx = createContext({ billing: null, allows: () => true, refresh: () => {} });

const LANG_IDX = { en: 0, pt: 1, es: 2 };
// Cores do Anvil (tailwind.config.js: brand / surface). O app é claro; a barra lateral é escura (veja Sidebar.jsx).
const THEME = { accent: '#b3261e', card: '#ffffff', light: true };

export function PlanProvider({ children }) {
  const { token, account } = useAuth();
  const { lang } = useT();
  const navigate = useNavigate();
  const [billing, setBilling] = useState(null);
  const refresh = useCallback(() => {
    if (!token) { setBilling(null); return Promise.resolve(); }
    return api.billingStatus().then(setBilling).catch(() => {});
  }, [token]);
  useEffect(() => { refresh(); }, [refresh]);
  // Sem a resposta ainda (ou servidor antigo), nada fica travado na tela: o servidor é quem manda.
  const allows = useCallback((feature) => !billing || !billing.features || billing.features[feature] !== false, [billing]);

  // Plano de prévia guardado neste navegador que o servidor não aceitou (conta que não é de dono da plataforma, ou plano que
  // não existe mais): esquece.
  useEffect(() => {
    if (billing && getPreviewPlan() && (!billing.owner || billing.previewPlan !== getPreviewPlan())) setPreviewPlan(null);
  }, [billing]);

  const idx = LANG_IDX[lang] ?? 0;
  const me = useMemo(() => {
    if (!billing) return null;
    const catalog = (billing.catalog || []).map((p) => ({ ...p, name: (PLAN_NAMES[p.key] || [])[idx] || p.name }));
    return { owner: !!billing.owner, previewPlan: billing.previewPlan || null, plan: billing.plan, gates: billing.gates || {}, catalog };
  }, [billing, idx]);

  // Uma ação bloqueada pelo servidor (402 plan_required) abre a mesma janelinha amigável.
  const [lateGate, setLateGate] = useState(null);
  useEffect(() => {
    const on = (e) => setLateGate(e.detail && e.detail.gate ? { gate: e.detail.gate, n: Date.now() } : null);
    window.addEventListener('plan-required', on);
    return () => window.removeEventListener('plan-required', on);
  }, []);

  return (
    <PlanCtx.Provider value={{ billing, allows, refresh, me }}>
      <BadgeProvider
        catalog={me ? me.catalog : []} gates={me ? me.gates : {}} enabled={!!me} canUpgrade={!!me && account?.role === 'owner'}
        langKey={lang} theme={THEME}
        onGoPlans={() => navigate('/settings?plans=1')}
      >
        <GateOpener request={lateGate} />
        <PlanPreviewFrame active={!!(me && me.owner && me.previewPlan)} bar={<PlanPreviewBar me={me} langKey={lang} />}>
          {children}
        </PlanPreviewFrame>
      </BadgeProvider>
    </PlanCtx.Provider>
  );
}

function GateOpener({ request }) {
  const { openGate } = useBadgePlan();
  useEffect(() => { if (request) openGate(request.gate); }, [request, openGate]);
  return null;
}

export const usePlan = () => useContext(PlanCtx);
