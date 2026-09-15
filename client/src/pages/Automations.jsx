import { useEffect, useState } from 'react';
import api from '../api.js';
import Layout from '../components/Layout.jsx';
import {
  Card, CardHead, Spinner, Button, Modal, ConfirmDialog, IconButton,
  Field, TextInput, TextArea, FormGrid, FormError,
} from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

const EMPTY = { name: '', trigger_desc: '', action_desc: '' };

function AutomationForm({ onCancel, onSubmit, saving, error }) {
  const [values, setValues] = useState(EMPTY);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <Modal
      title="New Automation"
      onClose={onCancel}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSubmit(values)} disabled={saving}>{saving ? 'Saving…' : 'Save Automation'}</Button>
        </>
      }
    >
      <FormError error={error} />
      <FormGrid>
        <Field label="Name" required>
          <TextInput value={values.name} onChange={set('name')} placeholder="Overdue PO Alert" />
        </Field>
      </FormGrid>
      <Field label="Trigger" required>
        <TextArea value={values.trigger_desc} onChange={set('trigger_desc')} placeholder="What condition fires this automation…" />
      </Field>
      <Field label="Action" required>
        <TextArea value={values.action_desc} onChange={set('action_desc')} placeholder="What happens when it fires…" />
      </Field>
    </Modal>
  );
}

export default function Automations() {
  const [rows, setRows] = useState(null);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  function load() {
    api.automations().then(setRows);
  }

  useEffect(load, []);

  if (!rows) return <Layout title="Automations"><Spinner /></Layout>;

  async function toggle(a) {
    setBusyId(a.id);
    setRows((prev) => prev.map((r) => (r.id === a.id ? { ...r, active: a.active ? 0 : 1 } : r)));
    try {
      await api.setAutomationActive(a.id, !a.active);
    } catch {
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreate(values) {
    setSaving(true);
    setFormError(null);
    try {
      const created = await api.createAutomation(values);
      setRows((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setModal(false);
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
      await api.deleteAutomation(deleteRow.id);
      setRows((prev) => prev.filter((r) => r.id !== deleteRow.id));
      setDeleteRow(null);
    } catch (e) {
      setDeleteError(e.message);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <Layout
      title="Automations"
      count={rows.length}
      actions={<Button onClick={() => { setFormError(null); setModal(true); }}><Icon name="plus" size={15} /> New Automation</Button>}
    >
      <Card className="p-1">
        <CardHead title="Automation Rules" sub="Lightweight rules that fire on RFQ, quote, work order and PO events" />
        <div className="divide-y divide-lineSoft">
          {rows.map((a) => (
            <div key={a.id} className="flex items-center gap-4 px-5 py-4">
              <span className="rounded-lg p-2 flex-shrink-0" style={{ background: a.active ? '#f5dcd8' : '#e6e5e0', color: a.active ? '#8f251d' : '#5b5e62' }}>
                <Icon name="automation" size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{a.name}</p>
                <p className="text-xs text-muted mt-0.5"><span className="font-medium text-ink">If:</span> {a.trigger_desc}</p>
                <p className="text-xs text-muted mt-0.5"><span className="font-medium text-ink">Then:</span> {a.action_desc}</p>
              </div>
              <p className="text-xs text-muted flex-shrink-0 hidden sm:block">{a.runs_30d} runs / 30d</p>
              <button
                type="button"
                disabled={busyId === a.id}
                onClick={() => toggle(a)}
                className={`flex-shrink-0 relative w-10 h-6 rounded-full transition-colors ${a.active ? 'bg-brand' : 'bg-wash border border-line'}`}
                title={a.active ? 'Disable' : 'Enable'}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                  style={{ left: a.active ? '18px' : '2px' }}
                />
              </button>
              <IconButton icon="trash" tone="danger" title="Delete" onClick={() => { setDeleteError(null); setDeleteRow(a); }} />
            </div>
          ))}
          {rows.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted">No automations configured yet.</p>}
        </div>
      </Card>

      {modal && (
        <AutomationForm onCancel={() => setModal(false)} onSubmit={handleCreate} saving={saving} error={formError} />
      )}

      {deleteRow && (
        <ConfirmDialog
          title="Delete Automation"
          message={`Delete "${deleteRow.name}"? This cannot be undone.`}
          error={deleteError}
          busy={deleteBusy}
          onCancel={() => setDeleteRow(null)}
          onConfirm={handleDelete}
        />
      )}
    </Layout>
  );
}
