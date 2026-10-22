// Where the visitor came from (ad click): only utm_* and fbclid, kept for the tab session and sent with the trial request.
// The app uses a hash router, so the parameters can sit before the "#" (/?utm_source=x#/) or inside it (/#/?utm_source=x).
const KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
const STORE_KEY = 'anvil-attribution';

function fromUrl() {
  const out = {};
  try {
    const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?').slice(1).join('?') : '';
    for (const q of [window.location.search, hashQuery]) {
      const params = new URLSearchParams(q);
      for (const k of KEYS) {
        const v = params.get(k);
        if (v && v.trim() && !out[k]) out[k] = v.trim().slice(0, 120);
      }
    }
  } catch { /* no window / bad URL */ }
  return out;
}

// Call early (the sign-in screen does): saves what the URL has, keeping what was saved before for the keys it lacks.
export function captureAttribution() {
  const found = fromUrl();
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || '{}') || {}; } catch { saved = {}; }
  const merged = { ...saved, ...found };
  if (Object.keys(found).length) {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(merged)); } catch { /* storage blocked */ }
  }
  return merged;
}

export function getAttribution() {
  return captureAttribution();
}
