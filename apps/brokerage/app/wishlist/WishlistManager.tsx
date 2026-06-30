'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { LandCard } from '../../lib/listings';
import { createList, renameList, deleteList, removeItem } from '../account/actions';

type Item = { itemId: string; card: LandCard };
type List = { id: string; name: string; items: Item[] };

const fmt = (n: number) => n.toLocaleString('en');

export function WishlistManager({ lists, locale }: { lists: List[]; locale: 'ar' | 'en' }) {
  const router = useRouter();
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [pending, start] = useTransition();
  const [newName, setNewName] = useState('');
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div className="space-y-8">
      <form
        onSubmit={(e) => { e.preventDefault(); if (newName.trim()) run(async () => { await createList(newName); setNewName(''); }); }}
        className="flex gap-2"
      >
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={L('اسم قائمة جديدة', 'New list name')} className="flex-1 rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 dark:bg-navy-800 dark:text-soft" />
        <button disabled={pending} className="rounded-xl bg-navy px-5 py-2.5 font-bold text-soft disabled:opacity-50">{L('إنشاء قائمة', 'New list')}</button>
      </form>

      {lists.length === 0 && (
        <p className="rounded-2xl bg-white p-8 text-center text-ink-500 shadow-sm dark:bg-navy-800">
          {L('لا توجد قوائم بعد — احفظ أرضاً بالضغط على ♥', 'No lists yet — save a land with ♥')}
        </p>
      )}

      {lists.map((list) => (
        <section key={list.id}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-navy-800 dark:text-soft">{list.name} <span className="text-sm font-normal text-ink-400">({list.items.length})</span></h2>
            <div className="flex gap-2 text-sm">
              <button
                onClick={() => { const n = prompt(L('اسم جديد', 'New name'), list.name); if (n) run(() => renameList(list.id, n)); }}
                className="text-navy-600 dark:text-white/70"
              >{L('إعادة تسمية', 'Rename')}</button>
              <button
                onClick={() => { if (confirm(L('حذف القائمة؟', 'Delete list?'))) run(() => deleteList(list.id)); }}
                className="text-red-600"
              >{L('حذف', 'Delete')}</button>
            </div>
          </div>

          {list.items.length === 0 ? (
            <p className="text-sm text-ink-400">{L('القائمة فارغة', 'Empty list')}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {list.items.map(({ itemId, card }) => (
                <div key={itemId} className="relative flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm dark:border-white/10 dark:bg-navy-800">
                  <button onClick={() => run(() => removeItem(itemId))} className="absolute end-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink-500 shadow" aria-label="remove">✕</button>
                  <Link href={`/listings/${card.id}`} className="flex flex-1 flex-col">
                    <div className="aspect-[16/10] bg-navy-100">
                      {card.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={card.cover} alt={card.title} className="h-full w-full object-cover" />
                      ) : <div className="flex h-full items-center justify-center text-3xl text-navy-300">🏞</div>}
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-3">
                      <div className="line-clamp-1 font-bold text-navy-800 dark:text-soft">{card.title}</div>
                      <div className="text-xs text-ink-500">{card.area ? `${fmt(card.area)} ${L('م²', 'm²')}` : ''}{card.cityAr ? ` · ${card.cityAr}` : ''}</div>
                      <div className="mt-auto font-num font-bold text-navy-800 dark:text-soft">
                        {card.status === 'SOLD' ? L('تم البيع', 'Sold') : card.price != null ? `${fmt(card.price)} ${L('ج.م', 'EGP')}` : L('عند الطلب', 'On request')}
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
