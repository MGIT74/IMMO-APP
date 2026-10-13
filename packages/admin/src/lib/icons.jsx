/* Icônes minimalistes (SVG inline, stroke, aucune dépendance) */
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const I = {
  maison: (
    <svg viewBox="0 0 24 24" {...S}><path d="M4 11 12 4.5 20 11" /><path d="M6.5 10.2V19h11v-8.8" /><path d="M10 19v-4.5h4V19" /></svg>
  ),
  surface: (
    <svg viewBox="0 0 24 24" {...S}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h5V4M20 15h-5v5" /></svg>
  ),
  pieces: (
    <svg viewBox="0 0 24 24" {...S}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 9h5v10M15 12h5" /></svg>
  ),
  chambres: (
    <svg viewBox="0 0 24 24" {...S}><path d="M3 8v11" /><path d="M3 16h18" /><path d="M21 19v-6a3 3 0 0 0-3-3H8v6" /><circle cx="7" cy="10.5" r="1.5" /></svg>
  ),
  photo: (
    <svg viewBox="0 0 24 24" {...S}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10.5" r="1.6" /><path d="m5 18 5-5 3 3 3-3 3 3" /></svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" {...S}><path d="m12 3.5 2.6 5.6 6 .7-4.4 4.1 1.2 5.9L12 16.9 6.6 19.8l1.2-5.9L3.4 9.8l6-.7z" /></svg>
  ),
  starFill: (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1"><path d="m12 3.5 2.6 5.6 6 .7-4.4 4.1 1.2 5.9L12 16.9 6.6 19.8l1.2-5.9L3.4 9.8l6-.7z" /></svg>
  ),
  link: (
    <svg viewBox="0 0 24 24" {...S}><path d="M7 17 17 7" /><path d="M9 7h8v8" /></svg>
  ),
  recherche: (
    <svg viewBox="0 0 24 24" {...S}><circle cx="11" cy="11" r="6" /><path d="m20 20-3.8-3.8" /></svg>
  ),
  filtre: (
    <svg viewBox="0 0 24 24" {...S}><path d="M4 6h16M7 12h10M10 18h4" /></svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" {...S}><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" {...S}><path d="M12 5v14" /><path d="M5 12h14" /></svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" {...S}><path d="M20 11a8 8 0 1 0-2.3 6.3" /><path d="M20 5v6h-6" /></svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M7 5v14l12-7z" /></svg>
  ),
  edit: (
    <svg viewBox="0 0 24 24" {...S}><path d="m4 20 .9-3.6L16.6 5A2.1 2.1 0 0 1 19.6 5c.8.8.8 2.2 0 3L8.3 19.8z" /></svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" {...S}><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /><path d="M10 11v5M14 11v5" /></svg>
  ),
  tel: (
    <svg viewBox="0 0 24 24" {...S}><path d="M5 4h4l1.5 4.5L8 10a13 13 0 0 0 6 6l1.5-2.5L20 15v4a1.5 1.5 0 0 1-1.6 1.5C9.6 19.9 4.1 14.4 3.5 5.6A1.5 1.5 0 0 1 5 4Z" /></svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" {...S}><path d="m4.5 12.5 5 5 10-11" /></svg>
  ),
  croix: (
    <svg viewBox="0 0 24 24" {...S}><path d="m6 6 12 12M18 6 6 18" /></svg>
  ),
  warn: (
    <svg viewBox="0 0 24 24" {...S}><path d="M12 3.5 21.5 20h-19z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.2" r=".4" fill="currentColor" /></svg>
  ),
  fleche: (
    <svg viewBox="0 0 24 24" {...S}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
  ),
  flecheRetour: (
    <svg viewBox="0 0 24 24" {...S}><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></svg>
  ),
  flecheGauche: (
    <svg viewBox="0 0 24 24" {...S}><path d="m15 6-6 6 6 6" /></svg>
  ),
  flecheDroite: (
    <svg viewBox="0 0 24 24" {...S}><path d="m9 6 6 6-6 6" /></svg>
  ),
  flecheHaut: (
    <svg viewBox="0 0 24 24" {...S}><path d="m6 15 6-6 6 6" /></svg>
  ),
  flecheBas: (
    <svg viewBox="0 0 24 24" {...S}><path d="m6 9 6 6 6-6" /></svg>
  ),
  tendanceBas: (
    <svg viewBox="0 0 24 24" {...S}><path d="M3 7l6 6 4-4 8 8" /><path d="M21 11v6h-6" /></svg>
  ),
  tendanceHaut: (
    <svg viewBox="0 0 24 24" {...S}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>
  ),
  repeat: (
    <svg viewBox="0 0 24 24" {...S}><path d="M17 2v4H8a5 5 0 0 0-5 5" /><path d="M7 22v-4h9a5 5 0 0 0 5-5" /><path d="M17 2l3 3-3 3M7 22l-3-3 3-3" /></svg>
  ),
  note: (
    <svg viewBox="0 0 24 24" {...S}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
  ),
  bouclier: (
    <svg viewBox="0 0 24 24" {...S}><path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6z" /></svg>
  ),
  energie: (
    <svg viewBox="0 0 24 24" {...S}><path d="M13 2 4.5 13.5H11L9.5 22 19 10.5h-6.5z" /></svg>
  ),
  eco: (
    <svg viewBox="0 0 24 24" {...S}><path d="M6 21c0-7 4-12 14-12 0 8-4 12-10 12" /><path d="M6 21c1-5 4-8 8-10" /></svg>
  ),
  archive: (
    <svg viewBox="0 0 24 24" {...S}><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v10h14V9" /><path d="M10 13h4" /></svg>
  ),
  fusee: (
    <svg viewBox="0 0 24 24" {...S}><path d="M12 3c4 1 7 4 8 8-2.5 1.3-5 1-7-.8.6 4-1 8-4 10.8C7.4 17.5 8 13 9.5 10 7.7 12 5.3 12.3 3 11c1-4 4-7 9-8z" /></svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" {...S}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /></svg>
  ),
  doc: (
    <svg viewBox="0 0 24 24" {...S}><path d="M14 3H6v18h12V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" /></svg>
  ),
};

