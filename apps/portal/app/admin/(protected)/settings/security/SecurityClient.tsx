'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setSecurityLevel } from './actions';

type Opt = { value: string; title: string; summary: string; points: string[] };

export function SecurityClient({
  current,
  options,
  saveLabel,
  savingLabel,
  savedLabel,
}: {
  current: string;
  options: Opt[];
  saveLabel: string;
  savingLabel: string;
  savedLabel: string;
}) {
  const router = useRouter();
  const [level, setLevel] = useState(current);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(false);
    start(async () => {
      const r = await setSecurityLevel(level);
      if (r.ok) {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((o) => {
          const active = level === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                setLevel(o.value);
                setSaved(false);
              }}
              className={`rounded-xl border-2 p-4 text-start transition ${
                active ? 'border-accent bg-accent/5' : 'border-graphite/15 hover:border-graphite/30'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-lg font-bold text-primary">{o.title}</span>
                <span
                  className={`h-4 w-4 flex-none rounded-full border-2 ${active ? 'border-accent bg-accent' : 'border-graphite/30'}`}
                  aria-hidden
                />
              </div>
              <p className="mt-1 text-sm opacity-70">{o.summary}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {o.points.map((p, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span aria-hidden>•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={pending || level === current}
          onClick={save}
          className="rounded-md bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50"
        >
          {pending ? savingLabel : saveLabel}
        </button>
        {saved && <span className="text-sm text-green">{savedLabel} ✓</span>}
      </div>
    </div>
  );
}
