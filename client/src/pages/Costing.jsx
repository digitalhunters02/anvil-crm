import { useEffect, useState } from 'react';
import api from '../api.js';
import Layout from '../components/Layout.jsx';
import { Card, Table, Badge, CellName, Spinner, Button, Modal, Kpi, Field, TextInput, FormGrid, FormError } from '../components/ui.jsx';
import { money, shortDate, pct } from '../format.js';

function LaborModal({ row, onClose, onDone }) {
  const [list, setList] = useState(null);
  const [v, setV] = useState({ work_date: new Date().toISOString().slice(0, 10), hours: '', rate: '', note: '' });
  const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const load = () => api.laborEntries(row.id).then(setList);
  useEffect(() => { load(); }, [row.id]); // eslint-disable-line
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  async function add() { setBusy(true); setErr(null); try { await api.addLabor({ ...v, work_order_id: row.id, hours: Number(v.hours), rate: Number(v.rate) }); setV((x) => ({ ...x, hours: '', note: '' })); await load(); onDone(); } catch (e) { setErr(e.message); } finally { setBusy(false); } }
  return (
    <Modal title={`Labor · ${row.work_order_number}`} sub={row.customer_name} onClose={onClose} wide>
      <FormError error={err} />
      <FormGrid>
        <Field label="Date"><TextInput type="date" value={v.work_date} onChange={set('work_date')} /></Field>
        <Field label="Hours"><TextInput type="number" min="0" step="0.25" value={v.hours} onChange={set('hours')} aria-label="Hours" /></Field>
        <Field label="Hourly rate ($)"><TextInput type="number" min="0" step="0.01" value={v.rate} onChange={set('rate')} aria-label="Rate" /></Field>
        <Field label="Note"><TextInput value={v.note} onChange={set('note')} placeholder="Welding, fit-up…" /></Field>
      </FormGrid>
      <Button variant="brand" onClick={add} disabled={busy || !v.hours || v.rate === ''}>{busy ? 'Saving…' : 'Add labor'}</Button>
      <div className="mt-5">{!list ? <Spinner /> : list.length === 0 ? <p className="text-sm text-muted">No labor logged yet.</p> : list.map((l) => (
        <div key={l.id} className="flex items-center justify-between text-sm py-1.5 border-t border-line">
          <span>{shortDate(l.work_date)} · {l.hours} h × {money(l.rate)}{l.note ? ` · ${l.note}` : ''}</span>
          <Button size="sm" variant="ghost" onClick={async () => { await api.deleteLabor(l.id); load(); onDone(); }} aria-label="Remove labor">✕</Button>
        </div>))}</div>
    </Modal>
  );
}

export default function Costing() {
  const [d, setD] = useState(null);
  const [labor, setLabor] = useState(null);
  const load = () => api.costing().then(setD);
  useEffect(() => { load(); }, []);
  if (!d) return <Layout title="Job Costing"><Spinner /></Layout>;
  const cols = [
    { key: 'wo', header: 'Work order', render: (r) => <CellName primary={r.work_order_number} secondary={r.customer_name} mono /> },
    { key: 'revenue', header: 'Quote', render: (r) => (r.revenue == null ? <span className="text-muted">—</span> : money(r.revenue)) },
    { key: 'materials', header: 'Materials', render: (r) => (<span>{money(r.materials_basis === 'actual' ? r.materials_actual : r.materials_estimated)} <span className="text-[11px] text-muted">{r.materials_basis === 'actual' ? 'actual' : 'estimated'}</span></span>) },
    { key: 'labor', header: 'Labor', render: (r) => `${money(r.labor)} · ${r.labor_hours} h` },
    { key: 'cost', header: 'Cost', render: (r) => <span className="font-medium">{money(r.cost)}</span> },
    { key: 'margin', header: 'Margin', render: (r) => (r.margin == null ? <span className="text-muted">—</span> : <Badge tone={r.margin < 0 ? 'rose' : r.margin_pct < 15 ? 'amber' : 'green'}>{money(r.margin)} · {pct(r.margin_pct)}</Badge>) },
    { key: 'a', header: '', render: (r) => <Button size="sm" variant="outline" onClick={() => setLabor(r)}>Labor</Button> },
  ];
  return (
    <Layout title="Job Costing" count={d.rows.length}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Kpi label="Quoted revenue" value={money(d.totals.revenue, true)} icon="quote" />
        <Kpi label="Cost" value={money(d.totals.cost, true)} tone="steel" icon="gauge" />
        <Kpi label="Margin" value={money(d.totals.margin, true)} tone="green" icon="spark" />
        <Kpi label="Margin %" value={pct(d.totals.margin_pct)} tone="brand" icon="reports" />
      </div>
      <Card><Table cols={cols} rows={d.rows} /></Card>
      <p className="text-xs text-muted mt-3">Materials use what was actually issued from inventory to the work order; until something is issued, the bill of materials estimate is used.</p>
      {labor && <LaborModal row={labor} onClose={() => setLabor(null)} onDone={load} />}
    </Layout>
  );
}
