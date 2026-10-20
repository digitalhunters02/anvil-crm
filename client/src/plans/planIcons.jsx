// planIcons.jsx
// PARA QUE SERVE: os poucos ícones que o kit de selo de plano usa (cadeado, ✓, ✕, olho, setas), desenhados em SVG simples
// (mesmos traços do pacote lucide-react). Este produto NÃO usa lucide-react, então o kit aponta para cá.
const base = (size, style) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", style, focusable: "false" });
const make = (children) => function Icon({ size = 16, style, ...rest }) {
  return <svg {...base(size, style)} {...rest}>{children}</svg>;
};

export const Lock = make(<><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>);
export const Check = make(<path d="M20 6 9 17l-5-5" />);
export const X = make(<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>);
export const Eye = make(<><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>);
export const ChevronDown = make(<path d="m6 9 6 6 6-6" />);
export const ChevronUp = make(<path d="m18 15-6-6-6 6" />);
