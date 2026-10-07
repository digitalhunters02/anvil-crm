import { useEffect, useState } from 'react';
import api from '../api.js';
import Layout from '../components/Layout.jsx';
import { Card, Badge, Spinner, Button, Kpi, Field, SelectInput, TextInput } from '../components/ui.jsx';
import { money } from '../format.js';

const num = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });

// Compra do que falta: soma o que as ordens abertas precisam + o mínimo, tira o que há no estoque e cria o pedido de compra.
export default function Shortages() {
  const [d, setD] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [pick, setPick] = useState({}); const [qty, setQty] = useState({});
  const [supplier, setSupplier] = useState(''); const [expected, setExpected] = useState('');
  const [err, setErr] = useState(null); const [made, setMade] = useState(null); const [busy, setBusy] = useState(false);
  const load = () => api.shortages().then((r) => { setD(r); setPick(Object.fromEntries(r.rows.map((x) => [x.item_id, true]))); setQty(Object.fromEntries(r.rows.map((x) => [x.item_id, x.suggested]))); });
  useEffect(() => { load(); api.suppliers().then(setSuppliers); }, []);
  if (!d) return <Layout title="Shortages & Purchasing"><Spinner /></Layout>;
  const chosen = d.rows.filter((r) => pick[r.item_id]);
  const total = chosen.reduce((a, r) => a + (Number(qty[r.item_id]) || 0) * r.unit_cost, 0);
  async function create() {
    setBusy(true); setErr(null); setMade(null);
    try { setMade(await api.createMrpPurchaseOrder({ supplier_id: Number(supplier), expected_date: expected || undefined, items: chosen.map((r) => ({ item_id: r.item_id, qty: Number(qty[r.item_id]) })) })); await load(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <Layout title="Shortages & Purchasing">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        <Kpi label="Items to buy" value={d.rows.length} tone={d.rows.length ? 'amber' : 'green'} icon="material" />
        <Kpi label="Estimated cost" value={money(d.total)} tone="steel" icon="purchaseOrder" />
        <Kpi label="Lines not in inventory" value={d.unmatched.length} icon="bom" sub="Bill of materials lines with no matching item" />
      </div>
      {made && <Card className="p-4 mb-4"><span className="text-sm text-ink" data-testid="po-made">Purchase order <b>{made.po_number}</b> created as a draft — open Purchase Orders to send it.</span></Card>}
      {d.rows.length === 0 ? <Card className="p-8 text-center text-sm text-muted">Nothing to buy right now. Stock covers the open work orders and every minimum.</Card> : (
        <Card className="p-1">
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] text-muted uppercase tracking-wide"><th className="px-4 py-3"> </th><th className="pr-3">Item</th><th className="pr-3">On hand</th><th className="pr-3">Needed by work orders</th><th className="pr-3">Minimum</th><th className="pr-3">Buy</th><th className="pr-4">Cost</th></tr></thead>
            <tbody>{d.rows.map((r) => (
              <tr key={r.item_id} className="border-t border-line">
                <td className="px-4 py-2"><input type="checkbox" aria-label={`Select ${r.sku}`} checked={!!pick[r.item_id]} onChange={(e) => setPick((p) => ({ ...p, [r.item_id]: e.target.checked }))} /></td>
                <td className="pr-3"><div className="font-medium text-ink">{r.name}</div><div className="text-xs text-muted font-mono">{r.sku}{r.work_orders.length ? ` · ${r.work_orders.join(', ')}` : ''}</div></td>
                <td className="pr-3">{num(r.on_hand)} {r.uom}</td><td className="pr-3">{num(r.required)}</td><td className="pr-3">{num(r.min_stock)} {r.reason === 'below_minimum' && <Badge tone="amber">Low</Badge>}</td>
                <td className="pr-3"><input type="number" min="0" step="any" aria-label={`Quantity ${r.sku}`} className="w-24 rounded-md border border-line bg-surface px-2 py-1 text-sm" value={qty[r.item_id] ?? ''} onChange={(e) => setQty((q) => ({ ...q, [r.item_id]: e.target.value }))} /></td>
                <td className="pr-4">{money((Number(qty[r.item_id]) || 0) * r.unit_cost)}</td>
              </tr>))}</tbody>
          </table></div>
          <div className="flex flex-wrap items-end gap-3 p-4 border-t border-line">
            <div className="min-w-[200px]"><Field label="Supplier"><SelectInput value={supplier} onChange={(e) => setSupplier(e.target.value)} aria-label="Supplier"><option value="">Select…</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</SelectInput></Field></div>
            <div><Field label="Expected date"><TextInput type="date" value={expected} onChange={(e) => setExpected(e.target.value)} /></Field></div>
            <div className="pb-3.5"><Button variant="brand" onClick={create} disabled={busy || !supplier || chosen.length === 0}>{busy ? 'Creating…' : `Create purchase order · ${money(total)}`}</Button></div>
          </div>
          {err && <p className="text-xs text-rose px-4 pb-3">{err}</p>}
        </Card>
      )}
      {d.unmatched.length > 0 && (
        <Card className="p-4 mt-4">
          <div className="text-sm font-medium text-ink mb-1">Bill of materials lines without a matching inventory item</div>
          <p className="text-xs text-muted mb-2">Add an inventory item whose SKU or name equals the part name or material to include these in the calculation.</p>
          {d.unmatched.map((u) => <div key={u.part_name + u.material} className="text-sm text-muted">{u.part_name} <span className="text-faint">({u.material})</span> · {num(u.quantity)} · {u.work_orders.join(', ')}</div>)}
        </Card>
      )}
    </Layout>
  );
}
