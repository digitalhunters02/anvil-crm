import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

const READ_KEY = 'anvil-notifications-read';

export default function Topbar({ title, count, actions }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(true);
  const panelRef = useRef(null);

  useEffect(() => {
    try {
      setUnread(localStorage.getItem(READ_KEY) !== '1');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    function onDocClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  function toggleBell() {
    setOpen((o) => !o);
    if (unread) {
      setUnread(false);
      try {
        localStorage.setItem(READ_KEY, '1');
      } catch {
        // ignore
      }
    }
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 sm:px-7 py-4 border-b border-line bg-surface flex-shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <h1 className="font-head uppercase tracking-wide text-[20px] font-semibold text-ink truncate">{title}</h1>
        {typeof count === 'number' && (
          <span className="flex-shrink-0 text-xs font-medium text-muted bg-wash px-2 py-0.5 rounded-full font-sans normal-case tracking-normal">{count}</span>
        )}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="hidden md:flex items-center gap-2 bg-wash rounded-lg px-3 py-1.5 w-64">
          <Icon name="search" size={15} stroke="#93969a" />
          <input
            placeholder="Search..."
            className="bg-transparent text-sm outline-none placeholder:text-faint w-full"
            readOnly
          />
        </div>
        {actions}
        <div className="relative" ref={panelRef}>
          <button
            type="button"
            onClick={toggleBell}
            title="Notifications"
            className="relative text-muted hover:text-ink transition-colors"
          >
            <Icon name="bell" size={19} />
            {unread && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand" />}
          </button>
          {open && (
            <div className="absolute right-0 top-8 z-40 w-64 bg-surface border border-line rounded-lg shadow-lg py-3 px-4">
              <p className="text-xs font-semibold text-ink mb-1">Notifications</p>
              <p className="text-xs text-muted">No new notifications.</p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
