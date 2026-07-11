'use client';

// Tiny localStorage-backed compare set (max 4), with a window event so the bar updates.
const KEY = 'cmp';
export const COMPARE_MAX = 4;
export const COMPARE_EVENT = 'cmp-change';

export function getCompare(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  localStorage.setItem(KEY, JSON.stringify(ids.slice(0, COMPARE_MAX)));
  window.dispatchEvent(new Event(COMPARE_EVENT));
}

/** Toggle an id in the compare set. Returns what happened so the caller can react
 *  (e.g. toast when the set is full — this module is plain, no UI here). */
export function toggleCompare(id: string): 'added' | 'removed' | 'full' {
  const ids = getCompare();
  const i = ids.indexOf(id);
  if (i >= 0) {
    ids.splice(i, 1);
    write(ids);
    return 'removed';
  }
  if (ids.length >= COMPARE_MAX) return 'full';
  ids.push(id);
  write(ids);
  return 'added';
}

export function clearCompare() {
  write([]);
}
