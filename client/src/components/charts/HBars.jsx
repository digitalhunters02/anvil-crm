// Minimal horizontal bar chart — no charting library. Used on Reports for
// ranked lists like revenue by customer.
export default function HBars({ data, formatValue = (v) => v }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <p className="text-xs text-muted w-32 flex-shrink-0 truncate">{d.label}</p>
          <div className="flex-1 h-5 bg-wash rounded-md overflow-hidden">
            <div
              className="h-full rounded-md"
              style={{ width: `${Math.max(3, (d.value / max) * 100)}%`, background: d.color || '#b3261e' }}
            />
          </div>
          <p className="text-xs font-medium text-ink w-16 flex-shrink-0 text-right">{formatValue(d.value)}</p>
        </div>
      ))}
    </div>
  );
}
