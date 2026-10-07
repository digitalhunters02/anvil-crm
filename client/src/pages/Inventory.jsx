import { useEffect, useRef, useState } from 'react';
import api from '../api.js';
import Layout from '../components/Layout.jsx';
import {
  Card, Table, Badge, CellName, Spinner, Button, Modal, ConfirmDialog, Kpi, Mono,
  Field, TextInput, SelectInput, FormGrid, FormError,
} from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { money, shortDate } from '../format.js';
import { code39Svg } from '../code39.js';

const EMPTY = { sku: '', name: '', material: '', uom: 'ea', min_stock: 0, unit_cost: '', location: '', barcode: '', tracking: 'none', opening_qty: '', opening_lot: '' };
const num = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });

function ItemForm({ initial, onCancel, onSubmit, saving, error }) {
  const [v, setV] = useState(initial);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal title={initial.id ? 'Edit item' : 'New inventory item'} onClose={onCancel} wide
      footer={<><Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button><Button onClick={() => onSubmit(v)} disabled={saving}>{saving ? 'Saving…' : 'Save item'}</Button></>}>
      <FormError error={error} />
      <FormGrid>
        <Field label="SKU" required><TextInput value={v.sku} onChange={set('sku')} placeholder="STL-PL-10" className="font-mono" /></Field>
        <Field label="Name" required><TextInput value={v.name} onChange={set('name')} placeholder="Steel plate 10 mm" /></Field>
        <Field label="Material"><TextInput value={v.material} onChange={set('material')} placeholder="A36" /></Field>
        <Field label="Unit"><TextInput value={v.uom} onChange={set('uom')} placeholder="ea, ft, lb" /></Field>
        <Field label="Minimum stock" hint="Alert when stock reaches this"><TextInput type="number" min="0" step="any" value={v.min_stock} onChange={set('min_stock')} /></Field>
        <Field label="Unit cost ($)"><TextInput type="number" min="0" step="0.01" value={v.unit_cost} onChange={set('unit_cost')} /></Field>
        <Field label="Location"><TextInput value={v.location} onChange={set('location')} placeholder="Rack A-2" /></Field>
        <Field label="Barcode" hint="Leave empty to use the SKU"><TextInput value={v.barcode || ''} onChange={set('barcode')} className="font-mono" /></Field>
        <Field label="Tracking"><SelectInput value={v.tracking} onChange={set('tracking')}><option value="none">No lot tracking</option><option value="lot">Track by lot</option></SelectInput></Field>
        {!initial.id && <Field label="Opening quantity"><TextInput type="number" min="0" step="any" value={v.opening_qty} onChange={set('opening_qty')} /></Field>}
        {!initial.id && v.tracking === 'lot' && <Field label="Opening lot"><TextInput value={v.opening_lot} onChange={set('opening_lot')} placeholder="OPENING" className="font-mono" /></Field>}
      </FormGrid>
    </Modal>
  );
}

