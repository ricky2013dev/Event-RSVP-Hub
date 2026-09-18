export function Leaf({ className }: { className: string }) {
  return (
    <svg className={`corner ${className}`} viewBox="0 0 80 80" aria-hidden="true">
      <path d="M6 74 C 20 50, 40 30, 74 8" fill="none" stroke="currentColor" strokeWidth="1" />
      <ellipse cx="22" cy="52" rx="4" ry="9" transform="rotate(-40 22 52)" fill="none" stroke="currentColor" strokeWidth="1" />
      <ellipse cx="38" cy="36" rx="4" ry="9" transform="rotate(-50 38 36)" fill="none" stroke="currentColor" strokeWidth="1" />
      <ellipse cx="54" cy="22" rx="4" ry="9" transform="rotate(-60 54 22)" fill="none" stroke="currentColor" strokeWidth="1" />
      <ellipse cx="14" cy="40" rx="3.5" ry="8" transform="rotate(20 14 40)" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="10" cy="64" r="2" fill="currentColor" />
    </svg>
  );
}

export function Corners() {
  return <><Leaf className="tl" /><Leaf className="tr" /><Leaf className="bl" /><Leaf className="br" /></>;
}

export function Flourish() {
  return (
    <svg className="flourish" viewBox="0 0 80 12" aria-hidden="true">
      <circle cx="3" cy="6" r="1.2" fill="currentColor" />
      <path d="M8 6 C 16 0, 26 0, 34 6 M46 6 C 54 12, 64 12, 72 6 M8 6 C 16 12, 26 12, 34 6 M46 6 C 54 0, 64 0, 72 6" fill="none" stroke="currentColor" strokeWidth=".8" />
      <path d="M40 1 L44 6 L40 11 L36 6 Z" fill="currentColor" />
      <circle cx="77" cy="6" r="1.2" fill="currentColor" />
    </svg>
  );
}
