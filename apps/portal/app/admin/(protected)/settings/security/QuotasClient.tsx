'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setSecurityQuotas } from './actions';

type Row = { level: 'LIGHT' | 'MEDIUM' | 'HIGH'; title: string; anonPerHour: number; userPerHour: number; ipCeilingPerHour: number };

// Editable hourly quota numbers per level (effective values prefilled; saving stores
// overrides — empty/invalid fields keep the built-in preset).
export function QuotasClient({
  rows,
  labels,
}: {
  rows: Row[];
  labels: { anon: string; user: string; ceiling: string; save: string; saving: string; saved: string; hint: string };
}) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, { anonPerHour: string; userPerHour: string; ipCeilingPerHour: string }>>(() =>
    Object.fromEntries(
      rows.map((r) => [r.level, { anonPerHour: String(r.anonPerHour), userPerHour: String(r.userPerHour), ipCeilingPerHour: String(r.ipCeilingPerHour) }]),
    ),
  );
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const set = (level: string, key: 'anonPerHour' | 'userPerHour' | 'ipCeilingPerHour', v: string) => {
    setSaved(false);
    setState((s) => ({ ...s, [level]: { ...s[level]!, [key]: v } }));
  };

  function save() {
    setSaved(false);
    start(async () => {
      const quotas = Object.fromEntries(
        Object.entries(state).map(([level, v]) => [
          level,
          { anonPerHour: Number(v.anonPerHour), userPerHour: Number(v.userPerHour), ipCeilingPerHour: Number(v.ipCeilingPerHour) },
        ]),
      );
      const r = await setSecurityQuotas(quotas);
      if (r.ok) {
        setSaved(true);
        router.refresh();
      }
    });
  }

  const cell = 'w-24 rounded border border-graphite/20 bg-transparent px-2 py-1.5 text-center text-sm';

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="min-w-[480px] text-sm">
          <thead>
            <tr className="text-start opacity-70">
              <th className="py-2 pe-4 text-start font-medium"> </th>
              <th className="px-2 py-2 font-medium">{labels.anon}</th>
              <th className="px-2 py-2 font-medium">{labels.user}</th>
              <th className="px-2 py-2 font-medium">{labels.ceiling}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.level} className="border-t border-graphite/10">
                <td className="py-2 pe-4 font-semibold text-primary">{r.title}</td>
                {(['anonPerHour', 'userPerHour', 'ipCeilingPerHour'] as const).map((k) => (
                  <td key={k} className="px-2 py-2 text-center">
                    <input type="number" min={1} inputMode="numeric" value={state[r.level]?.[k] ?? ''} onChange={(e) => set(r.level, k, e.target.value)} className={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs opacity-60">{labels.hint}</p>
      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50">
          {pending ? labels.saving : labels.save}
        </button>
        {saved && <span className="text-sm text-green">{labels.saved} ✓</span>}
      </div>
    </div>
  );
}
