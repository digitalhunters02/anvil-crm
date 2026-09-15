// Minimal vertical bar chart — no charting library, just divs sized by
// percentage of the max value. Used on Dashboard and Reports.
export default function ColBars({ data, height = 200, formatValue = (v) => v }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-3" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.max(4, Math.round((d.value / max) * (height - 36)));
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
            <p className="text-xs font-medium text-ink mb-1 truncate w-full text-center">{formatValue(d.value)}</p>
            <div
              className="w-full rounded-t-md transition-all"
              style={{ height: h, background: d.color || '#b3261e' }}
              title={`${d.label}: ${formatValue(d.value)}`}
            />
            <p className="text-[11px] text-muted mt-1.5 truncate w-full text-center">{d.label}</p>
          </div>
        );
      })}
    </div>
  );
}
