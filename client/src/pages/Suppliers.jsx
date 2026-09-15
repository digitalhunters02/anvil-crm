import { useEffect, useState } from 'react';
import api from '../api.js';
import Layout from '../components/Layout.jsx';
import {
  Card, Table, CellName, Spinner, Button, Modal, ConfirmDialog,
  Field, TextInput, TextArea, FormGrid, FormError, RowActions,
} from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { downloadCsv } from '../csv.js';

const EMPTY = { name: '', specialty: '', contact_name: '', contact_email: '', contact_phone: '', lead_time_days: '', notes: '' };

function SupplierForm({ initial, onCancel, onSubmit, saving, error }) {
  const [values, setValues] = useState(initial);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <Modal
      title={initial.id ? 'Edit Supplier' : 'New Supplier'}
      onClose={onCancel}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSubmit(values)} disabled={saving}>{saving ? 'Saving…' : 'Save Supplier'}</Button>
        </>
      }
    >
      <FormError error={error} />
      <FormGrid>
        <Field label="Supplier Name" required>
          <TextInput value={values.name} onChange={set('name')} placeholder="Heartland Steel Supply" />
        </Field>
        <Field label="Specialty" required>
          <TextInput value={values.specialty} onChange={set('specialty')} placeholder="Steel Plate & Bar" />
        </Field>
        <Field label="Contact Name" required>
          <TextInput value={values.contact_name} onChange={set('contact_name')} placeholder="Nora Fitzgerald" />
        </Field>
        <Field label="Contact Email" required>
          <TextInput type="email" value={values.contact_email} onChange={set('contact_email')} placeholder="nora.fitzgerald@example.com" />
        </Field>
        <Field label="Contact Phone" required>
          <TextInput value={values.contact_phone} onChange={set('contact_phone')} placeholder="(219) 555-0210" />
        </Field>
        <Field label="Lead Time (days)" required>
          <TextInput type="number" min="0" step="1" value={values.lead_time_days} onChange={set('lead_time_days')} placeholder="10" />
        </Field>
      </FormGrid>
      <Field label="Notes">
        <TextArea value={values.notes || ''} onChange={set('notes')} placeholder="Vendor notes…" />
      </Field>
    </Modal>
  );
}

export default function Suppliers() {
  const [rows, setRows] = useState(null);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  function load() {
    api.suppliers().then(setRows);
  }

  useEffect(load, []);

  if (!rows) return <Layout title="Suppliers"><Spinner /></Layout>;

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
        id: row.id, name: row.name, specialty: row.specialty, contact_name: row.contact_name,
        contact_email: row.contact_email, contact_phone: row.contact_phone, lead_time_days: row.lead_time_days, notes: row.notes || '',
      },
    });
  }

  async function handleSubmit(values) {
    setSaving(true);
    setFormError(null);
    try {
      if (modal.mode === 'create') {
        const created = await api.createSupplier(values);
        setRows((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const updated = await api.updateSupplier(modal.row.id, values);
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
      await api.deleteSupplier(deleteRow.id);
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
      'anvil-suppliers.csv',
      ['Name', 'Specialty', 'Contact', 'Email', 'Phone', 'Lead Time (days)', 'Open POs'],
      rows.map((r) => [r.name, r.specialty, r.contact_name, r.contact_email, r.contact_phone, r.lead_time_days, r.po_count])
    );
  }

  const cols = [
    { key: 'name', header: 'Supplier', render: (r) => <CellName primary={r.name} secondary={r.specialty} /> },
    { key: 'contact_name', header: 'Contact', render: (r) => <span className="text-sm text-ink">{r.contact_name}</span> },
    { key: 'contact_phone', header: 'Phone', render: (r) => <span className="text-sm text-muted">{r.contact_phone}</span> },
    { key: 'lead_time_days', header: 'Lead Time', render: (r) => <span>{r.lead_time_days} days</span> },
    { key: 'po_count', header: 'Purchase Orders', render: (r) => r.po_count },
    {
      key: 'actions', header: '', className: 'w-20',
      render: (r) => <RowActions onEdit={() => openEdit(r)} onDelete={() => { setDeleteError(null); setDeleteRow(r); }} />,
    },
  ];

  return (
    <Layout
      title="Suppliers"
      count={rows.length}
      actions={
        <>
          <Button variant="outline" onClick={handleExport}><Icon name="download" size={15} /> Export</Button>
          <Button onClick={openCreate}><Icon name="plus" size={15} /> New Supplier</Button>
        </>
      }
    >
      <Card>
        <Table cols={cols} rows={rows} />
      </Card>

      {modal && (
        <SupplierForm
          initial={modal.initial}
          onCancel={() => setModal(null)}
          onSubmit={handleSubmit}
          saving={saving}
          error={formError}
        />
      )}

      {deleteRow && (
        <ConfirmDialog
          title="Delete Supplier"
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
