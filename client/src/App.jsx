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
import WhatsApp from './pages/WhatsApp.jsx';
import Login from './pages/Login.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import { Terms, Privacy } from './pages/Legal.jsx';
import Inventory from './pages/Inventory.jsx';
import Shortages from './pages/Shortages.jsx';
import Costing from './pages/Costing.jsx';
import ProductionCalendar from './pages/ProductionCalendar.jsx';
import PlanGate from './plans/PlanGate.jsx';
import { useAuth } from './auth/AuthContext.jsx';
import ForcedPasswordChange from './auth/ForcedPasswordChange.jsx';
import { useT } from './auth/i18n.js';

export default function App() {
  const { token, account, checking } = useAuth();
  const { t } = useT();

  if (checking) {
    return <div className="min-h-[100dvh] flex items-center justify-center text-sm text-muted">{t('loading')}</div>;
  }

  // Signed out: only the sign-in flow and the legal pages are reachable.
  if (!token) {
    return (
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  // Owner issued a temporary password: it must be replaced before anything else.
  if (account?.mustChangePassword) return <ForcedPasswordChange />;

  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/" element={<Dashboard />} />
      <Route path="/rfqs" element={<PlanGate feature="rfqs" title="RFQs"><Rfqs /></PlanGate>} />
      <Route path="/quotes" element={<Quotes />} />
      <Route path="/customers" element={<Customers />} />
      <Route path="/work-orders" element={<PlanGate feature="work_orders" title="Work Orders"><WorkOrders /></PlanGate>} />
      <Route path="/bill-of-materials" element={<PlanGate feature="bill_of_materials" title="Bill of Materials"><BillOfMaterials /></PlanGate>} />
      <Route path="/quality-inspections" element={<PlanGate feature="quality_inspections" title="Quality Inspections"><QualityInspections /></PlanGate>} />
      <Route path="/inventory" element={<PlanGate feature="inventory" title="Inventory"><Inventory /></PlanGate>} />
      <Route path="/shortages" element={<PlanGate feature="mrp" title="Shortages & Buying"><Shortages /></PlanGate>} />
      <Route path="/costing" element={<PlanGate feature="job_costing" title="Job Costing"><Costing /></PlanGate>} />
      <Route path="/calendar" element={<PlanGate feature="production_calendar" title="Production Calendar"><ProductionCalendar /></PlanGate>} />
      <Route path="/suppliers" element={<Suppliers />} />
      <Route path="/purchase-orders" element={<PlanGate feature="purchase_orders" title="Purchase Orders"><PurchaseOrders /></PlanGate>} />
      <Route path="/shipments" element={<PlanGate feature="shipments" title="Shipments"><Shipments /></PlanGate>} />
      <Route path="/invoices" element={<Invoices />} />
      <Route path="/automations" element={<PlanGate feature="automations" title="Automations"><Automations /></PlanGate>} />
      <Route path="/whatsapp" element={<PlanGate feature="whatsapp" title="WhatsApp"><WhatsApp /></PlanGate>} />
      <Route path="/reports" element={<PlanGate feature="reports" title="Reports"><Reports /></PlanGate>} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
