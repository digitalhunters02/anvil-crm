import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Rfqs from './pages/Rfqs.jsx';
import Quotes from './pages/Quotes.jsx';
import Customers from './pages/Customers.jsx';
import WorkOrders from './pages/WorkOrders.jsx';
import BillOfMaterials from './pages/BillOfMaterials.jsx';
import QualityInspections from './pages/QualityInspections.jsx';
import Suppliers from './pages/Suppliers.jsx';
import PurchaseOrders from './pages/PurchaseOrders.jsx';
import Shipments from './pages/Shipments.jsx';
import Invoices from './pages/Invoices.jsx';
import Automations from './pages/Automations.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/rfqs" element={<Rfqs />} />
      <Route path="/quotes" element={<Quotes />} />
      <Route path="/customers" element={<Customers />} />
      <Route path="/work-orders" element={<WorkOrders />} />
      <Route path="/bill-of-materials" element={<BillOfMaterials />} />
      <Route path="/quality-inspections" element={<QualityInspections />} />
      <Route path="/suppliers" element={<Suppliers />} />
      <Route path="/purchase-orders" element={<PurchaseOrders />} />
      <Route path="/shipments" element={<Shipments />} />
      <Route path="/invoices" element={<Invoices />} />
      <Route path="/automations" element={<Automations />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
