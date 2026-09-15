import { useEffect, useState } from 'react';
import api from '../api.js';
import Layout from '../components/Layout.jsx';
import {
  Card, Table, Badge, CellName, Avatar, Spinner, Button, Modal, ConfirmDialog,
  Field, TextInput, TextArea, SelectInput, FormGrid, FormError, RowActions, Mono,
} from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { money, shortDate } from '../format.js';
import { downloadCsv } from '../csv.js';

const STATUS_OPTIONS = ['New', 'Quoted', 'Won', 'Lost'];
const TONE = { New: 'blue', Quoted: 'amber', Won: 'green', Lost: 'rose' };

const EMPTY = { customer_id: '', title: '', description: '', target_price: '', due_date: '', status: 'New', owner_user_id: '', received_date: '' };

function RfqForm({ initial, customers, users, onCancel, onSubmit, saving, error }) {
  const [values, setValues] = useState(initial);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <Modal
      title={initial.id ? 'Edit RFQ' : 'New RFQ'}
      onClose={onCancel}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSubmit(values)} disabled={saving}>{saving ? 'Saving…' : 'Save RFQ'}</Button>
        </>
      }
    >
      <FormError error={error} />
      <FormGrid>
        <Field label="Customer" required>
          <SelectInput value={values.customer_id} onChange={set('customer_id')}>
            <option value="">Select customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Title" required>
          <TextInput value={values.title} onChange={set('title')} placeholder="Bridge Deck Girder Assembly — Lot 14" />
        </Field>
        <Field label="Target Price">
          <TextInput type="number" min="0" step="100" value={values.target_price} onChange={set('target_price')} placeholder="118000" />
        </Field>
        <Field label="Due Date" required>
          <TextInput type="date" value={values.due_date} onChange={set('due_date')} />
        </Field>
        <Field label="Received Date" required>
          <TextInput type="date" value={values.received_date} onChange={set('received_date')} />
        </Field>
        <Field label="Owner" required>
          <SelectInput value={values.owner_user_id} onChange={set('owner_user_id')}>
            <option value="">Select owner…</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Status" required>
          <SelectInput value={values.status} onChange={set('status')}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </SelectInput>
        </Field>
      </FormGrid>
      <Field label="Description">
        <TextArea value={values.description || ''} onChange={set('description')} placeholder="Scope, materials, finish requirements…" />
      </Field>
    </Modal>
  );
}

export default function Rfqs() {
  const [rows, setRows] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  function load() {
    api.rfqs().then(setRows);
  }

  useEffect(() => {
    load();
    api.customers().then(setCustomers);
    api.users().then(setUsers);
  }, []);

  if (!rows) return <Layout title="RFQs"><Spinner /></Layout>;

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
        id: row.id, customer_id: row.customer_id, title: row.title, description: row.description || '',
        target_price: row.target_price ?? '', due_date: row.due_date, status: row.status,
        owner_user_id: row.owner_user_id, received_date: row.received_date,
      },
    });
  }

  async function handleSubmit(values) {
    setSaving(true);
    setFormError(null);
    try {
      if (modal.mode === 'create') {
        const created = await api.createRfq(values);
        setRows((prev) => [...prev, created].sort((a, b) => a.due_date.localeCompare(b.due_date)));
      } else {
        const updated = await api.updateRfq(modal.row.id, values);
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
      await api.deleteRfq(deleteRow.id);
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
      'anvil-rfqs.csv',
      ['Title', 'Customer', 'Target Price', 'Due Date', 'Status', 'Owner', 'Received', 'Quotes'],
      rows.map((r) => [r.title, r.customer_name, r.target_price, r.due_date, r.status, r.owner_name, r.received_date, r.quote_count])
    );
  }

  const cols = [
    { key: 'title', header: 'RFQ', render: (r) => <CellName primary={r.title} secondary={r.customer_name} /> },
    { key: 'target_price', header: 'Target Price', render: (r) => <span className="font-medium">{r.target_price ? money(r.target_price, true) : '—'}</span> },
    { key: 'due_date', header: 'Due', render: (r) => shortDate(r.due_date) },
    { key: 'quote_count', header: 'Quotes', render: (r) => r.quote_count },
    { key: 'owner_name', header: 'Owner', render: (r) => <Avatar name={r.owner_name} color={r.owner_color} size={24} /> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={TONE[r.status] || 'neutral'}>{r.status}</Badge> },
    {
      key: 'actions', header: '', className: 'w-20',
      render: (r) => <RowActions onEdit={() => openEdit(r)} onDelete={() => { setDeleteError(null); setDeleteRow(r); }} />,
    },
  ];

  return (
    <Layout
      title="RFQs"
      count={rows.length}
      actions={
        <>
          <Button variant="outline" onClick={handleExport}><Icon name="download" size={15} /> Export</Button>
          <Button onClick={openCreate}><Icon name="plus" size={15} /> New RFQ</Button>
        </>
      }
    >
      <Card>
        <Table cols={cols} rows={rows} />
      </Card>

      {modal && (
        <RfqForm
          initial={modal.initial}
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
          title="Delete RFQ"
          message={`Delete "${deleteRow.title}"? This cannot be undone.`}
          error={deleteError}
          busy={deleteBusy}
          onCancel={() => setDeleteRow(null)}
          onConfirm={handleDelete}
        />
      )}
    </Layout>
  );
}
