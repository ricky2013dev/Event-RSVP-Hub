import { useCurrentCardStyle, type CornerKind, type FlourishKind } from '@/lib/card-styles';

// Each corner is drawn for the top-right position; CSS rotates the other three into place.
const CORNERS: Record<CornerKind, React.ReactNode> = {
  leaf: (
    <>
      <path d="M6 74 C 20 50, 40 30, 74 8" fill="none" stroke="currentColor" strokeWidth="1" />
      <ellipse cx="22" cy="52" rx="4" ry="9" transform="rotate(-40 22 52)" fill="none" stroke="currentColor" strokeWidth="1" />
      <ellipse cx="38" cy="36" rx="4" ry="9" transform="rotate(-50 38 36)" fill="none" stroke="currentColor" strokeWidth="1" />
      <ellipse cx="54" cy="22" rx="4" ry="9" transform="rotate(-60 54 22)" fill="none" stroke="currentColor" strokeWidth="1" />
      <ellipse cx="14" cy="40" rx="3.5" ry="8" transform="rotate(20 14 40)" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="10" cy="64" r="2" fill="currentColor" />
    </>
  ),
  rule: (
    <>
      <path d="M18 8 H72 V62" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M26 16 H64 V54" fill="none" stroke="currentColor" strokeWidth=".7" />
      <path d="M72 8 L76 4" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="18" cy="8" r="1.6" fill="currentColor" />
      <circle cx="72" cy="62" r="1.6" fill="currentColor" />
    </>
  ),
  confetti: (
    <>
      <path d="M14 66 C 30 56, 46 36, 66 16" fill="none" stroke="currentColor" strokeWidth=".8" strokeDasharray="5 6" />
      <circle cx="70" cy="10" r="2.6" fill="currentColor" />
      <circle cx="52" cy="16" r="1.8" fill="currentColor" />
      <circle cx="24" cy="46" r="1.8" fill="currentColor" />
      <circle cx="12" cy="70" r="2.2" fill="currentColor" />
      <path d="M58 32 l5 5 M63 32 l-5 5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M34 60 l4 4 M38 60 l-4 4" stroke="currentColor" strokeWidth="1.2" />
      <rect x="40" y="38" width="6" height="6" transform="rotate(25 43 41)" fill="none" stroke="currentColor" strokeWidth="1" />
    </>
  ),
  deco: (
    <>
      <path d="M8 72 V44 H30 V22 H52 V8 H76" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M20 72 V56 H40 V36 H60 V20 H76" fill="none" stroke="currentColor" strokeWidth=".7" />
      <path d="M62 10 L70 2" stroke="currentColor" strokeWidth=".7" />
      <circle cx="76" cy="8" r="2" fill="currentColor" />
    </>
  ),
  scroll: (
    <>
      <path d="M10 70 C 34 66, 58 42, 70 12" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M22 72 C 40 62, 56 46, 62 24" fill="none" stroke="currentColor" strokeWidth=".7" />
      <path d="M70 12 C 62 10, 58 16, 62 20 C 66 24, 72 20, 70 12 Z" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M10 70 C 14 62, 20 62, 20 68 C 20 74, 12 74, 10 70 Z" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="44" cy="44" r="2.2" fill="currentColor" />
      <circle cx="56" cy="30" r="1.4" fill="currentColor" />
      <circle cx="32" cy="58" r="1.4" fill="currentColor" />
    </>
  ),
};

const FLOURISHES: Record<FlourishKind, React.ReactNode> = {
  classic: (
    <>
      <circle cx="3" cy="6" r="1.2" fill="currentColor" />
      <path d="M8 6 C 16 0, 26 0, 34 6 M46 6 C 54 12, 64 12, 72 6 M8 6 C 16 12, 26 12, 34 6 M46 6 C 54 0, 64 0, 72 6" fill="none" stroke="currentColor" strokeWidth=".8" />
      <path d="M40 1 L44 6 L40 11 L36 6 Z" fill="currentColor" />
      <circle cx="77" cy="6" r="1.2" fill="currentColor" />
    </>
  ),
  rule: (
    <>
      <path d="M2 6 H33 M47 6 H78" stroke="currentColor" strokeWidth=".8" />
      <path d="M40 2 L43 6 L40 10 L37 6 Z" fill="none" stroke="currentColor" strokeWidth=".8" />
      <circle cx="2" cy="6" r="1" fill="currentColor" />
      <circle cx="78" cy="6" r="1" fill="currentColor" />
    </>
  ),
  festive: (
    <>
      <path d="M4 8 C 12 2, 20 10, 28 5 M52 5 C 60 10, 68 2, 76 8" fill="none" stroke="currentColor" strokeWidth=".8" />
      <path d="M40 1 L41.6 4.6 L45.5 5 L42.5 7.6 L43.4 11.4 L40 9.4 L36.6 11.4 L37.5 7.6 L34.5 5 L38.4 4.6 Z" fill="currentColor" />
      <circle cx="31" cy="6" r="1.4" fill="currentColor" />
      <circle cx="49" cy="6" r="1.4" fill="currentColor" />
      <circle cx="12" cy="10" r="1" fill="currentColor" />
      <circle cx="68" cy="10" r="1" fill="currentColor" />
    </>
  ),
  deco: (
    <>
      <path d="M2 6 H20 L24 2 H32 L36 6 M44 6 L48 2 H56 L60 6 H78" fill="none" stroke="currentColor" strokeWidth=".8" />
      <path d="M36 6 H44" stroke="currentColor" strokeWidth="2" />
      <path d="M26 9 H54" stroke="currentColor" strokeWidth=".6" />
    </>
  ),
  ornate: (
    <>
      <path d="M2 6 C 10 0, 22 0, 30 6 C 22 12, 10 12, 2 6 Z M78 6 C 70 0, 58 0, 50 6 C 58 12, 70 12, 78 6 Z" fill="none" stroke="currentColor" strokeWidth=".7" />
      <path d="M40 1 L43 4 L46 6 L43 8 L40 11 L37 8 L34 6 L37 4 Z" fill="currentColor" />
      <circle cx="33" cy="6" r="1" fill="currentColor" />
      <circle cx="47" cy="6" r="1" fill="currentColor" />
    </>
  ),
};

function Corner({ kind, className }: { kind: CornerKind; className: string }) {
  return (
    <svg className={`corner ${className}`} viewBox="0 0 80 80" aria-hidden="true">
      {CORNERS[kind]}
    </svg>
  );
}

// Both ornaments follow the event's card style unless a preview passes its own.
export function Corners({ variant }: { variant?: CornerKind } = {}) {
  const current = useCurrentCardStyle();
  const kind = variant ?? current.corner;
  return <><Corner kind={kind} className="tl" /><Corner kind={kind} className="tr" /><Corner kind={kind} className="bl" /><Corner kind={kind} className="br" /></>;
}

export function Flourish({ variant }: { variant?: FlourishKind } = {}) {
  const current = useCurrentCardStyle();
  const kind = variant ?? current.flourish;
  return (
    <svg className="flourish" viewBox="0 0 80 12" aria-hidden="true">
      {FLOURISHES[kind]}
    </svg>
  );
}
