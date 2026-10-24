// SampleDataCard.jsx
// PARA QUE SERVE: o cartão "Dados de exemplo" de Configurações (só o dono vê): botão "Carregar dados de exemplo" e botão
// "Remover dados de exemplo" (com confirmação). Fala com /api/sample-data/* (server/src/sampleData.js). Nada carrega sozinho:
// só quando o dono clica. Textos em en/pt/es (i18n/sampleDataStrings.js), no idioma escolhido na tela de entrada.
import { useEffect, useState } from 'react';
import api from '../api.js';
import { Card, CardHead, Button, Modal, Spinner } from './ui.jsx';
import { useT, friendlyError } from '../auth/i18n.js';

const SHOWN = ['customers', 'rfqs', 'quotes', 'work_orders', 'purchase_orders', 'invoices', 'suppliers', 'inventory_items'];

export default function SampleDataCard() {
  const { t } = useT();
  const [st, setSt] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(null); // 'load' | 'remove' | null
  const [note, setNote] = useState(null); // { ok: bool, text }
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let alive = true;
    api.sampleDataStatus().then((s) => { if (alive) setSt(s); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  async function load() {
    setBusy('load'); setNote(null);
    try {
      const r = await api.sampleDataLoad();
      setSt(r.status);
      setNote({ ok: true, text: r.already ? t('sample.alreadyOk') : t('sample.loadedOk', { n: r.created }) });
    } catch (e) {
      setNote({ ok: false, text: friendlyError(e, t) });
      api.sampleDataStatus().then(setSt).catch(() => {});
    } finally { setBusy(null); }
  }

  async function remove() {
    setBusy('remove'); setNote(null);
    try {
      const r = await api.sampleDataRemove();
      setSt(r.status);
      const parts = [r.removed > 0 ? t('sample.removedOk', { n: r.removed }) : t('sample.removedNone')];
      if (r.kept > 0) parts.push(t('sample.removedKept', { k: r.kept }));
      setNote({ ok: true, text: parts.join(' ') });
      setConfirming(false);
    } catch (e) {
      setNote({ ok: false, text: friendlyError(e, t) });
      setConfirming(false);
    } finally { setBusy(null); }
  }

  const stateText = !st ? '' : st.loaded ? t('sample.stateLoaded', { n: st.total }) : st.hasRealData ? t('sample.stateBlocked') : t('sample.stateNone');

  return (
    <Card className="p-1 min-w-0" data-testid="sample-card">
      <CardHead title={t('sample.title')} sub={t('sample.sub')} />
      <div className="px-5 pb-5 text-sm min-w-0">
        {!st && !failed && <Spinner />}
        {failed && <p className="text-sm text-rose bg-roseTint border border-rose/30 rounded-md px-3 py-2 mb-3" data-testid="sample-error">{t('sample.stateError')}</p>}
        {st && (
          <>
            <p className="font-medium text-ink mb-2" data-testid="sample-state" data-loaded={st.loaded ? 'true' : 'false'} data-can-load={st.canLoad ? 'true' : 'false'} style={{ overflowWrap: 'anywhere' }}>{stateText}</p>
            {st.loaded && (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3 text-xs text-muted" data-testid="sample-counts">
                {SHOWN.map((k) => (
                  <li key={k} className="flex items-baseline justify-between gap-2 min-w-0">
                    <span className="truncate">{t(`sample.t.${k}`)}</span>
                    <span className="font-mono text-ink">{st.counts[k] ?? 0}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted mb-3" style={{ overflowWrap: 'anywhere' }}>{t('sample.trialNote')}</p>
          </>
        )}
        {note && (
          <p
            role="status"
            data-testid="sample-note"
            className={`text-sm rounded-md px-3 py-2 mb-3 border ${note.ok ? 'text-green bg-greenTint border-green/30' : 'text-rose bg-roseTint border-rose/30'}`}
            style={{ overflowWrap: 'anywhere' }}
          >
            {note.text}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="brand" className="min-h-[40px]" onClick={load} disabled={!st || !st.canLoad || busy !== null} data-testid="sample-load">
            {busy === 'load' ? t('sample.loading') : t('sample.load')}
          </Button>
          <Button variant="outline" className="min-h-[40px]" onClick={() => setConfirming(true)} disabled={!st || !st.loaded || busy !== null} data-testid="sample-remove">
            {busy === 'remove' ? t('sample.removing') : t('sample.remove')}
          </Button>
        </div>
      </div>
      {confirming && (
        <Modal
          title={t('sample.removeTitle')}
          onClose={() => (busy ? null : setConfirming(false))}
          footer={(
            <>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy !== null} data-testid="sample-remove-cancel">{t('sample.cancel')}</Button>
              <Button onClick={remove} disabled={busy !== null} className="!bg-rose hover:!bg-rose/90 text-white" data-testid="sample-remove-confirm">
                {busy === 'remove' ? t('sample.removing') : t('sample.removeConfirm')}
              </Button>
            </>
          )}
        >
          <p className="text-sm text-muted" style={{ overflowWrap: 'anywhere' }}>{t('sample.removeBody')}</p>
        </Modal>
      )}
    </Card>
  );
}
