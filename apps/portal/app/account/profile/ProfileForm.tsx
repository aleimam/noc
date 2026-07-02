'use client';

import { useState, type FormEvent } from 'react';
import { updateProfile } from './actions';

type Labels = {
  name: string;
  namePlaceholder: string;
  phone: string;
  phoneNote: string;
  save: string;
  saved: string;
  error: string;
};

export function ProfileForm({
  initialName,
  phone,
  labels,
}: {
  initialName: string;
  phone: string;
  labels: Labels;
}) {
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('saving');
    const fd = new FormData();
    fd.set('name', name);
    const res = await updateProfile(fd);
    setStatus(res.ok ? 'saved' : 'error');
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="block text-sm">{labels.name}</label>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setStatus('idle');
          }}
          placeholder={labels.namePlaceholder}
          maxLength={120}
          className="w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm">{labels.phone}</label>
        <input
          value={phone}
          dir="ltr"
          readOnly
          disabled
          className="w-full rounded-md border border-graphite/15 bg-graphite/5 px-3 py-2 opacity-70"
        />
        <p className="text-xs opacity-60">{labels.phoneNote}</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === 'saving'}
          className="rounded-md bg-primary px-4 py-2 text-sm text-soft disabled:opacity-60"
        >
          {labels.save}
        </button>
        {status === 'saved' && <span className="text-sm text-green">{labels.saved}</span>}
        {status === 'error' && <span className="text-sm text-red-600">{labels.error}</span>}
      </div>
    </form>
  );
}
