// Design-system primitives. Every interactive element gets the same three states:
//   hover  -> the fill visibly changes (dark -> bright, bright -> white), never a shade shift
//   active -> presses down 1px
//   focus  -> a 3px gold ring with an offset, visible on any background
// Colors come from the tokens in src/app/globals.css (checked by tests/design-tokens.test.ts).
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export const focusRing =
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gold";

const base =
  `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-150 ` +
  `active:translate-y-px disabled:pointer-events-none disabled:border-transparent disabled:bg-raised ` +
  `disabled:text-muted/70 disabled:shadow-none ${focusRing}`;

const variants = {
  // The one main action on screen: gold, turns white on hover.
  primary: "bg-gold text-ink shadow-[0_2px_12px_rgb(255_216_77/0.35)] hover:bg-text",
  // Other actions: solid raised panel with a visible border; fills cyan on hover.
  secondary: "border-2 border-line bg-raised text-text hover:border-cyan hover:bg-cyan hover:text-ink",
  // Quiet actions (nav, dismiss): no fill until hover.
  ghost: "text-text hover:bg-hover",
  // Destructive quiet action (unfollow): turns red on hover.
  danger: "text-muted hover:bg-down hover:text-ink",
} as const;

const sizes = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-base",
  icon: "size-9 text-base",
} as const;

export function buttonClass(variant: keyof typeof variants = "secondary", size: keyof typeof sizes = "md") {
  return `${base} ${variants[variant]} ${sizes[size]}`;
}

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants; size?: keyof typeof sizes }) {
  return <button {...props} className={`${buttonClass(variant, size)} ${className}`} />;
}

// A solid card on the starfield. Never translucent: text must not sit on stars or map.
export function Panel({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={`rounded-2xl border border-line/60 bg-surface p-4 shadow-[0_8px_32px_rgb(0_0_0/0.35)] ${className}`} />;
}

// Small uppercase label above a group ("Telemetry", "Your cities").
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`font-mono text-sm font-semibold uppercase tracking-[0.18em] text-cyan ${className}`}>{children}</h2>;
}

// Data-state pill: the only place fresh/stale/down colors are used as fills.
export type Tone = "fresh" | "stale" | "down" | "neutral";
const tones: Record<Tone, string> = {
  fresh: "bg-fresh text-ink",
  stale: "bg-stale text-ink",
  down: "bg-down text-ink",
  neutral: "bg-raised text-muted",
};

export function StatusPill({ tone, children, pulse = false }: { tone: Tone; children: ReactNode; pulse?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${tones[tone]}`}>
      <span aria-hidden className={`size-2.5 rounded-full bg-ink/80 ${pulse ? "animate-pulse" : ""}`} />
      {children}
    </span>
  );
}
