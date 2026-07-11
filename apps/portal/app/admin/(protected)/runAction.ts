'use client';
import { toast } from '@noc/ui';

type Result = { ok: true } | { ok: false; error?: string };

/** Run a server action with optional confirm; toasts on failure, returns success. */
export async function runAction(
  fn: () => Promise<Result>,
  opts?: { confirmText?: string; successText?: string; errorText?: string },
): Promise<boolean> {
  if (opts?.confirmText && !window.confirm(opts.confirmText)) return false;
  try {
    const r = await fn();
    if (!r.ok) {
      toast(opts?.errorText ?? 'Failed', 'error');
      return false;
    }
    if (opts?.successText) toast(opts.successText);
    return true;
  } catch {
    toast(opts?.errorText ?? 'Failed', 'error');
    return false;
  }
}
