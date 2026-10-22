import { useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { useT } from './i18n.js';
import { Modal, Button } from '../components/ui.jsx';
import { LEGAL_SUPPORT_EMAIL } from '../legalContent.js';

function formatEnd(iso, lang) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

// Thin bar shown only while the session is a free-trial one. "Subscribe" opens the contact text (no payment link exists for staff logins).
export default function TrialBanner() {
  const { account } = useAuth();
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  if (!account?.isDemoTrial) return null;
  const href = `mailto:${LEGAL_SUPPORT_EMAIL}?subject=${encodeURIComponent(t('trial.contactSubject'))}`;
  return (
    <>
      <div
        role="status"
        data-testid="trial-banner"
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 sm:px-7 py-2 bg-amberTint border-b border-amber/30 text-[12.5px] text-ink flex-shrink-0"
      >
        <span className="min-w-0 font-medium" style={{ overflowWrap: 'anywhere' }}>{t('trial.banner', { when: formatEnd(account.demoExpiresAt, lang) })}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="trial-subscribe"
          className="inline-flex items-center h-7 px-3 rounded-md text-[12px] font-semibold bg-brand text-white hover:bg-brand/90 flex-shrink-0"
        >
          {t('trial.subscribe')}
        </button>
      </div>
      {open && (
        <Modal
          title={t('trial.contactTitle')}
          onClose={() => setOpen(false)}
          footer={<Button variant="outline" onClick={() => setOpen(false)} data-testid="trial-close">{t('trial.close')}</Button>}
        >
          <p className="text-sm text-muted mb-3" data-testid="trial-contact">{t('trial.contactBody')}</p>
          <a href={href} className="inline-flex items-center h-9 px-3.5 rounded-md text-[13px] font-semibold bg-brand text-white hover:bg-brand/90 max-w-full" style={{ overflowWrap: 'anywhere' }}>
            {t('trial.contactButton', { email: LEGAL_SUPPORT_EMAIL })}
          </a>
        </Modal>
      )}
    </>
  );
}
