import { useEffect, useState } from 'react';
import api from '../api.js';
import Layout from '../components/Layout.jsx';
import {
  Card, Table, Badge, CellName, Avatar, Spinner, Button, Modal, ConfirmDialog,
  Field, TextInput, TextArea, SelectInput, FormGrid, FormError, RowActions,
} from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { downloadCsv } from '../csv.js';

const TONE = { Active: 'green', Prospect: 'blue', Inactive: 'neutral' };
const STATUS_OPTIONS = ['Active', 'Prospect', 'Inactive'];

const EMPTY = {
  name: '', industry: '', address: '', city: '', state: '',
  contact_name: '', contact_email: '', contact_phone: '',
  owner_user_id: '', status: 'Prospect', notes: '',
};

function CustomerForm({ initial, users, onCancel, onSubmit, saving, error }) {
  const [values, setValues] = useState(initial);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <Modal
      title={initial.id ? 'Edit Customer' : 'New Customer'}
      onClose={onCancel}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSubmit(values)} disabled={saving}>{saving ? 'Saving…' : 'Save Customer'}</Button>
        </>
      }
    >
      <FormError error={error} />
      <FormGrid>
        <Field label="Company Name" required>
          <TextInput value={values.name} onChange={set('name')} placeholder="Continental Bridge & Iron" />
        </Field>
        <Field label="Industry" required>
          <TextInput value={values.industry} onChange={set('industry')} placeholder="Construction" />
        </Field>
        <Field label="Address" required>
          <TextInput value={values.address} onChange={set('address')} placeholder="1180 Broadway Ave" />
        </Field>
        <Field label="City" required>
          <TextInput value={values.city} onChange={set('city')} placeholder="Gary" />
        </Field>
        <Field label="State" required>
          <TextInput value={values.state} onChange={set('state')} placeholder="IN" maxLength={2} />
        </Field>
        <Field label="Account Owner" required>
          <SelectInput value={values.owner_user_id} onChange={set('owner_user_id')}>
            <option value="">Select owner…</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Primary Contact" required>
          <TextInput value={values.contact_name} onChange={set('contact_name')} placeholder="Grace Ferraro" />
        </Field>
        <Field label="Contact Email" required>
          <TextInput type="email" value={values.contact_email} onChange={set('contact_email')} placeholder="grace.ferraro@example.com" />
        </Field>
        <Field label="Contact Phone" required>
          <TextInput value={values.contact_phone} onChange={set('contact_phone')} placeholder="(219) 555-0118" />
        </Field>
        <Field label="Status" required>
          <SelectInput value={values.status} onChange={set('status')}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </SelectInput>
        </Field>
      </FormGrid>
      <Field label="Notes">
        <TextArea value={values.notes || ''} onChange={set('notes')} placeholder="Account notes…" />
      </Field>
    </Modal>
  );
}

export default function Customers() {
  const [rows, setRows] = useState(null);
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  function load() {
    api.customers().then(setRows);
  }

  useEffect(() => {
    load();
    api.users().then(setUsers);
  }, []);

  if (!rows) return <Layout title="Customers"><Spinner /></Layout>;

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
        id: row.id, name: row.name, industry: row.industry, address: row.address, city: row.city, state: row.state,
        contact_name: row.contact_name, contact_email: row.contact_email, contact_phone: row.contact_phone,
        owner_user_id: row.owner_user_id, status: row.status, notes: row.notes || '',
      },
    });
  }

  async function handleSubmit(values) {
    setSaving(true);
    setFormError(null);
    try {
      if (modal.mode === 'create') {
        const created = await api.createCustomer(values);
        setRows((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const updated = await api.updateCustomer(modal.row.id, values);
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
      await api.deleteCustomer(deleteRow.id);
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
      'anvil-customers.csv',
      ['Name', 'Industry', 'City', 'State', 'Contact', 'Email', 'Phone', 'RFQs', 'Work Orders', 'Owner', 'Status'],
      rows.map((r) => [r.name, r.industry, r.city, r.state, r.contact_name, r.contact_email, r.contact_phone, r.rfq_count, r.work_order_count, r.owner_name, r.status])
    );
  }

  const cols = [
    { key: 'name', header: 'Customer', render: (r) => <CellName primary={r.name} secondary={`${r.city}, ${r.state}`} /> },
    { key: 'industry', header: 'Industry', render: (r) => <span className="text-sm text-muted">{r.industry}</span> },
    { key: 'contact_name', header: 'Primary Contact', render: (r) => <span className="text-sm text-ink">{r.contact_name}</span> },
    { key: 'rfq_count', header: 'RFQs', render: (r) => r.rfq_count },
    { key: 'work_order_count', header: 'Work Orders', render: (r) => r.work_order_count },
    { key: 'owner_name', header: 'Owner', render: (r) => <Avatar name={r.owner_name} color={r.owner_color} size={24} /> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={TONE[r.status] || 'neutral'}>{r.status}</Badge> },
    {
      key: 'actions', header: '', className: 'w-20',
      render: (r) => <RowActions onEdit={() => openEdit(r)} onDelete={() => { setDeleteError(null); setDeleteRow(r); }} />,
    },
  ];

  return (
    <Layout
      title="Customers"
      count={rows.length}
      actions={
        <>
          <Button variant="outline" onClick={handleExport}><Icon name="download" size={15} /> Export</Button>
          <Button onClick={openCreate}><Icon name="plus" size={15} /> New Customer</Button>
        </>
      }
    >
      <Card>
        <Table cols={cols} rows={rows} />
      </Card>

      {modal && (
        <CustomerForm
          initial={modal.initial}
          users={users}
          onCancel={() => setModal(null)}
          onSubmit={handleSubmit}
          saving={saving}
          error={formError}
        />
      )}

      {deleteRow && (
        <ConfirmDialog
          title="Delete Customer"
          message={`Delete ${deleteRow.name}? This cannot be undone.`}
          error={deleteError}
          busy={deleteBusy}
          onCancel={() => setDeleteRow(null)}
          onConfirm={handleDelete}
        />
      )}
    </Layout>
  );
}