function MoveModal({ item, workOrders, onClose, onDone }) {
  const [type, setType] = useState('receive');
  const [v, setV] = useState({ qty: '', lot: '', work_order_id: '', note: '' });
  const [hist, setHist] = useState(null);
  const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const load = () => api.inventoryMoves(item.id).then(setHist);
  useEffect(() => { load(); }, [item.id]); // eslint-disable-line
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  async function save() {
    setBusy(true); setErr(null);
    try { await api.moveInventory(item.id, { type, qty: Number(v.qty), lot: v.lot || undefined, work_order_id: v.work_order_id || undefined, note: v.note || undefined }); setV({ qty: '', lot: '', work_order_id: '', note: '' }); await load(); onDone(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  const cur = hist?.item || item;
  return (
    <Modal title={`${cur.sku} · ${cur.name}`} sub={`On hand: ${num(cur.on_hand)} ${cur.uom}${cur.location ? ` · ${cur.location}` : ''}`} onClose={onClose} wide>
      <FormError error={err} />
      <div className="flex gap-2 mb-3">{[['receive', 'Receive'], ['issue', 'Issue to work order'], ['adjust', 'Adjust count']].map(([k, label]) => (
        <Button key={k} size="sm" variant={type === k ? 'brand' : 'outline'} onClick={() => setType(k)}>{label}</Button>))}</div>
      <FormGrid>
        <Field label={type === 'adjust' ? 'Quantity (negative removes)' : 'Quantity'}><TextInput type="number" step="any" value={v.qty} onChange={set('qty')} aria-label="Quantity" /></Field>
        {cur.tracking === 'lot' && <Field label="Lot"><TextInput value={v.lot} onChange={set('lot')} className="font-mono" aria-label="Lot" list="lots-list" /></Field>}
        {type === 'issue' && (
          <Field label="Work order"><SelectInput value={v.work_order_id} onChange={set('work_order_id')} aria-label="Work order"><option value="">Select…</option>{workOrders.map((w) => <option key={w.id} value={w.id}>{w.work_order_number} · {w.customer_name}</option>)}</SelectInput></Field>
        )}
        {type === 'adjust' && <Field label="Reason"><TextInput value={v.note} onChange={set('note')} aria-label="Reason" /></Field>}
      </FormGrid>
      <datalist id="lots-list">{(hist?.lots || []).map((l) => <option key={l.lot} value={l.lot}>{`${l.lot} (${num(l.qty)})`}</option>)}</datalist>
      <Button variant="brand" onClick={save} disabled={busy || !v.qty}>{busy ? 'Saving…' : 'Save movement'}</Button>
      {cur.tracking === 'lot' && hist?.lots?.length > 0 && (
        <div className="mt-4 text-xs text-muted">Lots: {hist.lots.map((l) => <Badge key={l.lot} tone="steel" className="mr-1.5">{l.lot}: {num(l.qty)}</Badge>)}</div>
      )}
      <div className="mt-5 text-xs font-semibold text-muted uppercase tracking-wide mb-2">History</div>
      {!hist ? <Spinner /> : hist.moves.length === 0 ? <p className="text-sm text-muted">No movements yet.</p> : (
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-[11px] text-muted"><th className="py-1 pr-3">Date</th><th className="pr-3">Type</th><th className="pr-3">Qty</th><th className="pr-3">Lot</th><th>Work order / note</th></tr></thead>
          <tbody>{hist.moves.map((m) => (
            <tr key={m.id} className="border-t border-line"><td className="py-1.5 pr-3">{shortDate(m.created_at)}</td><td className="pr-3 capitalize">{m.reason}</td><td className={`pr-3 font-medium ${m.qty < 0 ? 'text-rose' : 'text-green'}`}>{m.qty > 0 ? '+' : ''}{num(m.qty)}</td><td className="pr-3"><Mono>{m.lot || '—'}</Mono></td><td className="text-muted">{m.work_order_number || m.note || ''}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </Modal>
  );
}

function LabelModal({ item, onClose }) {
  const { svg, text } = code39Svg(item.barcode || item.sku);
  const print = () => {
    const w = window.open('', '_blank', 'width=420,height=320'); if (!w) return;
    w.document.write(`<html><head><title>Label</title><style>body{font-family:sans-serif;text-align:center;padding:16px}h3{margin:6px 0}small{color:#444}</style></head><body><h3>${item.name.replace(/[<&]/g, '')}</h3>${svg}<div style="font-family:monospace;margin-top:4px">${text}</div><small>${item.location.replace(/[<&]/g, '')}</small></body></html>`);
    w.document.close(); w.focus(); w.print();
  };
  return (
    <Modal title="Barcode label" sub={item.sku} onClose={onClose} footer={<><Button variant="outline" onClick={onClose}>Close</Button><Button variant="brand" onClick={print}>Print</Button></>}>
      <div className="text-center py-3" data-testid="label-preview"><div className="text-sm font-medium text-ink mb-2">{item.name}</div><div className="inline-block bg-white p-2 border border-line" dangerouslySetInnerHTML={{ __html: svg }} /><div className="font-mono text-xs mt-1">{text}</div></div>
    </Modal>
  );
}

export default function Inventory() {
  const [rows, setRows] = useState(null);
  const [wos, setWos] = useState([]);
  const [modal, setModal] = useState(null); const [saving, setSaving] = useState(false); const [formError, setFormError] = useState(null);
  const [moveItem, setMoveItem] = useState(null); const [labelItem, setLabelItem] = useState(null); const [del, setDel] = useState(null); const [delErr, setDelErr] = useState(null);
  const [scan, setScan] = useState(''); const [scanMsg, setScanMsg] = useState(null); const [lot, setLot] = useState(''); const [trace, setTrace] = useState(null);
  const [onlyLow, setOnlyLow] = useState(false);
  const scanRef = useRef(null);
  const load = () => api.inventory().then(setRows);
  useEffect(() => { load(); api.workOrders().then(setWos).catch(() => {}); }, []);
  if (!rows) return <Layout title="Inventory"><Spinner /></Layout>;
  const low = rows.filter((r) => r.low);
  const shown = onlyLow ? low : rows;

  async function onScan(e) {
    e.preventDefault(); setScanMsg(null);
    const code = scan.trim(); if (!code) return;
    try { const it = await api.inventoryLookup(code); setScan(''); setMoveItem(it); } catch (x) { setScanMsg(x.message); }
  }
  async function cameraScan() {
    try {
      const det = new window.BarcodeDetector({ formats: ['code_39', 'code_128', 'ean_13', 'qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = document.createElement('video'); video.srcObject = stream; await video.play();
      const stop = () => stream.getTracks().forEach((t) => t.stop());
      const tick = async () => {
        const found = await det.detect(video).catch(() => []);
        if (found[0]) { stop(); setScan(found[0].rawValue); try { setMoveItem(await api.inventoryLookup(found[0].rawValue)); } catch (x) { setScanMsg(x.message); } return; }
        requestAnimationFrame(tick);
      };
      tick(); setTimeout(stop, 30000);
    } catch { setScanMsg('The camera is not available on this device.'); }
  }
  async function submit(v) {
    setSaving(true); setFormError(null);
    const body = { ...v, min_stock: Number(v.min_stock) || 0, unit_cost: Number(v.unit_cost) || 0, opening_qty: Number(v.opening_qty) || 0 };
    try { if (v.id) await api.updateInventoryItem(v.id, body); else await api.createInventoryItem(body); setModal(null); await load(); }
    catch (e) { setFormError(e.message); } finally { setSaving(false); }
  }
  async function doTrace(e) { e.preventDefault(); setTrace(null); if (!lot.trim()) return; try { setTrace(await api.inventoryTrace(lot.trim())); } catch (x) { setTrace({ error: x.message }); } }

  const cols = [
    { key: 'sku', header: 'Item', render: (r) => <CellName primary={r.name} secondary={`${r.sku}${r.location ? ` · ${r.location}` : ''}`} mono={false} /> },
    { key: 'on_hand', header: 'On hand', render: (r) => <span className="font-medium">{num(r.on_hand)} <span className="text-muted font-normal">{r.uom}</span></span> },
    { key: 'min', header: 'Minimum', render: (r) => (r.min_stock > 0 ? num(r.min_stock) : '—') },
    { key: 'status', header: '', render: (r) => (r.low ? <Badge tone="rose">Low stock</Badge> : r.tracking === 'lot' ? <Badge tone="steel">Lot tracked</Badge> : null) },
    { key: 'value', header: 'Value', render: (r) => money(r.value) },
    { key: 'a', header: '', render: (r) => (
      <div className="flex items-center gap-1.5 justify-end">
        <Button size="sm" variant="outline" onClick={() => setMoveItem(r)}>Move</Button>
        <Button size="sm" variant="ghost" onClick={() => setLabelItem(r)} aria-label="Label">Label</Button>
        <Button size="sm" variant="ghost" onClick={() => { setFormError(null); setModal({ ...r, barcode: r.barcode || '' }); }} aria-label="Edit"><Icon name="pencil" size={14} /></Button>
        <Button size="sm" variant="ghost" onClick={() => { setDelErr(null); setDel(r); }} aria-label="Delete"><Icon name="trash" size={14} /></Button>
      </div>) },
  ];
  return (
    <Layout title="Inventory" count={rows.length} actions={<Button onClick={() => { setFormError(null); setModal(EMPTY); }}><Icon name="plus" size={15} /> New item</Button>}>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        <Kpi label="Items" value={rows.length} icon="material" />
        <Kpi label="Stock value" value={money(rows.reduce((a, r) => a + r.value, 0), true)} tone="steel" icon="gauge" />
        <Kpi label="Below minimum" value={low.length} tone={low.length ? 'rose' : 'green'} icon="alertTriangle" />
      </div>
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-4">
          <form onSubmit={onScan} className="flex flex-1 min-w-[260px] gap-2">
            <input ref={scanRef} value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Scan or type a barcode / SKU, then Enter" aria-label="Scan barcode" className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm font-mono" />
            <Button variant="brand" type="submit">Find</Button>
            {typeof window !== 'undefined' && 'BarcodeDetector' in window && <Button variant="outline" type="button" onClick={cameraScan}><Icon name="camera" size={14} /> Camera</Button>}
          </form>
          <form onSubmit={doTrace} className="flex flex-1 min-w-[260px] gap-2">
            <input value={lot} onChange={(e) => setLot(e.target.value)} placeholder="Trace a lot (recall)" aria-label="Trace lot" className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm font-mono" />
            <Button variant="outline" type="submit">Trace</Button>
          </form>
        </div>
        {scanMsg && <p className="text-xs text-rose mt-2">{scanMsg}</p>}
        {trace && (trace.error ? <p className="text-xs text-rose mt-2">{trace.error}</p> : (
          <div className="mt-3 text-sm" data-testid="trace-result">
            <div className="font-medium text-ink">Lot {trace.lot}: received {num(trace.received)}, used {num(trace.used)}</div>
            {trace.moves.length === 0 ? <p className="text-muted">No movements for this lot.</p> : trace.moves.map((m) => (
              <div key={m.id} className="text-muted">{shortDate(m.created_at)} · {m.sku} · {m.qty > 0 ? '+' : ''}{num(m.qty)}{m.work_order_number ? ` → ${m.work_order_number} (${m.customer_name})` : ''}</div>))}
          </div>))}
      </Card>
      {low.length > 0 && <div className="mb-3"><Button size="sm" variant={onlyLow ? 'brand' : 'outline'} onClick={() => setOnlyLow((x) => !x)}>{onlyLow ? 'Showing low stock only' : `Show ${low.length} low-stock item${low.length === 1 ? '' : 's'}`}</Button></div>}
      {rows.length === 0 ? <Card className="p-8 text-center text-sm text-muted">No inventory yet. Add the materials you keep in stock — Anvil warns you when they run low and can build the purchase order.</Card> : <Card><Table cols={cols} rows={shown} /></Card>}
      {modal && <ItemForm initial={modal} onCancel={() => setModal(null)} onSubmit={submit} saving={saving} error={formError} />}
      {moveItem && <MoveModal item={moveItem} workOrders={wos} onClose={() => setMoveItem(null)} onDone={load} />}
      {labelItem && <LabelModal item={labelItem} onClose={() => setLabelItem(null)} />}
      {del && <ConfirmDialog title="Delete item?" message={`Remove ${del.sku} from inventory?`} error={delErr} onCancel={() => setDel(null)} onConfirm={async () => { try { await api.deleteInventoryItem(del.id); setDel(null); load(); } catch (e) { setDelErr(e.message); } }} />}
    </Layout>
  );
}
