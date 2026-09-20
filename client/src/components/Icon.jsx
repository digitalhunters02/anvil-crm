// Hand-rolled inline-SVG icon set for Anvil. No icon library — each icon is
// a small array of primitive shape descriptors rendered onto a 24x24 grid.
const ICONS = {
  dashboard: [
    ['rect', 3, 3, 7, 11, 1.5],
    ['rect', 14, 3, 7, 6, 1.5],
    ['rect', 14, 12, 7, 9, 1.5],
    ['rect', 3, 17, 7, 4, 1.5],
  ],
  anvil: [
    ['path', 'M4 18h5l1.5-3h7L19 18h1'],
    ['path', 'M8 15l1-6h6l3 3'],
    ['rect', 10.5, 5, 3, 4, 0.5],
    ['line', 6, 21, 18, 21],
  ],
  rfq: [
    ['path', 'M4 5.5h13l3 3.2V19H4V5.5Z'],
    ['path', 'M17 5.5v3.2h3'],
    ['line', 7.5, 12, 14.5, 12],
    ['line', 7.5, 15.3, 12.5, 15.3],
    ['circle', 16.5, 15.8, 1.6],
  ],
  quote: [
    ['path', 'M5 4h10l4 4v12H5V4Z'],
    ['path', 'M15 4v4h4'],
    ['line', 8, 12.5, 16, 12.5],
    ['line', 8, 16, 16, 16],
    ['path', 'M8.3 9h1.6l-.9 2H8.3Z'],
  ],
  customers: [
    ['rect', 3.5, 9, 17, 12, 1],
    ['path', 'M3.5 9 12 3l8.5 6'],
    ['line', 9, 21, 9, 15],
    ['line', 15, 21, 15, 15],
    ['line', 9, 15, 15, 15],
  ],
  bom: [
    ['path', 'M12 3 4 7v10l8 4 8-4V7L12 3Z'],
    ['path', 'M4 7l8 4 8-4'],
    ['line', 12, 11, 12, 21],
  ],
  supplier: [
    ['path', 'M3 9.5 12 4l9 5.5'],
    ['path', 'M5 10v9h14v-9'],
    ['line', 9, 19, 9, 13.5],
    ['line', 15, 19, 15, 13.5],
    ['line', 9, 13.5, 15, 13.5],
  ],
  purchaseOrder: [
    ['rect', 5, 3.5, 14, 17, 1.5],
    ['path', 'M8.5 3.5V6h7V3.5'],
    ['path', 'M8.3 11.5l1.4 1.5 2.8-3.1'],
    ['line', 8.3, 16, 15.7, 16],
  ],
  workOrder: [
    ['circle', 8.5, 8.5, 4],
    ['path', 'M11.3 11.3 20 20'],
    ['path', 'M5.7 15 3 21l6-2.7'],
    ['path', 'M13.5 5.5 15.5 3.5 19.5 7.5 17.5 9.5Z'],
  ],
  quality: [
    ['path', 'M12 3 5 5.5V11c0 5 3 8.3 7 9.5 4-1.2 7-4.5 7-9.5V5.5L12 3Z'],
    ['path', 'M8.7 12 11 14.3l4.5-5'],
  ],
  shipment: [
    ['rect', 2.5, 6.5, 11, 9.5, 1],
    ['path', 'M13.5 10h4.3L21 13.3V16h-7.5z'],
    ['circle', 7, 18, 1.8],
    ['circle', 17.5, 18, 1.8],
  ],
  invoice: [
    ['path', 'M6.5 3h11v18l-2.7-1.7L12 21l-2.8-1.7L6.5 21V3Z'],
    ['line', 9, 7.5, 15, 7.5],
    ['line', 9, 11, 15, 11],
    ['line', 9, 14.5, 13, 14.5],
  ],
  automation: [['path', 'M12.5 2 4 14h6l-1 8 9.5-13h-6l1-7Z']],
  reports: [
    ['line', 4, 20.5, 20.5, 20.5],
    ['rect', 5.5, 13, 3.4, 7.3, 0.6],
    ['rect', 10.3, 8, 3.4, 12.3, 0.6],
    ['rect', 15.1, 4, 3.4, 16.3, 0.6],
  ],
  settings: [
    ['circle', 12, 12, 3.1],
    ['path', 'M12 3v2.4M12 18.6V21M4.9 6.6l1.7 1.7M17.4 15.7l1.7 1.7M3 12h2.4M18.6 12H21M4.9 17.4l1.7-1.7M17.4 8.3l1.7-1.7'],
  ],
  search: [
    ['circle', 10.5, 10.5, 6.3],
    ['line', 15.1, 15.1, 20.5, 20.5],
  ],
  bell: [
    ['path', 'M6.2 10a5.8 5.8 0 0 1 11.6 0c0 4.3 1.6 5.8 1.6 5.8H4.6S6.2 14.3 6.2 10Z'],
    ['path', 'M10.2 18.8a1.9 1.9 0 0 0 3.6 0'],
  ],
  chevronDown: [['path', 'M6 9.5l6 6 6-6']],
  chevronRight: [['path', 'M9 6l6 6-6 6']],
  plus: [
    ['line', 12, 5, 12, 19],
    ['line', 5, 12, 19, 12],
  ],
  x: [
    ['line', 6, 6, 18, 18],
    ['line', 18, 6, 6, 18],
  ],
  check: [['path', 'M5 13l4.5 4.5L19 8']],
  arrowUpRight: [
    ['line', 7, 17, 17, 7],
    ['path', 'M9.5 7H17v7.5'],
  ],
  clock: [
    ['circle', 12, 12, 8.3],
    ['path', 'M12 7.8V12l3 2'],
  ],
  mail: [
    ['rect', 3, 5.3, 18, 13.4, 1.3],
    ['path', 'M3.6 6.2 12 12.8l8.4-6.6'],
  ],
  phoneCall: [
    ['path', 'M5.2 4h3.1l1.3 4-1.8 1.4a11.8 11.8 0 0 0 5.6 5.6l1.4-1.8 4 1.3v3.1A1.7 1.7 0 0 1 17 19.4 16.2 16.2 0 0 1 3.9 6.3 1.7 1.7 0 0 1 5.2 4Z'],
  ],
  flag: [
    ['line', 5.5, 3, 5.5, 21],
    ['path', 'M5.5 4h12.5l-2.7 4 2.7 4H5.5Z'],
  ],
  alertTriangle: [
    ['path', 'M12 3.2 21.3 20H2.7L12 3.2Z'],
    ['line', 12, 9.5, 12, 14],
    ['line', 12, 16.8, 12.01, 16.8],
  ],
  filter: [['path', 'M3.5 5h17L14 12.7V18l-4 2v-7.3L3.5 5Z']],
  moreHorizontal: [
    ['circle', 5, 12, 1.5],
    ['circle', 12, 12, 1.5],
    ['circle', 19, 12, 1.5],
  ],
  gauge: [
    ['path', 'M4.2 18a7.8 7.8 0 1 1 15.6 0'],
    ['line', 12, 18, 15.2, 12],
    ['line', 12, 18, 12.01, 18],
  ],
  wrench: [
    ['path', 'M14.7 3.3a4.6 4.6 0 0 0-6 5.9L3 15l3 3 5.8-5.7a4.6 4.6 0 0 0 5.9-6l-3 3-2-2Z'],
  ],
  star: [['path', 'M12 3.3l2.7 5.7 6.2.9-4.5 4.3 1.1 6.2-5.5-2.9-5.5 2.9 1.1-6.2L3 9.9l6.2-.9Z']],
  pencil: [
    ['path', 'M4 20h4.2L18.8 9.4a2.1 2.1 0 0 0 0-3l-2.2-2.2a2.1 2.1 0 0 0-3 0L3 14.8V20Z'],
    ['line', 13.3, 5.7, 18.3, 10.7],
  ],
  download: [
    ['path', 'M12 3.2v12'],
    ['path', 'M7 10.7 12 15.7 17 10.7'],
    ['path', 'M4 19h16'],
  ],
  camera: [
    ['path', 'M4 8.3h3.3L8.6 5.8h6.8l1.3 2.5H20a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.3a1 1 0 0 1 1-1Z'],
    ['circle', 12, 13.4, 3.5],
  ],
  trash: [
    ['line', 4, 7, 20, 7],
    ['path', 'M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7'],
    ['path', 'M6.3 7l.9 12.3A1.6 1.6 0 0 0 8.8 21h6.4a1.6 1.6 0 0 0 1.6-1.7L17.7 7'],
    ['line', 10, 11, 10, 17],
    ['line', 14, 11, 14, 17],
  ],
  material: [
    ['rect', 3.5, 4, 17, 4.5, 0.8],
    ['rect', 3.5, 10, 17, 4.5, 0.8],
    ['rect', 3.5, 16, 17, 4.5, 0.8],
  ],
  spark: [['path', 'M13 2 5 14h5.5L9.5 22 19 9h-5.5L13 2Z']],
  menu: [
    ['line', 3.5, 6.5, 20.5, 6.5],
    ['line', 3.5, 12, 20.5, 12],
    ['line', 3.5, 17.5, 20.5, 17.5],
  ],
  logout: [
    ['path', 'M9.5 21H5.3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4.2'],
    ['path', 'M16.3 17l5-5-5-5'],
    ['line', 21, 12, 9.5, 12],
  ],
  whatsapp: [
    ['path', 'M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.15A8.5 8.5 0 1 0 12 3.5Z'],
    ['path', 'M9 9.3c.2-.5.4-.5.6-.5h.35c.2 0 .3.05.4.35.15.4.5 1.3.55 1.4.05.15 0 .3-.1.45-.5.7-.8.7-.3 1.4.6.85 1.2 1.3 2.05 1.7.2.1.35.1.5-.1.15-.2.6-.7.75-.9.15-.2.3-.15.5-.1.2.1 1.3.6 1.5.7.2.1.35.15.4.25.05.15.05.6-.15 1.15-.2.5-1.1.9-1.5.95-.4.05-.7.2-2.5-.55-2.1-.9-3.4-3-3.5-3.2-.1-.15-.9-1.15-.9-2.2 0-1.05.5-1.55.65-1.75Z'],
  ],
  send: [
    ['path', 'M4 20l17-8L4 4l0 6.5L15.5 12 4 13.5 4 20Z'],
  ],
};

export default function Icon({ name, size = 18, stroke = 'currentColor', strokeWidth = 1.8, className = '' }) {
  const shapes = ICONS[name] || ICONS.dashboard;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {shapes.map((s, i) => {
        if (s[0] === 'path') return <path key={i} d={s[1]} />;
        if (s[0] === 'circle') return <circle key={i} cx={s[1]} cy={s[2]} r={s[3]} />;
        if (s[0] === 'line') return <line key={i} x1={s[1]} y1={s[2]} x2={s[3]} y2={s[4]} />;
        if (s[0] === 'rect') return <rect key={i} x={s[1]} y={s[2]} width={s[3]} height={s[4]} rx={s[5] || 0} />;
        return null;
      })}
    </svg>
  );
}
