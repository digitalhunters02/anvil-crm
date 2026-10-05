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
      <Route path="/whatsapp" element={<WhatsApp />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
