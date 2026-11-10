import { useEffect, useState } from "react";

type Stage = "lot" | "building" | "done";
export function buildStage(total: number, open: number): Stage {
  if (!total) return "lot";
  return open === 0 ? "done" : "building";
}
const STAGE_LABEL: Record<Stage, string> = { lot: "Empty lot — freshly zoned", building: "Under construction", done: "Built! All to-dos done" };

export function BuildStageBadge({ total, open }: { total: number; open: number }) {
  const s = buildStage(total, open);
  return (
    <span title={STAGE_LABEL[s]} aria-label={STAGE_LABEL[s]} className="inline-flex h-6 w-6 items-center justify-center text-brand-teal">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 21h20" />
        {s === "lot" && <><path d="M5 21v-3M19 21v-3M5 18h14" strokeDasharray="2 2" /><path d="M12 18v-5l3 1.5-3 1.5" /></>}
        {s === "building" && <><path d="M6 21V4M6 4h12M15 4v4" /><path d="M14 8h2v3h-2z" /><path d="M10 21v-6h8v6" /><path d="M6 8l4-4" /></>}
        {s === "done" && <><path d="M4 21V10h6v11M10 21V5h8v16M18 21v-8h3v8" /><path d="M13 8h2M13 11h2M13 14h2M6 13h2M6 16h2" /></>}
      </svg>
    </span>
  );
}

const DOODLES = {
  crane: <><path d="M20 110h80M35 110V20M35 20h60M85 20v20" /><path d="M80 40h10v12H80z" /><path d="M35 35l15-15M25 20h10" /><path d="M50 110V80h30v30" /></>,
  cone: <><path d="M40 110h40M48 110l12-80 12 80" /><path d="M52 85h16M55 65h10" /></>,
  pole: <><path d="M60 110V20M40 30h40M45 45h30" /><path d="M0 40q20 15 40-10M80 30q20 25 40 10" /></>,
  block: <><path d="M10 110h100M18 110V60h22v50M40 110V35h30v75M70 110V70h30v40" /><path d="M48 50h6M58 50h6M48 65h6M58 65h6M48 80h6M58 80h6M25 75h8M78 85h6M88 85h6" /></>,
  bulb: <><path d="M60 20a25 25 0 0 0-15 45v15h30V65a25 25 0 0 0-15-45z" /><path d="M48 90h24M52 100h16" /></>,
};
export function CityDoodle({ kind, className = "h-28 w-28" }: { kind: keyof typeof DOODLES; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={`text-brand-teal/70 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {DOODLES[kind]}
    </svg>
  );
}

export function Skyline({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 80" preserveAspectRatio="none" className={`skyline pointer-events-none w-full ${className}`} aria-hidden>
      <path d="M0 80V55h30V40h20v15h25V25h18v-8h10v8h17v55h10V45h35V30h25v50h15V50h30V15h12v35h20v30h18V38h28v42h20V55h40V35h15V20h20v15h12v45h25V48h35v32h18V30h22v50h20V58h35v22z" />
    </svg>
  );
}

export function PowerLine({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 40" preserveAspectRatio="none" className={`pointer-events-none w-full text-brand-teal/40 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      {[10, 200, 390].map((x) => <g key={x}><path d={`M${x} 40V6M${x - 8} 8h16`} /></g>)}
      <path d="M2 8q103 22 196 0M2 8M202 8q95 22 196 0" />
      <path d="M18 8q90 18 172 0M210 8q90 18 172 0" opacity=".6" />
    </svg>
  );
}

export function buildBurst(x: number, y: number) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["var(--primary)", "var(--brand-teal)", "var(--brand-green)"];
  for (let i = 0; i < 14; i++) {
    const el = document.createElement("span");
    const a = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
    const d = 40 + Math.random() * 40;
    el.className = "brick-bit";
    el.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % 3]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 20}px;--r:${Math.random() * 360}deg`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }
}

export function greeting(name?: string | null) {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return `${part}${name ? `, ${name.split(" ")[0]}` : ""} — what are we building today?`;
}

const PROMPTS = [
  "Zone a new idea… what should this city try next?",
  "Lay down a rough idea — we'll pave it later…",
  "What would make this block better?",
  "Got a spark? Plug it into the grid…",
  "Sketch a blueprint, however rough…",
];
export function useRotatingPrompt(ms = 5000) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((n) => (n + 1) % PROMPTS.length), ms); return () => clearInterval(t); }, [ms]);
  return PROMPTS[i];
}

const LOADING = ["Laying down roads…", "Connecting power…", "Pouring foundations…", "Surveying the lots…"];
export function CityLoading() {
  const [msg] = useState(() => LOADING[Math.floor(Math.random() * LOADING.length)]);
  return <p className="py-20 text-center text-sm text-muted-foreground"><span className="animate-blink">{msg}</span></p>;
}
