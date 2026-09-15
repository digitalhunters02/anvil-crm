import { useEffect, useState } from 'react';
import api from '../api.js';
import Layout from '../components/Layout.jsx';
import { Card, CardHead, Kpi, Spinner, Badge, Table } from '../components/ui.jsx';
import ColBars from '../components/charts/ColBars.jsx';
import HBars from '../components/charts/HBars.jsx';
import Icon from '../components/Icon.jsx';
import { Button } from '../components/ui.jsx';
import { money, pct } from '../format.js';
import { downloadCsv } from '../csv.js';

const RESULT_TONE = { Pass: 'green', Fail: 'rose', 'Pending Rework': 'amber' };
const PO_TONE = { Draft: 'neutral', Sent: 'blue', Confirmed: 'amber', Received: 'green', Cancelled: 'rose' };

function monthLabel(m) {
  if (!m) return m;
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export default function Reports() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.reports().then(setData);
  }, []);

  if (!data) return <Layout title="Reports"><Spinner /></Layout>;

  const {
    winRate, wonRfqs, lostRfqs, totalRfqs, onTimeDeliveryRate, workOrdersCompleted, workOrdersOnHold,
    revenueByMonth, inspectionResults, revenueByCustomer, poStatusBreakdown, quoteAcceptRate,
  } = data;

  const revenueData = revenueByMonth.map((m) => ({ label: monthLabel(m.month), value: m.revenue }));
  const customerData = revenueByCustomer
    .filter((c) => c.revenue > 0)
    .slice(0, 8)
    .map((c) => ({ label: c.customer_name, value: c.revenue }));

  function exportRevenueByCustomer() {
    downloadCsv(
      'anvil-revenue-by-customer.csv',
      ['Customer', 'Industry', 'Revenue', 'Invoice Count'],
      revenueByCustomer.map((c) => [c.customer_name, c.industry, c.revenue, c.invoice_count])
    );
  }

  function exportPoStatus() {
    downloadCsv(
      'anvil-po-status-breakdown.csv',
      ['Status', 'Count', 'Total Amount'],
      poStatusBreakdown.map((p) => [p.status, p.count, p.amount])
    );
  }

  return (
    <Layout title="Reports">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi label="RFQ Win Rate" value={pct(winRate)} sub={`${wonRfqs} won / ${lostRfqs} lost of ${totalRfqs}`} tone="brand" icon="rfq" />
        <Kpi label="Quote Accept Rate" value={pct(quoteAcceptRate)} sub="Share of quotes accepted" tone="blue" icon="quote" />
        <Kpi label="On-Time Delivery" value={pct(onTimeDeliveryRate)} sub="Delivered shipments by due date" tone="green" icon="shipment" />
        <Kpi label="Work Orders On Hold" value={workOrdersOnHold} sub={`${workOrdersCompleted} completed to date`} tone="rose" icon="workOrder" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2 p-1">
          <CardHead title="Revenue by Month" sub="Invoiced amount, by issue month" />
          <div className="px-5 pb-5">
            {revenueData.length > 0
              ? <ColBars data={revenueData} height={220} formatValue={(v) => money(v, true)} />
              : <p className="text-sm text-muted py-10 text-center">No invoices yet.</p>}
          </div>
        </Card>

        <Card className="p-1">
          <CardHead title="Inspection Results" sub="All quality inspections" />
          <div className="px-5 pb-5 space-y-2.5">
            {inspectionResults.map((r) => (
              <div key={r.result} className="flex items-center justify-between">
                <Badge tone={RESULT_TONE[r.result] || 'neutral'}>{r.result}</Badge>
                <span className="text-sm font-medium text-ink">{r.count}</span>
              </div>
            ))}
            {inspectionResults.length === 0 && <p className="text-sm text-muted py-6 text-center">No inspections logged.</p>}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-1">
          <CardHead
            title="Revenue by Customer"
            sub="Top accounts by invoiced amount"
            action={<Button variant="outline" size="sm" onClick={exportRevenueByCustomer}><Icon name="download" size={13} /> Export</Button>}
          />
          <div className="px-5 pb-5">
            {customerData.length > 0
              ? <HBars data={customerData} formatValue={(v) => money(v, true)} />
              : <p className="text-sm text-muted py-10 text-center">No revenue recorded yet.</p>}
          </div>
        </Card>

        <Card className="p-1">
          <CardHead
            title="Purchase Order Status"
            sub="Open commitments with suppliers"
            action={<Button variant="outline" size="sm" onClick={exportPoStatus}><Icon name="download" size={13} /> Export</Button>}
          />
          <Table
            cols={[
              { key: 'status', header: 'Status', render: (r) => <Badge tone={PO_TONE[r.status] || 'neutral'}>{r.status}</Badge> },
              { key: 'count', header: 'Count', render: (r) => r.count },
              { key: 'amount', header: 'Total', render: (r) => <span className="font-medium">{money(r.amount, true)}</span> },
            ]}
            rows={poStatusBreakdown}
            keyField="status"
          />
        </Card>
      </div>
    </Layout>
  );
}
