import { useEffect, useState } from 'react';
import api from '../api.js';
import Layout from '../components/Layout.jsx';
import {
  Card, Table, Badge, CellName, Avatar, Spinner, Button, Modal, ConfirmDialog,
  Field, TextInput, SelectInput, FormGrid, FormError, RowActions, Mono,
} from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { money, shortDate } from '../format.js';
import { downloadCsv } from '../csv.js';

const STATUS_OPTIONS = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'];
const TONE = { Draft: 'neutral', Sent: 'blue', Accepted: 'green', Rejected: 'rose', Expired: 'steel' };

const EMPTY = { rfq_id: '', customer_id: '', quote_number: '', total_amount: '', status: 'Draft', valid_until: '', owner_user_id: '' };

function QuoteForm({ initial, rfqs, customers, users, onCancel, onSubmit, saving, error }) {
  const [values, setValues] = useState(initial);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  function onRfqChange(e) {
    const rfqId = e.target.value;
    const rfq = rfqs.find((r) => String(r.id) === String(rfqId));
    setValues((v) => ({ ...v, rfq_id: rfqId, customer_id: rfq ? rfq.customer_id : v.customer_id }));
  }

  return (
    <Modal
      title={initial.id ? 'Edit Quote' : 'New Quote'}
      onClose={onCancel}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSubmit(values)} disabled={saving}>{saving ? 'Saving…' : 'Save Quote'}</Button>
        </>
      }
    >
      <FormError error={error} />
      <FormGrid>
        <Field label="Linked RFQ" hint="Optional — sets the customer automatically">
          <SelectInput value={values.rfq_id || ''} onChange={onRfqChange}>
            <option value="">No linked RFQ</option>
            {rfqs.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </SelectInput>
        </Field>
        <Field label="Customer" required>
          <SelectInput value={values.customer_id} onChange={set('customer_id')}>
            <option value="">Select customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Quote Number" required>
          <TextInput value={values.quote_number} onChange={set('quote_number')} placeholder="Q-2026-1000" className="font-mono" />
        </Field>
        <Field label="Total Amount" required>
          <TextInput type="number" min="0" step="100" value={values.total_amount} onChange={set('total_amount')} placeholder="113280" />
        </Field>
        <Field label="Valid Until" required>
          <TextInput type="date" value={values.valid_until} onChange={set('valid_until')} />
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
    </Modal>
  );
}

export default function Quotes() {
  const [rows, setRows] = useState(null);
  const [rfqs, setRfqs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  function load() {
    api.quotes().then(setRows);
  }

  useEffect(() => {
    load();
    api.rfqs().then(setRfqs);
    api.customers().then(setCustomers);
    api.users().then(setUsers);
  }, []);

  if (!rows) return <Layout title="Quotes"><Spinner /></Layout>;

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
        id: row.id, rfq_id: row.rfq_id || '', customer_id: row.customer_id, quote_number: row.quote_number,
        total_amount: row.total_amount, status: row.status, valid_until: row.valid_until, owner_user_id: row.owner_user_id,
      },
    });
  }

  async function handleSubmit(values) {
    setSaving(true);
    setFormError(null);
    try {
      const payload = { ...values, rfq_id: values.rfq_id || null };
      if (modal.mode === 'create') {
        const created = await api.createQuote(payload);
        setRows((prev) => [created, ...prev]);
      } else {
        const updated = await api.updateQuote(modal.row.id, payload);
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
      await api.deleteQuote(deleteRow.id);
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
      'anvil-quotes.csv',
      ['Quote #', 'Customer', 'RFQ', 'Total Amount', 'Status', 'Valid Until', 'Owner', 'BOM Lines', 'Work Orders'],
      rows.map((r) => [r.quote_number, r.customer_name, r.rfq_title || '', r.total_amount, r.status, r.valid_until, r.owner_name, r.bom_count, r.work_order_count])
    );
  }

  const cols = [
    { key: 'quote_number', header: 'Quote #', render: (r) => <CellName primary={<Mono>{r.quote_number}</Mono>} secondary={r.customer_name} /> },
    { key: 'rfq_title', header: 'RFQ', render: (r) => <span className="text-sm text-muted">{r.rfq_title || '—'}</span> },
    { key: 'total_amount', header: 'Total', render: (r) => <span className="font-medium">{money(r.total_amount, true)}</span> },
    { key: 'bom_count', header: 'BOM Lines', render: (r) => r.bom_count },
    { key: 'valid_until', header: 'Valid Until', render: (r) => shortDate(r.valid_until) },
    { key: 'owner_name', header: 'Owner', render: (r) => <Avatar name={r.owner_name} color={r.owner_color} size={24} /> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={TONE[r.status] || 'neutral'}>{r.status}</Badge> },
    {
      key: 'actions', header: '', className: 'w-20',
      render: (r) => <RowActions onEdit={() => openEdit(r)} onDelete={() => { setDeleteError(null); setDeleteRow(r); }} />,
    },
  ];

  return (
    <Layout
      title="Quotes"
      count={rows.length}
      actions={
        <>
          <Button variant="outline" onClick={handleExport}><Icon name="download" size={15} /> Export</Button>
          <Button onClick={openCreate}><Icon name="plus" size={15} /> New Quote</Button>
        </>
      }
    >
      <Card>
        <Table cols={cols} rows={rows} />
      </Card>

      {modal && (
        <QuoteForm
          initial={modal.initial}
          rfqs={rfqs}
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
          title="Delete Quote"
          message={`Delete quote ${deleteRow.quote_number}? This cannot be undone.`}
          error={deleteError}
          busy={deleteBusy}
          onCancel={() => setDeleteRow(null)}
          onConfirm={handleDelete}
        />
      )}
    </Layout>
  );
}
