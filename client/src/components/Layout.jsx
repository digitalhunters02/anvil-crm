import { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import Icon from './Icon.jsx';

export default function Layout({ title, count, actions, children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg">
      {/* Mobile-only fixed top bar with hamburger + brand */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-side text-white flex items-center gap-3 px-4 shadow-md">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="-ml-1.5 p-1.5 rounded-md text-white hover:bg-side2 transition-colors flex-shrink-0"
        >
          <Icon name="menu" size={22} stroke="#fff" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" className="flex-shrink-0">
            <rect x="1.5" y="1.5" width="29" height="29" rx="5" fill="#b3261e" />
            <path d="M8 21h6.5l1.2-2.4h6.6L23 21h1.5" stroke="#f0ece6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M11 17l1.2-7h6l3.3 3.3" stroke="#f0ece6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <line x1="9" y1="24" x2="21" y2="24" stroke="#f0ece6" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span className="font-head uppercase tracking-wide font-semibold text-[15px] text-white truncate">Anvil</span>
        </div>
      </div>

      {/* Backdrop — only present while the drawer is open */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar open={drawerOpen} onNavigate={() => setDrawerOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 h-full pt-14 md:pt-0">
        <Topbar title={title} count={count} actions={actions} />
        <main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-7 py-5 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
