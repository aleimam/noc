'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { upsertBlock, deleteBlock } from './actions';

type B = { id: string; name: string; order: number };
const inp = 'rounded border border-graphite/20 bg-transparent px-2 py-1 text-sm';

export function BlocksManager({ neighborhoodId, blocks }: { neighborhoodId: string; blocks: B[] }) {
  const t = useTranslations('lands');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  function add() {
    if (!name.trim()) return;
    start(async () => {
      await upsertBlock({ neighborhoodId, name, order: blocks.length });
      setName('');
      router.refresh();
    });
  }
  function saveEdit(id: string) {
    if (!editName.trim()) return;
    start(async () => {
      await upsertBlock({ id, neighborhoodId, name: editName });
      setEditId(null);
      router.refresh();
    });
  }
  function del(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    start(async () => {
      await deleteBlock(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {blocks.length === 0 && <p className="text-sm opacity-60">{t('noBlocks')}</p>}
        {blocks.map((b) => (
          <div key={b.id} className="flex items-center gap-2 rounded border border-graphite/20 px-2 py-1 text-sm">
            {editId === b.id ? (
              <>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inp} />
                <button disabled={pending} onClick={() => saveEdit(b.id)} className="text-accent">{t('save')}</button>
                <button onClick={() => setEditId(null)} className="opacity-60">{t('cancel')}</button>
              </>
            ) : (
              <>
                <span className="font-medium">{b.name}</span>
                <button onClick={() => { setEditId(b.id); setEditName(b.name); }} className="text-accent">{t('edit')}</button>
                <button disabled={pending} onClick={() => del(b.id)} className="text-red-600">{t('delete')}</button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('blockName')} className={inp} />
        <button disabled={pending || !name.trim()} onClick={add} className="rounded bg-primary px-3 py-1.5 text-sm text-soft disabled:opacity-50">+ {t('addBlock')}</button>
      </div>
    </div>
  );
}
