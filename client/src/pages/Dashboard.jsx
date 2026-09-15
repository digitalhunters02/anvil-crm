import { useEffect, useState } from 'react';
import api from '../api.js';
import Layout from '../components/Layout.jsx';
import { Card, CardHead, Kpi, Spinner, Badge, Avatar, Mono } from '../components/ui.jsx';
import ColBars from '../components/charts/ColBars.jsx';
import Icon from '../components/Icon.jsx';
import { money, shortDate } from '../format.js';

const STATUS_COLOR = {
  Queued: '#93969a',
  'In Fabrication': '#1d5c8a',
  'In Welding': '#8a6a1a',
  'Quality Inspection': '#6a4a8a',
  'Ready to Ship': '#2f6b3a',
  Completed: '#43494f',
  'On Hold': '#b3261e',
};

const ACT_ICON = { Call: 'phoneCall', Email: 'mail', Meeting: 'customers', Task: 'flag' };

const WO_STATUS_TONE = {
  Queued: 'neutral', 'In Fabrication': 'blue', 'In Welding': 'amber',
  'Quality Inspection': 'violet', 'Ready to Ship': 'green', Completed: 'steel', 'On Hold': 'rose',
};

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.dashboard().then(setData);
  }, []);

  if (!data) return <Layout title="Dashboard"><Spinner /></Layout>;

  const { kpis, workOrdersByStatus, workOrdersDueSoon, recentActivity, posAwaiting } = data;
  const statusOrder = ['Queued', 'In Fabrication', 'In Welding', 'Quality Inspection', 'On Hold', 'Ready to Ship', 'Completed'];
  const statusData = statusOrder
    .map((s) => workOrdersByStatus.find((w) => w.status === s))
    .filter(Boolean)
    .map((w) => ({ label: w.status, value: w.count, color: STATUS_COLOR[w.status] }));

  return (
    <Layout title="Dashboard">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Kpi label="Open RFQs" value={kpis.openRfqs} sub="Awaiting first quote" tone="brand" icon="rfq" />
        <Kpi label="Quotes Awaiting" value={kpis.quotesAwaiting} sub="Sent, not yet decided" tone="amber" icon="quote" />
        <Kpi label="Work Orders in Production" value={kpis.workOrdersInProduction} sub="Queued through inspection" tone="blue" icon="workOrder" />
        <Kpi label="POs Awaiting Delivery" value={kpis.posAwaitingDelivery} sub="Sent or confirmed" tone="violet" icon="purchaseOrder" />
        <Kpi label="Revenue This Month" value={money(kpis.revenueThisMonth, true)} sub="Invoiced since Sep 1" tone="green" icon="invoice" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2 p-1">
          <CardHead title="Work Orders by Status" sub="Live shop-floor snapshot" />
          <div className="px-5 pb-5">
            <ColBars data={statusData} height={220} formatValue={(v) => v} />
          </div>
        </Card>

        <Card className="p-1">
          <CardHead title="Recent Activity" sub="Latest logged events" />
          <div className="px-5 pb-4 space-y-3 max-h-[260px] overflow-y-auto">
            {recentActivity.length === 0 && <p className="text-sm text-muted py-6 text-center">Nothing logged yet.</p>}
            {recentActivity.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5">
                <span className="mt-0.5 text-muted"><Icon name={ACT_ICON[a.type] || 'flag'} size={14} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink leading-snug truncate">{a.subject}</p>
                  <p className="text-xs text-muted">{shortDate(a.occurred_at.slice(0, 10))}</p>
                </div>
                <Avatar name={a.owner_name} color={a.owner_color} size={22} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-1">
          <CardHead title="Work Orders Due Soon" sub="Not yet completed" />
          <div className="divide-y divide-lineSoft">
            {workOrdersDueSoon.map((w) => (
              <div key={w.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate"><Mono>{w.work_order_number}</Mono> &middot; {w.customer_name}</p>
                  <p className="text-xs text-muted">Due {shortDate(w.due_date)}</p>
                </div>
                <Badge tone={WO_STATUS_TONE[w.status] || 'neutral'}>{w.status}</Badge>
              </div>
            ))}
            {workOrdersDueSoon.length === 0 && <p className="text-sm text-muted py-6 text-center">No open work orders.</p>}
          </div>
        </Card>

        <Card className="p-1">
          <CardHead title="Purchase Orders Awaiting Delivery" sub="Sent or confirmed with a supplier" />
          <div className="divide-y divide-lineSoft">
            {posAwaiting.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate"><Mono>{p.po_number}</Mono> &middot; {p.supplier_name}</p>
                  <p className="text-xs text-muted">Expected {shortDate(p.expected_date)} &middot; {money(p.total_amount, true)}</p>
                </div>
                <Badge tone={p.status === 'Confirmed' ? 'blue' : 'amber'}>{p.status}</Badge>
              </div>
            ))}
            {posAwaiting.length === 0 && <p className="text-sm text-muted py-6 text-center">No purchase orders pending delivery.</p>}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
