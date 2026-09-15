import { useEffect, useRef, useState } from 'react';
import api from '../api.js';
import Layout from '../components/Layout.jsx';
import {
  Card, CardHead, Avatar, Badge, Spinner, Button, IconButton, Field, TextInput, TextArea,
} from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { downloadCsv } from '../csv.js';

const PROFILE_KEY = 'anvil-company-profile';
const LOGO_KEY = 'anvil-company-logo';
const NOTIF_KEY = 'anvil-notification-settings';

const DEFAULT_PROFILE = {
  name: 'Vanguard Fabrication Works',
  address: '2100 Industrial Hwy, Gary, IN 46402',
  phone: '(219) 555-0100',
  email: 'shop@vanguardfab.com',
  description: 'Structural steel and precision welded assemblies — forged from Gary steel since 1987.',
};

const NOTIFICATIONS = [
  { key: 'rfq_received', name: 'New RFQ received', desc: 'Notify sales engineers when a new RFQ comes in.' },
  { key: 'quote_accepted', name: 'Quote accepted', desc: 'Notify the account owner when a customer accepts a quote.' },
  { key: 'po_overdue', name: 'Purchase order overdue', desc: 'Alert purchasing when an expected delivery date passes.' },
  { key: 'inspection_failed', name: 'Inspection failed or needs rework', desc: 'Alert the shop foreman and quality manager.' },
  { key: 'invoice_overdue', name: 'Invoice overdue', desc: 'Alert finance when a customer invoice passes its due date.' },
];

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // best-effort persistence only
  }
}

