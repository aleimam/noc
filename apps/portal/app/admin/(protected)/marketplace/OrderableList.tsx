'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from '@noc/ui';

type Result = { ok: true } | { ok: false; error: string };
type Item = { id: string; label: string };

// Reorder a list with ▲/▼ buttons, then persist the new order with a Save button.
export function OrderableList({
  items,
  action,
  title,
}: {
  items: Item[];
  action: (ids: string[]) => Promise<Result>;
  title?: string;
}) {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const t = useTranslations('mp');
  const router = useRouter();
  const [order, setOrder] = useState<Item[]>(items);
  const [pending, start] = useTransition();

  // Re-sync when the server data changes (after a refresh / edit / delete).
  useEffect(() => setOrder(items), [items]);

  if (items.length < 2) return null;
  const dirty = order.some((o, i) => o.id !== items[i]?.id);

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setOrder(next);
  }

  function save() {
    start(async () => {
      const r = await action(order.map((o) => o.id));
      if (r.ok) {
        toast(t('savedOk'));
        router.refresh();
      } else {
        toast(L('تعذّر الحفظ', 'Save failed'), 'error');
      }
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-graphite/15 p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title ?? t('reorder')}</h3>
        <button disabled={!dirty || pending} onClick={save} className="rounded bg-primary px-3 py-1 text-xs text-soft disabled:opacity-40">
          {t('saveOrder')}
        </button>
      </div>
      <ul className="space-y-1">
        {order.map((o, i) => (
          <li key={o.id} className="flex items-center justify-between gap-2 rounded border border-graphite/10 px-2 py-1 text-sm">
            <span className="truncate">{o.label}</span>
            <span className="flex shrink-0 gap-1">
              <button disabled={i === 0} onClick={() => move(i, -1)} className="rounded px-2 py-0.5 hover:bg-graphite/10 disabled:opacity-30" aria-label="up">▲</button>
              <button disabled={i === order.length - 1} onClick={() => move(i, 1)} className="rounded px-2 py-0.5 hover:bg-graphite/10 disabled:opacity-30" aria-label="down">▼</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
