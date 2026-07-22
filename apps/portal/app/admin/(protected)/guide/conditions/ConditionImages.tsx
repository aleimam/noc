'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { FileDropzone } from '@noc/ui';

// Manage the condition's `images` (string[] of /uploads paths): choose/drag/paste to upload
// (no stamping — the sheets are already الصواري-branded), reorder, remove. Shown big on the
// public page below the tables.
export function ConditionImages({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  async function upload(files: File[]) {
    setBusy(true);
    try {
      const added: string[] = [];
      for (const f of files) {
        const fd = new FormData();
        fd.append('file', f);
        const r = await fetch('/api/upload', { method: 'POST', body: fd });
        const j = await r.json().catch(() => null);
        if (j?.ok && j.attachment?.path) added.push(j.attachment.path as string);
      }
      if (added.length) onChange([...value, ...added]);
    } finally {
      setBusy(false);
    }
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const a = [...value];
    [a[i], a[j]] = [a[j]!, a[i]!];
    onChange(a);
  };

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {value.map((src, i) => (
            <div key={`${src}-${i}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-28 w-28 rounded-lg object-cover ring-1 ring-graphite/20" />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs text-white"
                aria-label={L('حذف', 'Delete')}
              >
                ✕
              </button>
              <div className="absolute inset-x-1 bottom-1 flex justify-between">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded bg-black/60 px-1.5 text-xs text-white disabled:opacity-30" aria-label={L('لليمين', 'Move right')}>
                  ›
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} className="rounded bg-black/60 px-1.5 text-xs text-white disabled:opacity-30" aria-label={L('لليسار', 'Move left')}>
                  ‹
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <FileDropzone accept="image/*" multiple busy={busy} onFiles={upload} label={L('إضافة صور', 'Add images')} hint={L('اختر أو اسحب أو الصق الصور — تظهر أسفل الصفحة', 'Choose, drag or paste images — they appear at the bottom of the page')} />
    </div>
  );
}