export default function Settings() {
  const [users, setUsers] = useState(null);

  const [profile, setProfile] = useState(() => loadJson(PROFILE_KEY, DEFAULT_PROFILE));
  const [editingProfile, setEditingProfile] = useState(false);
  const [draftProfile, setDraftProfile] = useState(profile);
  const [profileSaved, setProfileSaved] = useState(false);

  const [logo, setLogo] = useState(null);
  const logoInputRef = useRef(null);

  const [notifications, setNotifications] = useState(() => {
    const defaults = Object.fromEntries(NOTIFICATIONS.map((n) => [n.key, true]));
    return loadJson(NOTIF_KEY, defaults);
  });

  useEffect(() => {
    api.users().then(setUsers);
    try {
      const savedLogo = localStorage.getItem(LOGO_KEY);
      if (savedLogo) setLogo(savedLogo);
    } catch {
      // ignore
    }
  }, []);

  function startEditProfile() {
    setDraftProfile(profile);
    setEditingProfile(true);
    setProfileSaved(false);
  }

  function cancelEditProfile() {
    setEditingProfile(false);
  }

  function saveProfile() {
    setProfile(draftProfile);
    saveJson(PROFILE_KEY, draftProfile);
    setEditingProfile(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  }

  function onPickLogo(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setLogo(dataUrl);
      try {
        localStorage.setItem(LOGO_KEY, dataUrl);
      } catch {
        // best-effort persistence only
      }
    };
    reader.readAsDataURL(file);
  }

  function toggleNotification(key) {
    setNotifications((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveJson(NOTIF_KEY, next);
      return next;
    });
  }

  async function exportEntity(name, fetcher, headers, mapper) {
    const rows = await fetcher();
    downloadCsv(`anvil-${name}.csv`, headers, rows.map(mapper));
  }

  const EXPORTS = [
    { label: 'Customers', run: () => exportEntity('customers', api.customers, ['Name', 'Industry', 'City', 'State', 'Status'], (r) => [r.name, r.industry, r.city, r.state, r.status]) },
    { label: 'RFQs', run: () => exportEntity('rfqs', api.rfqs, ['Title', 'Customer', 'Status', 'Due Date'], (r) => [r.title, r.customer_name, r.status, r.due_date]) },
    { label: 'Quotes', run: () => exportEntity('quotes', api.quotes, ['Quote #', 'Customer', 'Total', 'Status'], (r) => [r.quote_number, r.customer_name, r.total_amount, r.status]) },
    { label: 'Work Orders', run: () => exportEntity('work-orders', api.workOrders, ['Work Order #', 'Customer', 'Status', 'Due Date'], (r) => [r.work_order_number, r.customer_name, r.status, r.due_date]) },
    { label: 'Purchase Orders', run: () => exportEntity('purchase-orders', api.purchaseOrders, ['PO #', 'Supplier', 'Status', 'Total'], (r) => [r.po_number, r.supplier_name, r.status, r.total_amount]) },
    { label: 'Invoices', run: () => exportEntity('invoices', api.invoices, ['Invoice #', 'Customer', 'Amount', 'Status'], (r) => [r.invoice_number, r.customer_name, r.amount, r.status]) },
  ];

  return (
    <Layout title="Settings">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-1">
          <CardHead
            title="Company Profile"
            action={editingProfile ? null : <IconButton icon="pencil" title="Edit profile" onClick={startEditProfile} />}
          />
          <div className="px-5 pb-5 text-sm">
            <div className="flex items-center gap-3 mb-4">
              <button
                type="button"
                onClick={() => logoInputRef.current && logoInputRef.current.click()}
                className="relative w-14 h-14 rounded-lg bg-wash border border-line flex items-center justify-center overflow-hidden flex-shrink-0 group"
                title="Upload logo"
              >
                {logo ? (
                  <img src={logo} alt="Company logo" className="w-full h-full object-cover" />
                ) : (
                  <Icon name="anvil" size={22} stroke="#93969a" />
                )}
                <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Icon name="camera" size={14} stroke="#fff" />
                  </span>
                </span>
              </button>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={onPickLogo} />
              <p className="text-xs text-muted">Click the mark to upload a company logo.</p>
            </div>
            {!editingProfile && (
              <div className="space-y-2.5">
                <p className="font-head uppercase tracking-wide font-semibold text-ink">{profile.name}</p>
                <p className="text-muted flex items-center gap-2"><Icon name="supplier" size={14} /> {profile.address}</p>
                <p className="text-muted flex items-center gap-2"><Icon name="phoneCall" size={14} /> {profile.phone}</p>
                <p className="text-muted flex items-center gap-2"><Icon name="mail" size={14} /> {profile.email}</p>
                <p className="text-muted flex items-center gap-2"><Icon name="anvil" size={14} /> {profile.description}</p>
                {profileSaved && (
                  <p className="text-sm text-green bg-greenTint border border-green/30 rounded-md px-3 py-2 flex items-center gap-1.5">
                    <Icon name="check" size={14} /> Profile saved.
                  </p>
                )}
              </div>
            )}
            {editingProfile && (
              <div>
                <Field label="Company Name">
                  <TextInput value={draftProfile.name} onChange={(e) => setDraftProfile((v) => ({ ...v, name: e.target.value }))} />
                </Field>
                <Field label="Address">
                  <TextInput value={draftProfile.address} onChange={(e) => setDraftProfile((v) => ({ ...v, address: e.target.value }))} />
                </Field>
                <Field label="Phone">
                  <TextInput value={draftProfile.phone} onChange={(e) => setDraftProfile((v) => ({ ...v, phone: e.target.value }))} />
                </Field>
                <Field label="Email">
                  <TextInput value={draftProfile.email} onChange={(e) => setDraftProfile((v) => ({ ...v, email: e.target.value }))} />
                </Field>
                <Field label="Description">
                  <TextArea value={draftProfile.description} onChange={(e) => setDraftProfile((v) => ({ ...v, description: e.target.value }))} />
                </Field>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={cancelEditProfile}>Cancel</Button>
                  <Button size="sm" onClick={saveProfile}>Save</Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-1">
          <CardHead title="Team" sub={users ? `${users.length} people` : ''} />
          <div className="divide-y divide-lineSoft max-h-[420px] overflow-y-auto">
            {!users && <Spinner />}
            {users && users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={u.name} color={u.color} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{u.name}</p>
                  <p className="text-xs text-muted">{u.email}</p>
                </div>
                <Badge tone="neutral">{u.role}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-1 lg:col-span-2">
          <CardHead title="Notifications" sub="Stored locally in this browser" />
          <div className="divide-y divide-lineSoft">
            {NOTIFICATIONS.map((n) => {
              const on = notifications[n.key] !== false;
              return (
                <div key={n.key} className="flex items-center justify-between px-5 py-3.5 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{n.name}</p>
                    <p className="text-xs text-muted mt-0.5">{n.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleNotification(n.key)}
                    className={`flex-shrink-0 relative w-10 h-6 rounded-full transition-colors ${on ? 'bg-brand' : 'bg-wash border border-line'}`}
                  >
                    <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: on ? '18px' : '2px' }} />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-1 lg:col-span-2">
          <CardHead title="Data Export" sub="Download CSV snapshots of core records" />
          <div className="px-5 pb-5 flex flex-wrap gap-2">
            {EXPORTS.map((e) => (
              <Button key={e.label} variant="outline" size="sm" onClick={e.run}>
                <Icon name="download" size={13} /> {e.label}
              </Button>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
