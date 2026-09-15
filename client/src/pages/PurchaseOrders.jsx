import { useEffect, useState } from 'react';
import api from '../api.js';
import Layout from '../components/Layout.jsx';
import {
  Card, Table, Badge, CellName, Spinner, Button, Modal, ConfirmDialog,
  Field, TextInput, TextArea, SelectInput, FormGrid, FormError, RowActions, Mono,
} from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { money, shortDate } from '../format.js';
import { downloadCsv } from '../csv.js';

const STATUS_OPTIONS = ['Draft', 'Sent', 'Confirmed', 'Received', 'Cancelled'];
const TONE = { Draft: 'neutral', Sent: 'blue', Confirmed: 'amber', Received: 'green', Cancelled: 'rose' };

const EMPTY = { supplier_id: '', po_number: '', status: 'Draft', total_amount: '', order_date: '', expected_date: '', notes: '' };

function PoForm({ initial, suppliers, onCancel, onSubmit, saving, error }) {
  const [values, setValues] = useState(initial);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <Modal
      title={initial.id ? 'Edit Purchase Order' : 'New Purchase Order'}
      onClose={onCancel}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSubmit(values)} disabled={saving}>{saving ? 'Saving…' : 'Save Purchase Order'}</Button>
        </>
      }
    >
      <FormError error={error} />
      <FormGrid>
        <Field label="Supplier" required>
          <SelectInput value={values.supplier_id} onChange={set('supplier_id')}>
            <option value="">Select supplier…</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectInput>
        </Field>
        <Field label="PO Number" required>
          <TextInput value={values.po_number} onChange={set('po_number')} placeholder="PO-2026-3001" className="font-mono" />
        </Field>
        <Field label="Total Amount" required>
          <TextInput type="number" min="0" step="10" value={values.total_amount} onChange={set('total_amount')} placeholder="18450" />
        </Field>
        <Field label="Status" required>
          <SelectInput value={values.status} onChange={set('status')}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </SelectInput>
        </Field>
        <Field label="Order Date" required>
          <TextInput type="date" value={values.order_date} onChange={set('order_date')} />
        </Field>
        <Field label="Expected Date">
          <TextInput type="date" value={values.expected_date || ''} onChange={set('expected_date')} />
        </Field>
      </FormGrid>
      <Field label="Notes">
        <TextArea value={values.notes || ''} onChange={set('notes')} placeholder="What materials this PO covers…" />
      </Field>
    </Modal>
  );
}

export default function PurchaseOrders() {
  const [rows, setRows] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  function load() {
    api.purchaseOrders().then(setRows);
  }

  useEffect(() => {
    load();
    api.suppliers().then(setSuppliers);
  }, []);

  if (!rows) return <Layout title="Purchase Orders"><Spinner /></Layout>;

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
        id: row.id, supplier_id: row.supplier_id, po_number: row.po_number, status: row.status,
        total_amount: row.total_amount, order_date: row.order_date, expected_date: row.expected_date || '', notes: row.notes || '',
      },
    });
  }

  async function handleSubmit(values) {
    setSaving(true);
    setFormError(null);
    try {
      if (modal.mode === 'create') {
        const created = await api.createPurchaseOrder(values);
        setRows((prev) => [created, ...prev]);
      } else {
        const updated = await api.updatePurchaseOrder(modal.row.id, values);
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
      await api.deletePurchaseOrder(deleteRow.id);
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
      'anvil-purchase-orders.csv',
      ['PO #', 'Supplier', 'Status', 'Total Amount', 'Order Date', 'Expected Date'],
      rows.map((r) => [r.po_number, r.supplier_name, r.status, r.total_amount, r.order_date, r.expected_date || ''])
    );
  }

  const cols = [
    { key: 'po_number', header: 'PO #', render: (r) => <CellName primary={<Mono>{r.po_number}</Mono>} secondary={r.supplier_name} /> },
    { key: 'supplier_specialty', header: 'Specialty', render: (r) => <span className="text-sm text-muted">{r.supplier_specialty}</span> },
    { key: 'total_amount', header: 'Total', render: (r) => <span className="font-medium">{money(r.total_amount, true)}</span> },
    { key: 'order_date', header: 'Ordered', render: (r) => shortDate(r.order_date) },
    { key: 'expected_date', header: 'Expected', render: (r) => shortDate(r.expected_date) },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={TONE[r.status] || 'neutral'}>{r.status}</Badge> },
    {
      key: 'actions', header: '', className: 'w-20',
      render: (r) => <RowActions onEdit={() => openEdit(r)} onDelete={() => { setDeleteError(null); setDeleteRow(r); }} />,
    },
  ];

  return (
    <Layout
      title="Purchase Orders"
      count={rows.length}
      actions={
        <>
          <Button variant="outline" onClick={handleExport}><Icon name="download" size={15} /> Export</Button>
          <Button onClick={openCreate}><Icon name="plus" size={15} /> New Purchase Order</Button>
        </>
      }
    >
      <Card>
        <Table cols={cols} rows={rows} />
      </Card>

      {modal && (
        <PoForm
          initial={modal.initial}
          suppliers={suppliers}
          onCancel={() => setModal(null)}
          onSubmit={handleSubmit}
          saving={saving}
          error={formError}
        />
      )}

      {deleteRow && (
        <ConfirmDialog
          title="Delete Purchase Order"
          message={`Delete ${deleteRow.po_number}? This cannot be undone.`}
          error={deleteError}
          busy={deleteBusy}
          onCancel={() => setDeleteRow(null)}
          onConfirm={handleDelete}
        />
      )}
    </Layout>
  );
}
