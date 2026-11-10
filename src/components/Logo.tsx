export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="cg-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--primary)" }} />
          <stop offset="1" style={{ stopColor: "var(--brand-teal)" }} />
        </linearGradient>
        <linearGradient id="cg-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--brand-teal)" }} />
          <stop offset="1" style={{ stopColor: "var(--brand-green)" }} />
        </linearGradient>
      </defs>
      <circle cx="12" cy="16" r="9" fill="none" stroke="url(#cg-a)" strokeWidth="4" />
      <circle cx="20" cy="16" r="9" fill="none" stroke="url(#cg-b)" strokeWidth="4" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-primary">
      <LogoMark /> Common Ground
    </span>
  );
}
