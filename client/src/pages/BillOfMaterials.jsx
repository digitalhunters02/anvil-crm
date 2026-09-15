import { useEffect, useState } from 'react';
import api from '../api.js';
import Layout from '../components/Layout.jsx';
import {
  Card, Table, CellName, Spinner, Button, Modal, ConfirmDialog,
  Field, TextInput, TextArea, SelectInput, FormGrid, FormError, RowActions, Mono,
} from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { money } from '../format.js';
import { downloadCsv } from '../csv.js';

const UOM_OPTIONS = ['ea', 'ft', 'sheet', 'kit', 'spool', 'sqft', 'lb', 'in'];

const EMPTY = { quote_id: '', part_name: '', material: '', quantity: '', unit_of_measure: 'ea', unit_cost: '', notes: '' };

function BomForm({ initial, quotes, onCancel, onSubmit, saving, error }) {
  const [values, setValues] = useState(initial);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <Modal
      title={initial.id ? 'Edit BOM Line Item' : 'New BOM Line Item'}
      onClose={onCancel}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSubmit(values)} disabled={saving}>{saving ? 'Saving…' : 'Save Line Item'}</Button>
        </>
      }
    >
      <FormError error={error} />
      <FormGrid>
        <Field label="Quote" required>
          <SelectInput value={values.quote_id} onChange={set('quote_id')}>
            <option value="">Select quote…</option>
            {quotes.map((q) => <option key={q.id} value={q.id}>{q.quote_number} — {q.customer_name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Part Name" required>
          <TextInput value={values.part_name} onChange={set('part_name')} placeholder="A36 Steel Plate, 1/2in" />
        </Field>
        <Field label="Material" required>
          <TextInput value={values.material} onChange={set('material')} placeholder="A36 Steel Plate" />
        </Field>
        <Field label="Quantity" required>
          <TextInput type="number" min="0" step="1" value={values.quantity} onChange={set('quantity')} placeholder="20" />
        </Field>
        <Field label="Unit of Measure" required>
          <SelectInput value={values.unit_of_measure} onChange={set('unit_of_measure')}>
            {UOM_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
          </SelectInput>
        </Field>
        <Field label="Unit Cost" required>
          <TextInput type="number" min="0" step="0.01" value={values.unit_cost} onChange={set('unit_cost')} placeholder="38.50" />
        </Field>
      </FormGrid>
      <Field label="Notes">
        <TextArea value={values.notes || ''} onChange={set('notes')} placeholder="Sourcing or spec notes…" />
      </Field>
    </Modal>
  );
}

export default function BillOfMaterials() {
  const [rows, setRows] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  function load() {
    api.bom().then(setRows);
  }

  useEffect(() => {
    load();
    api.quotes().then(setQuotes);
  }, []);

  if (!rows) return <Layout title="Bill of Materials"><Spinner /></Layout>;

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
        id: row.id, quote_id: row.quote_id, part_name: row.part_name, material: row.material,
        quantity: row.quantity, unit_of_measure: row.unit_of_measure, unit_cost: row.unit_cost, notes: row.notes || '',
      },
    });
  }

  async function handleSubmit(values) {
    setSaving(true);
    setFormError(null);
    try {
      if (modal.mode === 'create') {
        const created = await api.createBom(values);
        setRows((prev) => [created, ...prev]);
      } else {
        const updated = await api.updateBom(modal.row.id, values);
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
      await api.deleteBom(deleteRow.id);
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
      'anvil-bill-of-materials.csv',
      ['Part Name', 'Material', 'Quantity', 'UOM', 'Unit Cost', 'Line Total', 'Quote', 'Customer'],
      rows.map((r) => [r.part_name, r.material, r.quantity, r.unit_of_measure, r.unit_cost, (r.quantity * r.unit_cost).toFixed(2), r.quote_number, r.customer_name])
    );
  }

  const cols = [
    { key: 'part_name', header: 'Part', render: (r) => <CellName primary={r.part_name} secondary={r.material} /> },
    { key: 'quote_number', header: 'Quote', render: (r) => <span className="text-sm"><Mono>{r.quote_number}</Mono></span> },
    { key: 'customer_name', header: 'Customer', render: (r) => <span className="text-sm text-muted">{r.customer_name}</span> },
    { key: 'quantity', header: 'Qty', render: (r) => <span>{r.quantity} <span className="text-faint">{r.unit_of_measure}</span></span> },
    { key: 'unit_cost', header: 'Unit Cost', render: (r) => money(r.unit_cost) },
    { key: 'line_total', header: 'Line Total', render: (r) => <span className="font-medium">{money(r.quantity * r.unit_cost)}</span> },
    {
      key: 'actions', header: '', className: 'w-20',
      render: (r) => <RowActions onEdit={() => openEdit(r)} onDelete={() => { setDeleteError(null); setDeleteRow(r); }} />,
    },
  ];

  return (
    <Layout
      title="Bill of Materials"
      count={rows.length}
      actions={
        <>
          <Button variant="outline" onClick={handleExport}><Icon name="download" size={15} /> Export</Button>
          <Button onClick={openCreate}><Icon name="plus" size={15} /> New Line Item</Button>
        </>
      }
    >
      <Card>
        <Table cols={cols} rows={rows} />
      </Card>

      {modal && (
        <BomForm
          initial={modal.initial}
          quotes={quotes}
          onCancel={() => setModal(null)}
          onSubmit={handleSubmit}
          saving={saving}
          error={formError}
        />
      )}

      {deleteRow && (
        <ConfirmDialog
          title="Delete BOM Line Item"
          message={`Delete "${deleteRow.part_name}"? This cannot be undone.`}
          error={deleteError}
          busy={deleteBusy}
          onCancel={() => setDeleteRow(null)}
          onConfirm={handleDelete}
        />
      )}
    </Layout>
  );
}