/* Petit wrapper avec taille */
export function Ic({ icon, size = 16, className = '' }) {
  return <span className={'ic ' + className} style={{ width: size, height: size, display: 'inline-flex', flexShrink: 0 }}>{icon}</span>;
}

/* Mini icône SVG avec size en props (pour spans inline) */
export function MiniIcon({ d, size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, verticalAlign: '-2px' }}>
      {d}
    </svg>
  );
}

export const PATHS = {
  maison: <><path d="M4 11 12 4.5 20 11" /><path d="M6.5 10.2V19h11v-8.8" /><path d="M10 19v-4.5h4V19" /></>,
  surface: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h5V4M20 15h-5v5" /></>,
  pieces: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 9h5v10M15 12h5" /></>,
  chambres: <><path d="M3 8v11" /><path d="M3 16h18" /><path d="M21 19v-6a3 3 0 0 0-3-3H8v6" /><circle cx="7" cy="10.5" r="1.5" /></>,
  photo: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m16 5.5-6 5-3-2.5-4 3.5" /></>,
  tel: <path d="M5 4h4l1.5 4.5L8 10a13 13 0 0 0 6 6l1.5-2.5L20 15v4a1.5 1.5 0 0 1-1.6 1.5C9.6 19.9 4.1 14.4 3.5 5.6A1.5 1.5 0 0 1 5 4Z" />,
  energie: <path d="M13 2 4.5 13.5H11L9.5 22 19 10.5h-6.5z" />,
  repeat: <><path d="M17 2v4H8a5 5 0 0 0-5 5" /><path d="M7 22v-4h9a5 5 0 0 0 5-5" /><path d="M17 2l3 3-3 3M7 22l-3-3 3-3" /></>,
  recherche: <><circle cx="11" cy="11" r="6" /><path d="m20 20-3.8-3.8" /></>,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  croix: <><path d="m6 6 12 12M18 6 6 18" /></>,
  warn: <><path d="M12 3.5 21.5 20h-19z" /><path d="M12 10v4.5" /></>,
  tendanceBas: <><path d="M3 7l6 6 4-4 8 8" /><path d="M21 11v6h-6" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  note: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  refresh: <><path d="M20 11a8 8 0 1 0-2.3 6.3" /><path d="M20 5v6h-6" /></>,
  playIcon: <path d="M7 5v14l12-7z" />,
};