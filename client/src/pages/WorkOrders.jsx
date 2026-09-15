import { useEffect, useState } from 'react';
import api from '../api.js';
import Layout from '../components/Layout.jsx';
import {
  Card, Table, Badge, CellName, Avatar, Spinner, Button, Modal, ConfirmDialog,
  Field, TextInput, TextArea, SelectInput, FormGrid, FormError, RowActions, Mono,
} from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { shortDate } from '../format.js';
import { downloadCsv } from '../csv.js';

const STATUS_OPTIONS = ['Queued', 'In Fabrication', 'In Welding', 'Quality Inspection', 'Ready to Ship', 'Completed', 'On Hold'];
const TONE = {
  Queued: 'neutral', 'In Fabrication': 'blue', 'In Welding': 'amber',
  'Quality Inspection': 'violet', 'Ready to Ship': 'green', Completed: 'steel', 'On Hold': 'rose',
};

const EMPTY = { quote_id: '', customer_id: '', work_order_number: '', status: 'Queued', owner_user_id: '', start_date: '', due_date: '', notes: '' };

function WorkOrderForm({ initial, quotes, customers, users, onCancel, onSubmit, saving, error }) {
  const [values, setValues] = useState(initial);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  function onQuoteChange(e) {
    const quoteId = e.target.value;
    const quote = quotes.find((q) => String(q.id) === String(quoteId));
    setValues((v) => ({ ...v, quote_id: quoteId, customer_id: quote ? quote.customer_id : v.customer_id }));
  }

  return (
    <Modal
      title={initial.id ? 'Edit Work Order' : 'New Work Order'}
      onClose={onCancel}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSubmit(values)} disabled={saving}>{saving ? 'Saving…' : 'Save Work Order'}</Button>
        </>
      }
    >
      <FormError error={error} />
      <FormGrid>
        <Field label="Linked Quote" hint="Optional — sets the customer automatically">
          <SelectInput value={values.quote_id || ''} onChange={onQuoteChange}>
            <option value="">No linked quote</option>
            {quotes.map((q) => <option key={q.id} value={q.id}>{q.quote_number} — {q.customer_name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Customer" required>
          <SelectInput value={values.customer_id} onChange={set('customer_id')}>
            <option value="">Select customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Work Order Number" required>
          <TextInput value={values.work_order_number} onChange={set('work_order_number')} placeholder="WO-2026-5000" className="font-mono" />
        </Field>
        <Field label="Shop Foreman" required>
          <SelectInput value={values.owner_user_id} onChange={set('owner_user_id')}>
            <option value="">Select owner…</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Start Date">
          <TextInput type="date" value={values.start_date || ''} onChange={set('start_date')} />
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
      <Field label="Notes">
        <TextArea value={values.notes || ''} onChange={set('notes')} placeholder="Shop-floor notes…" />
      </Field>
    </Modal>
  );
}

export default function WorkOrders() {
  const [rows, setRows] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  function load() {
    api.workOrders().then(setRows);
  }

  useEffect(() => {
    load();
    api.quotes().then(setQuotes);
    api.customers().then(setCustomers);
    api.users().then(setUsers);
  }, []);

  if (!rows) return <Layout title="Work Orders"><Spinner /></Layout>;

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
        id: row.id, quote_id: row.quote_id || '', customer_id: row.customer_id, work_order_number: row.work_order_number,
        status: row.status, owner_user_id: row.owner_user_id, start_date: row.start_date || '', due_date: row.due_date, notes: row.notes || '',
      },
    });
  }

  async function handleSubmit(values) {
    setSaving(true);
    setFormError(null);
    try {
      const payload = { ...values, quote_id: values.quote_id || null };
      if (modal.mode === 'create') {
        const created = await api.createWorkOrder(payload);
        setRows((prev) => [...prev, created].sort((a, b) => a.due_date.localeCompare(b.due_date)));
      } else {
        const updated = await api.updateWorkOrder(modal.row.id, payload);
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
      await api.deleteWorkOrder(deleteRow.id);
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
      'anvil-work-orders.csv',
      ['Work Order #', 'Customer', 'Status', 'Owner', 'Start Date', 'Due Date', 'Inspections'],
      rows.map((r) => [r.work_order_number, r.customer_name, r.status, r.owner_name, r.start_date || '', r.due_date, r.inspection_count])
    );
  }

  const cols = [
    { key: 'work_order_number', header: 'Work Order', render: (r) => <CellName primary={<Mono>{r.work_order_number}</Mono>} secondary={r.customer_name} /> },
    { key: 'inspection_count', header: 'Inspections', render: (r) => r.inspection_count },
    { key: 'start_date', header: 'Start', render: (r) => shortDate(r.start_date) },
    { key: 'due_date', header: 'Due', render: (r) => shortDate(r.due_date) },
    { key: 'owner_name', header: 'Foreman', render: (r) => <Avatar name={r.owner_name} color={r.owner_color} size={24} /> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={TONE[r.status] || 'neutral'}>{r.status}</Badge> },
    {
      key: 'actions', header: '', className: 'w-20',
      render: (r) => <RowActions onEdit={() => openEdit(r)} onDelete={() => { setDeleteError(null); setDeleteRow(r); }} />,
    },
  ];

  return (
    <Layout
      title="Work Orders"
      count={rows.length}
      actions={
        <>
          <Button variant="outline" onClick={handleExport}><Icon name="download" size={15} /> Export</Button>
          <Button onClick={openCreate}><Icon name="plus" size={15} /> New Work Order</Button>
        </>
      }
    >
      <Card>
        <Table cols={cols} rows={rows} />
      </Card>

      {modal && (
        <WorkOrderForm
          initial={modal.initial}
          quotes={quotes}
          customers={customers}
          users={users}
          onCancel={() => setModal(null)}
          onSubmit={handleSubmit}
          saving={saving}
          error={formError}
        />
      )}

      {deleteRow && (
        <ConfirmDialog
          title="Delete Work Order"
          message={`Delete ${deleteRow.work_order_number}? This cannot be undone.`}
          error={deleteError}
          busy={deleteBusy}
          onCancel={() => setDeleteRow(null)}
          onConfirm={handleDelete}
        />
      )}
    </Layout>
  );
}
