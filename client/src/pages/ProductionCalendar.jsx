import { useEffect, useMemo, useState } from 'react';
import api from '../api.js';
import Layout from '../components/Layout.jsx';
import { Card, Badge, Spinner, Button } from '../components/ui.jsx';

const DAY = 864e5;
const iso = (d) => d.toISOString().slice(0, 10);
const parse = (s) => new Date(`${s}T00:00:00Z`);
const startOfWeek = (d) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x; };
const COLORS = { Queued: '#6b7a8c', 'In Fabrication': '#2f6f9f', 'In Welding': '#b8741a', 'Quality Inspection': '#7a4f9a', 'Ready to Ship': '#2e7d4f', 'On Hold': '#9a9a9a' };
const WEEKS = 4;

// Agenda de produção: cada ordem aberta vira uma barra do início até a entrega, em 4 semanas por vez.
export default function ProductionCalendar() {
  const [d, setD] = useState(null);
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const [ready, setReady] = useState(false);
  const from = iso(anchor); const to = iso(new Date(anchor.getTime() + (WEEKS * 7 - 1) * DAY));
  // Primeira abertura: se a janela de hoje está vazia, pula para a semana da ordem aberta mais próxima.
  useEffect(() => {
    api.calendar().then((all) => {
      const now = new Date(`${all.today}T00:00:00Z`); const a0 = startOfWeek(now); const end = a0.getTime() + WEEKS * 7 * DAY;
      const inWindow = all.items.some((w) => parse(w.due_date) >= a0 && parse(w.start_date || w.due_date) < end);
      if (!inWindow && all.items.length) {
        const nearest = all.items.reduce((best, w) => (Math.abs(parse(w.due_date) - now) < Math.abs(parse(best.due_date) - now) ? w : best));
        setAnchor(startOfWeek(parse(nearest.due_date)));
      }
      setReady(true);
    }).catch(() => setReady(true));
  }, []);
  useEffect(() => { if (!ready) return; setD(null); api.calendar(from, to).then(setD); }, [from, to, ready]);
  const days = useMemo(() => Array.from({ length: WEEKS * 7 }, (_, i) => new Date(anchor.getTime() + i * DAY)), [anchor]);
  if (!d) return <Layout title="Production Calendar"><Spinner /></Layout>;
  const idx = (s) => Math.round((parse(s) - anchor) / DAY);
  const rows = d.items.map((w) => {
    const due = idx(w.due_date); const start = w.start_date ? idx(w.start_date) : due - 6;
    return { ...w, s: Math.max(0, Math.min(start, due)), e: Math.min(WEEKS * 7 - 1, due), cutL: Math.min(start, due) < 0, cutR: due > WEEKS * 7 - 1 };
  });
  const todayIdx = idx(d.today);
  return (
    <Layout title="Production Calendar" count={d.items.length} actions={<>
      <Button variant="outline" onClick={() => setAnchor(new Date(anchor.getTime() - 7 * DAY))}>← Previous</Button>
      <Button variant="outline" onClick={() => setAnchor(startOfWeek(new Date()))}>Today</Button>
      <Button variant="outline" onClick={() => setAnchor(new Date(anchor.getTime() + 7 * DAY))}>Next →</Button>
    </>}>
      <Card className="p-3">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 860 }} data-testid="calendar-grid">
            <div className="grid" style={{ gridTemplateColumns: `repeat(${WEEKS * 7}, minmax(0, 1fr))` }}>
              {days.map((x, i) => (
                <div key={i} className={`text-center text-[10px] border-l border-line py-1 ${i === todayIdx ? 'bg-brandTint font-semibold text-brand' : (x.getUTCDay() % 6 === 0 ? 'bg-wash text-muted' : 'text-muted')}`}>
                  {x.getUTCDate() === 1 || i === 0 ? x.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) + ' ' : ''}{x.getUTCDate()}
                </div>))}
            </div>
            {rows.length === 0 && <p className="text-sm text-muted py-6 text-center">No open work orders in this window.</p>}
            {rows.map((w) => (
              <div key={w.id} className="relative grid items-center border-t border-line" style={{ gridTemplateColumns: `repeat(${WEEKS * 7}, minmax(0, 1fr))`, height: 38 }}>
                {todayIdx >= 0 && todayIdx < WEEKS * 7 && <div className="absolute top-0 bottom-0 w-px bg-brand/50" style={{ left: `${((todayIdx + 0.5) / (WEEKS * 7)) * 100}%` }} />}
                <div title={`${w.work_order_number} · ${w.customer_name} · ${w.status} · due ${w.due_date}`} data-testid="calendar-bar"
                  className="rounded px-2 text-[11px] text-white truncate flex items-center gap-1.5"
                  style={{ gridColumn: `${w.s + 1} / ${w.e + 2}`, background: w.overdue ? '#b3261e' : COLORS[w.status] || '#6b7a8c', height: 26, borderTopLeftRadius: w.cutL ? 0 : undefined, borderBottomLeftRadius: w.cutL ? 0 : undefined }}>
                  <b className="font-mono">{w.work_order_number}</b><span className="opacity-90 truncate">{w.customer_name}</span>
                </div>
              </div>))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3 text-xs text-muted items-center">
          {Object.entries(COLORS).map(([k, c]) => <span key={k} className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />{k}</span>)}
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#b3261e' }} />Overdue</span>
        </div>
      </Card>
      {rows.some((w) => w.overdue) && <p className="text-sm mt-3"><Badge tone="rose">{rows.filter((w) => w.overdue).length} overdue</Badge> <span className="text-muted">— past their due date and not completed.</span></p>}
    </Layout>
  );
}
