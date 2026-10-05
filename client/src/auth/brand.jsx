// Per-product bits the shared sign-in screens need.
export const BRAND = {
  name: 'Anvil',
  tagline: 'Vanguard Fabrication Works',
  storageKey: 'anvil-crm-session',
  langKey: 'anvil-lang',
  titleFont: 'font-head uppercase tracking-wide',
};

export function BrandLogo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="29" height="29" rx="5" fill="#b3261e" />
      <path d="M8 21h6.5l1.2-2.4h6.6L23 21h1.5" stroke="#f0ece6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M11 17l1.2-7h6l3.3 3.3" stroke="#f0ece6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="9" y1="24" x2="21" y2="24" stroke="#f0ece6" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
