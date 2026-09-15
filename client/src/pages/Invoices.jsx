import { useEffect, useState } from 'react';
import api from '../api.js';
import Layout from '../components/Layout.jsx';
import {
  Card, Table, Badge, CellName, Spinner, Button, Modal, ConfirmDialog,
  Field, TextInput, SelectInput, FormGrid, FormError, RowActions, Mono,
} from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { money, shortDate } from '../format.js';
import { downloadCsv } from '../csv.js';

const STATUS_OPTIONS = ['Draft', 'Sent', 'Paid', 'Overdue'];
const TONE = { Draft: 'neutral', Sent: 'blue', Paid: 'green', Overdue: 'rose' };

const EMPTY = { work_order_id: '', customer_id: '', invoice_number: '', amount: '', status: 'Draft', issue_date: '', due_date: '' };

function InvoiceForm({ initial, workOrders, customers, onCancel, onSubmit, saving, error }) {
  const [values, setValues] = useState(initial);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  function onWorkOrderChange(e) {
    const woId = e.target.value;
    const wo = workOrders.find((w) => String(w.id) === String(woId));
    setValues((v) => ({ ...v, work_order_id: woId, customer_id: wo ? wo.customer_id : v.customer_id }));
  }

  return (
    <Modal
      title={initial.id ? 'Edit Invoice' : 'New Invoice'}
      onClose={onCancel}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSubmit(values)} disabled={saving}>{saving ? 'Saving…' : 'Save Invoice'}</Button>
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
        <Field label="Invoice Number" required>
          <TextInput value={values.invoice_number} onChange={set('invoice_number')} placeholder="INV-2026-7000" className="font-mono" />
        </Field>
        <Field label="Amount" required>
          <TextInput type="number" min="0" step="10" value={values.amount} onChange={set('amount')} placeholder="113280" />
        </Field>
        <Field label="Issue Date" required>
          <TextInput type="date" value={values.issue_date} onChange={set('issue_date')} />
        </Field>
        <Field label="Due Date" required>
          <TextInput type="date" value={values.due_date} onChange={set('due_date')} />
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

export default function Invoices() {
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
    api.invoices().then(setRows);
  }

  useEffect(() => {
    load();
    api.workOrders().then(setWorkOrders);
    api.customers().then(setCustomers);
  }, []);

  if (!rows) return <Layout title="Invoices"><Spinner /></Layout>;

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
        id: row.id, work_order_id: row.work_order_id, customer_id: row.customer_id, invoice_number: row.invoice_number,
        amount: row.amount, status: row.status, issue_date: row.issue_date, due_date: row.due_date,
      },
    });
  }

  async function handleSubmit(values) {
    setSaving(true);
    setFormError(null);
    try {
      if (modal.mode === 'create') {
        const created = await api.createInvoice(values);
        setRows((prev) => [...prev, created].sort((a, b) => a.due_date.localeCompare(b.due_date)));
      } else {
        const updated = await api.updateInvoice(modal.row.id, values);
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
      await api.deleteInvoice(deleteRow.id);
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
      'anvil-invoices.csv',
      ['Invoice #', 'Work Order', 'Customer', 'Amount', 'Status', 'Issue Date', 'Due Date'],
      rows.map((r) => [r.invoice_number, r.work_order_number, r.customer_name, r.amount, r.status, r.issue_date, r.due_date])
    );
  }

  const cols = [
    { key: 'invoice_number', header: 'Invoice #', render: (r) => <CellName primary={<Mono>{r.invoice_number}</Mono>} secondary={r.customer_name} /> },
    { key: 'work_order_number', header: 'Work Order', render: (r) => <Mono className="text-sm text-muted">{r.work_order_number}</Mono> },
    { key: 'amount', header: 'Amount', render: (r) => <span className="font-medium">{money(r.amount, true)}</span> },
    { key: 'issue_date', header: 'Issued', render: (r) => shortDate(r.issue_date) },
    { key: 'due_date', header: 'Due', render: (r) => shortDate(r.due_date) },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={TONE[r.status] || 'neutral'}>{r.status}</Badge> },
    {
      key: 'actions', header: '', className: 'w-20',
      render: (r) => <RowActions onEdit={() => openEdit(r)} onDelete={() => { setDeleteError(null); setDeleteRow(r); }} />,
    },
  ];

  return (
    <Layout
      title="Invoices"
      count={rows.length}
      actions={
        <>
          <Button variant="outline" onClick={handleExport}><Icon name="download" size={15} /> Export</Button>
          <Button onClick={openCreate}><Icon name="plus" size={15} /> New Invoice</Button>
        </>
      }
    >
      <Card>
        <Table cols={cols} rows={rows} />
      </Card>

      {modal && (
        <InvoiceForm
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
          title="Delete Invoice"
          message={`Delete ${deleteRow.invoice_number}? This cannot be undone.`}
          error={deleteError}
          busy={deleteBusy}
          onCancel={() => setDeleteRow(null)}
          onConfirm={handleDelete}
        />
      )}
    </Layout>
  );
}
