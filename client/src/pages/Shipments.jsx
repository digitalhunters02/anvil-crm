import { useEffect, useState } from 'react';
import api from '../api.js';
import Layout from '../components/Layout.jsx';
import {
  Card, Table, Badge, CellName, Spinner, Button, Modal, ConfirmDialog,
  Field, TextInput, SelectInput, FormGrid, FormError, RowActions, Mono,
} from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { shortDate } from '../format.js';
import { downloadCsv } from '../csv.js';

const STATUS_OPTIONS = ['Preparing', 'Shipped', 'Delivered'];
const TONE = { Preparing: 'amber', Shipped: 'blue', Delivered: 'green' };
const CARRIERS = ['Old Dominion Freight Line', 'Saia LTL', 'XPO', 'Estes Express', 'YRC Freight'];

const EMPTY = { work_order_id: '', customer_id: '', ship_date: '', carrier: CARRIERS[0], tracking_number: '', status: 'Preparing' };

function ShipmentForm({ initial, workOrders, customers, onCancel, onSubmit, saving, error }) {
  const [values, setValues] = useState(initial);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  function onWorkOrderChange(e) {
    const woId = e.target.value;
    const wo = workOrders.find((w) => String(w.id) === String(woId));
    setValues((v) => ({ ...v, work_order_id: woId, customer_id: wo ? wo.customer_id : v.customer_id }));
  }

  return (
    <Modal
      title={initial.id ? 'Edit Shipment' : 'New Shipment'}
      onClose={onCancel}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSubmit(values)} disabled={saving}>{saving ? 'Saving…' : 'Save Shipment'}</Button>
        </>
      }
    >
      <FormError error={error} />
      <FormGrid>
        <Field label="Work Order" required>
          <SelectInput value={values.work_order_id} onChange={onWorkOrderChange}>
            <option value="">Select work order…</option>
            {workOrders.map((w) => <option key={w.id} value={w.id}>{w.work_order_number} — {w.customer_name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Customer" required>
          <SelectInput value={values.customer_id} onChange={set('customer_id')}>
            <option value="">Select customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Carrier" required>
          <SelectInput value={values.carrier} onChange={set('carrier')}>
            {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
          </SelectInput>
        </Field>
        <Field label="Tracking Number">
          <TextInput value={values.tracking_number || ''} onChange={set('tracking_number')} placeholder="ODF100001234" className="font-mono" />
        </Field>
        <Field label="Ship Date">
          <TextInput type="date" value={values.ship_date || ''} onChange={set('ship_date')} />
        </Field>
        <Field label="Status" required>
          <SelectInput value={values.status} onChange={set('status')}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </SelectInput>
        </Field>
      </FormGrid>
    </Modal>
  );
}

export default function Shipments() {
  const [rows, setRows] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  function load() {
    api.shipments().then(setRows);
  }

  useEffect(() => {
    load();
    api.workOrders().then(setWorkOrders);
    api.customers().then(setCustomers);
  }, []);

  if (!rows) return <Layout title="Shipments"><Spinner /></Layout>;

  function openCreate() {
    setFormError(null);
    setModal({ mode: 'create', initial: EMPTY });
  }
  function openEdit(row) {
    setFormError(null);
    setModal({
      mode: 'edit',
      row,
      initial: {
        id: row.id, work_order_id: row.work_order_id, customer_id: row.customer_id, ship_date: row.ship_date || '',
        carrier: row.carrier, tracking_number: row.tracking_number || '', status: row.status,
      },
    });
  }

  async function handleSubmit(values) {
    setSaving(true);
    setFormError(null);
    try {
      if (modal.mode === 'create') {
        const created = await api.createShipment(values);
        setRows((prev) => [created, ...prev]);
      } else {
        const updated = await api.updateShipment(modal.row.id, values);
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      }
      setModal(null);
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await api.deleteShipment(deleteRow.id);
      setRows((prev) => prev.filter((r) => r.id !== deleteRow.id));
      setDeleteRow(null);
    } catch (e) {
      setDeleteError(e.message);
    } finally {
      setDeleteBusy(false);
    }
  }

  function handleExport() {
    downloadCsv(
      'anvil-shipments.csv',
      ['Work Order', 'Customer', 'Carrier', 'Tracking #', 'Ship Date', 'Status'],
      rows.map((r) => [r.work_order_number, r.customer_name, r.carrier, r.tracking_number || '', r.ship_date || '', r.status])
    );
  }

  const cols = [
    { key: 'work_order_number', header: 'Work Order', render: (r) => <CellName primary={<Mono>{r.work_order_number}</Mono>} secondary={r.customer_name} /> },
    { key: 'carrier', header: 'Carrier', render: (r) => <span className="text-sm text-ink">{r.carrier}</span> },
    { key: 'tracking_number', header: 'Tracking #', render: (r) => <Mono className="text-xs text-muted">{r.tracking_number || '—'}</Mono> },
    { key: 'ship_date', header: 'Ship Date', render: (r) => shortDate(r.ship_date) },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={TONE[r.status] || 'neutral'}>{r.status}</Badge> },
    {
      key: 'actions', header: '', className: 'w-20',
      render: (r) => <RowActions onEdit={() => openEdit(r)} onDelete={() => { setDeleteError(null); setDeleteRow(r); }} />,
    },
  ];

  return (
    <Layout
      title="Shipments"
      count={rows.length}
      actions={
        <>
          <Button variant="outline" onClick={handleExport}><Icon name="download" size={15} /> Export</Button>
          <Button onClick={openCreate}><Icon name="plus" size={15} /> New Shipment</Button>
        </>
      }
    >
      <Card>
        <Table cols={cols} rows={rows} />
      </Card>

      {modal && (
        <ShipmentForm
          initial={modal.initial}
          workOrders={workOrders}
          customers={customers}
          onCancel={() => setModal(null)}
          onSubmit={handleSubmit}
          saving={saving}
          error={formError}
        />
      )}

      {deleteRow && (
        <ConfirmDialog
          title="Delete Shipment"
          message={`Delete this shipment for ${deleteRow.work_order_number}? This cannot be undone.`}
          error={deleteError}
          busy={deleteBusy}
          onCancel={() => setDeleteRow(null)}
          onConfirm={handleDelete}
        />
      )}
    </Layout>
  );
}
