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

const RESULT_OPTIONS = ['Pass', 'Fail', 'Pending Rework'];
const TONE = { Pass: 'green', Fail: 'rose', 'Pending Rework': 'amber' };

const EMPTY = { work_order_id: '', inspector_user_id: '', inspection_date: '', result: 'Pass', notes: '' };

function InspectionForm({ initial, workOrders, users, onCancel, onSubmit, saving, error }) {
  const [values, setValues] = useState(initial);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <Modal
      title={initial.id ? 'Edit Quality Inspection' : 'New Quality Inspection'}
      onClose={onCancel}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSubmit(values)} disabled={saving}>{saving ? 'Saving…' : 'Save Inspection'}</Button>
        </>
      }
    >
      <FormError error={error} />
      <FormGrid>
        <Field label="Work Order" required>
          <SelectInput value={values.work_order_id} onChange={set('work_order_id')}>
            <option value="">Select work order…</option>
            {workOrders.map((w) => <option key={w.id} value={w.id}>{w.work_order_number} — {w.customer_name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Inspector" required>
          <SelectInput value={values.inspector_user_id} onChange={set('inspector_user_id')}>
            <option value="">Select inspector…</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Inspection Date" required>
          <TextInput type="date" value={values.inspection_date} onChange={set('inspection_date')} />
        </Field>
        <Field label="Result" required>
          <SelectInput value={values.result} onChange={set('result')}>
            {RESULT_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </SelectInput>
        </Field>
      </FormGrid>
      <Field label="Notes">
        <TextArea value={values.notes || ''} onChange={set('notes')} placeholder="Inspection findings…" />
      </Field>
    </Modal>
  );
}

export default function QualityInspections() {
  const [rows, setRows] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  function load() {
    api.qualityInspections().then(setRows);
  }

  useEffect(() => {
    load();
    api.workOrders().then(setWorkOrders);
    api.users().then(setUsers);
  }, []);

  if (!rows) return <Layout title="Quality Inspections"><Spinner /></Layout>;

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
        id: row.id, work_order_id: row.work_order_id, inspector_user_id: row.inspector_user_id,
        inspection_date: row.inspection_date, result: row.result, notes: row.notes || '',
      },
    });
  }

  async function handleSubmit(values) {
    setSaving(true);
    setFormError(null);
    try {
      if (modal.mode === 'create') {
        const created = await api.createQualityInspection(values);
        setRows((prev) => [created, ...prev]);
      } else {
        const updated = await api.updateQualityInspection(modal.row.id, values);
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
      await api.deleteQualityInspection(deleteRow.id);
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
      'anvil-quality-inspections.csv',
      ['Work Order', 'Customer', 'Inspector', 'Inspection Date', 'Result', 'Notes'],
      rows.map((r) => [r.work_order_number, r.customer_name, r.inspector_name, r.inspection_date, r.result, r.notes || ''])
    );
  }

  const cols = [
    { key: 'work_order_number', header: 'Work Order', render: (r) => <CellName primary={<Mono>{r.work_order_number}</Mono>} secondary={r.customer_name} /> },
    { key: 'inspection_date', header: 'Date', render: (r) => shortDate(r.inspection_date) },
    { key: 'inspector_name', header: 'Inspector', render: (r) => <Avatar name={r.inspector_name} color={r.inspector_color} size={24} /> },
    { key: 'notes', header: 'Notes', render: (r) => <span className="text-sm text-muted truncate block max-w-xs">{r.notes || '—'}</span> },
    { key: 'result', header: 'Result', render: (r) => <Badge tone={TONE[r.result] || 'neutral'}>{r.result}</Badge> },
    {
      key: 'actions', header: '', className: 'w-20',
      render: (r) => <RowActions onEdit={() => openEdit(r)} onDelete={() => { setDeleteError(null); setDeleteRow(r); }} />,
    },
  ];

  return (
    <Layout
      title="Quality Inspections"
      count={rows.length}
      actions={
        <>
          <Button variant="outline" onClick={handleExport}><Icon name="download" size={15} /> Export</Button>
          <Button onClick={openCreate}><Icon name="plus" size={15} /> New Inspection</Button>
        </>
      }
    >
      <Card>
        <Table cols={cols} rows={rows} />
      </Card>

      {modal && (
        <InspectionForm
          initial={modal.initial}
          workOrders={workOrders}
          users={users}
          onCancel={() => setModal(null)}
          onSubmit={handleSubmit}
          saving={saving}
          error={formError}
        />
      )}

      {deleteRow && (
        <ConfirmDialog
          title="Delete Quality Inspection"
          message={`Delete this inspection for ${deleteRow.work_order_number}? This cannot be undone.`}
          error={deleteError}
          busy={deleteBusy}
          onCancel={() => setDeleteRow(null)}
          onConfirm={handleDelete}
        />
      )}
    </Layout>
  );
}
