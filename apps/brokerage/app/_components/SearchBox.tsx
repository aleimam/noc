'use client';

import { SearchAutocomplete } from '@noc/ui';

/** Compact header search on the navy bar — the same instant-suggestions box as the hero and
 *  /market, restyled for the dark navbar. Wrapper metrics match the old plain form so the
 *  single-row header layout (fragile at ~820px) is unchanged; the input is 16px (text-base)
 *  to avoid the iOS focus-zoom. The button stays a compact glyph here (space-constrained bar —
 *  the big «بحث» word lives on the hero + results surfaces). */
export function SearchBox({ placeholder, initial = '', className = '' }: { placeholder: string; initial?: string; className?: string }) {
  return (
    <SearchAutocomplete
      action="/listings"
      initialQuery={initial}
      placeholder={placeholder}
      className={`rounded-xl border border-white/20 bg-white/10 px-3 py-1 ${className}`}
      inputClassName="w-full min-w-0 bg-transparent text-base text-white placeholder:text-white/60 outline-none"
      buttonClassName="shrink-0 min-h-10 px-2.5 text-lg text-white/80 hover:text-white"
      buttonLabel="🔍"
    />
  );
}
