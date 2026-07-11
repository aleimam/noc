import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/** Soft-tinted status pill with an optional leading dot. Tones map to the brand
 *  + land-status palette. Use `Badge.land('alloc')` presets for legal land states. */
const TONES = {
  neutral: { bg: 'bg-ink-200/50', fg: 'text-ink-700', dot: 'bg-ink-400' },
  navy: { bg: 'bg-navy-50', fg: 'text-navy-700', dot: 'bg-navy-600' },
  gold: { bg: 'bg-gold-100', fg: 'text-gold-800', dot: 'bg-gold-600' },
  green: { bg: 'bg-green/12', fg: 'text-success', dot: 'bg-green' },
  slate: { bg: 'bg-status-mail/12', fg: 'text-status-mail', dot: 'bg-status-mail' },
  blue: { bg: 'bg-info-soft', fg: 'text-info', dot: 'bg-info' },
  amber: { bg: 'bg-status-build/15', fg: 'text-warning', dot: 'bg-status-build' },
  success: { bg: 'bg-success-soft', fg: 'text-success', dot: 'bg-success' },
  warning: { bg: 'bg-warning-soft', fg: 'text-gold-800', dot: 'bg-warning' },
  danger: { bg: 'bg-danger-soft', fg: 'text-danger', dot: 'bg-danger' },
  info: { bg: 'bg-info-soft', fg: 'text-info', dot: 'bg-info' },
} as const;

export type BadgeTone = keyof typeof TONES;

const SIZES = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
} as const;

export function Badge({
  children,
  tone = 'neutral',
  size = 'md',
  dot = false,
  className = '',
}: {
  children: ReactNode;
  tone?: BadgeTone;
  size?: keyof typeof SIZES;
  dot?: boolean;
  className?: string;
}) {
  const t = TONES[tone] ?? TONES.neutral;
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-bold leading-none', t.bg, t.fg, SIZES[size], className)}>
      {dot && <span className={cn('h-1.5 w-1.5 flex-none rounded-full', t.dot)} />}
      {children}
    </span>
  );
}
