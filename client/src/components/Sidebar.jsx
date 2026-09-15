import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Avatar } from './ui.jsx';

const AVATAR_KEY = 'anvil-operator-avatar';

const NAV = [
  { section: null, items: [{ to: '/', label: 'Dashboard', icon: 'dashboard' }] },
  {
    section: 'Sales',
    items: [
      { to: '/rfqs', label: 'RFQs', icon: 'rfq' },
      { to: '/quotes', label: 'Quotes', icon: 'quote' },
      { to: '/customers', label: 'Customers', icon: 'customers' },
    ],
  },
  {
    section: 'Production',
    items: [
      { to: '/work-orders', label: 'Work Orders', icon: 'workOrder' },
      { to: '/bill-of-materials', label: 'Bill of Materials', icon: 'bom' },
      { to: '/quality-inspections', label: 'Quality Inspections', icon: 'quality' },
    ],
  },
  {
    section: 'Supply Chain',
    items: [
      { to: '/suppliers', label: 'Suppliers', icon: 'supplier' },
      { to: '/purchase-orders', label: 'Purchase Orders', icon: 'purchaseOrder' },
    ],
  },
  {
    section: 'Fulfillment',
    items: [
      { to: '/shipments', label: 'Shipments', icon: 'shipment' },
      { to: '/invoices', label: 'Invoices', icon: 'invoice' },
    ],
  },
  {
    section: 'System',
    items: [
      { to: '/automations', label: 'Automations', icon: 'automation' },
      { to: '/reports', label: 'Reports', icon: 'reports' },
      { to: '/settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

export default function Sidebar({ open = false, onNavigate }) {
  const fileRef = useRef(null);
  const [avatar, setAvatar] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AVATAR_KEY);
      if (saved) setAvatar(saved);
    } catch {
      // ignore — localStorage unavailable
    }
  }, []);

  function onPickFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setAvatar(dataUrl);
      try {
        localStorage.setItem(AVATAR_KEY, dataUrl);
      } catch {
        // best-effort persistence only
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-50 w-[260px] max-w-[82vw] md:w-64 md:max-w-none flex-shrink-0 bg-side text-sideText flex flex-col h-full min-h-0 shadow-2xl md:shadow-none transition-transform duration-300 ease-in-out md:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-5 flex-shrink-0">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect x="1.5" y="1.5" width="29" height="29" rx="5" fill="#b3261e" />
          <path d="M8 21h6.5l1.2-2.4h6.6L23 21h1.5" stroke="#f0ece6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M11 17l1.2-7h6l3.3 3.3" stroke="#f0ece6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <line x1="9" y1="24" x2="21" y2="24" stroke="#f0ece6" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <div className="min-w-0">
          <p className="font-head uppercase tracking-wide font-semibold text-[18px] text-white leading-tight">Anvil</p>
          <p className="text-[11px] text-sideMuted leading-tight truncate">Vanguard Fabrication Works</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto min-h-0 px-3 pb-4">
        {NAV.map((group, gi) => (
          <div key={gi} className="mb-4">
            {group.section && (
              <p className="px-3 mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-sideMuted">
                {group.section}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `relative flex items-center gap-2.5 px-3 py-2 rounded-md text-[13.5px] font-medium transition-colors ${
                      isActive ? 'bg-side2 text-white' : 'text-sideText hover:bg-side2/60 hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-brand" />
                      )}
                      <Icon name={item.icon} size={16} stroke={isActive ? '#e08c82' : '#83868a'} />
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-sideLine flex items-center gap-2.5 flex-shrink-0">
        <button
          type="button"
          title="Change photo"
          onClick={() => fileRef.current && fileRef.current.click()}
          className="relative flex-shrink-0 rounded-full group"
        >
          {avatar ? (
            <img src={avatar} alt="Operator" width={30} height={30} className="rounded-full object-cover w-[30px] h-[30px]" />
          ) : (
            <Avatar name="Derek Malone" color="#b3261e" size={30} />
          )}
          <span className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Icon name="camera" size={13} stroke="#fff" />
            </span>
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
        <div className="min-w-0 flex-grow">
          <p className="text-[13px] font-medium text-white truncate">Derek Malone</p>
          <p className="text-[11px] text-sideMuted truncate">VP of Operations</p>
        </div>
      </div>
    </aside>
  );
}
