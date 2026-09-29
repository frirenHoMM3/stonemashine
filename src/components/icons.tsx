type P = React.SVGProps<SVGSVGElement>;
const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "square" as const, "aria-hidden": true };

export const IconArrow = (p: P) => (<svg {...base} {...p}><path d="M4 12h15M13 6l6 6-6 6" /></svg>);
export const IconExternal = (p: P) => (<svg {...base} {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" /></svg>);
export const IconSearch = (p: P) => (<svg {...base} {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21" /></svg>);
export const IconPhone = (p: P) => (<svg {...base} {...p}><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2Z" /></svg>);
export const IconMenu = (p: P) => (<svg {...base} {...p}><path d="M3 7h18M3 12h18M3 17h12" /></svg>);
export const IconClose = (p: P) => (<svg {...base} {...p}><path d="M5 5l14 14M19 5 5 19" /></svg>);
export const IconChevron = (p: P) => (<svg {...base} {...p}><path d="M9 5l7 7-7 7" /></svg>);
export const IconPlus = (p: P) => (<svg {...base} {...p}><path d="M12 4v16M4 12h16" /></svg>);
export const IconTrash = (p: P) => (<svg {...base} {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>);
export const IconUp = (p: P) => (<svg {...base} {...p}><path d="M12 19V5M6 11l6-6 6 6" /></svg>);
export const IconDown = (p: P) => (<svg {...base} {...p}><path d="M12 5v14M6 13l6 6 6-6" /></svg>);
export const IconTelegram = (p: P) => (<svg {...base} {...p}><path d="M21 4 3 11l6 2 2 6 3-4 5 4 2-15ZM9 13l8-6" /></svg>);

export function Mark({ className = "" }: { className?: string }) {
  // Плашка с отбитым углом и прорезью — узнаваемо на 16px и не похоже на шаблонный логотип
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M0 0h24l8 8v24H0z" fill="var(--color-red)" />
      <path d="M7 10h13M7 16h18M7 22h9" stroke="var(--color-ink)" strokeWidth="3" />
    </svg>
  );
}
