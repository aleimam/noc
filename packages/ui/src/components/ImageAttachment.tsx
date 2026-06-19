'use client';

import { useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Lightbox } from './Lightbox';

const MAX_BYTES = 32 * 1024 * 1024;

export interface UploadedAttachment {
  id: string;
  path: string;
  originalName: string;
  width?: number | null;
  height?: number | null;
}

/**
 * Reusable image field: click / paste / drag-drop, client-side size + type guard,
 * uploads to `uploadUrl`, shows a thumbnail, and expands to a fullscreen lightbox.
 * Controlled via `value`/`onChange` so any form can bind it to an attachment id.
 */
export function ImageAttachment({
  value,
  onChange,
  uploadUrl = '/api/upload',
}: {
  value?: UploadedAttachment | null;
  onChange?: (a: UploadedAttachment | null) => void;
  uploadUrl?: string;
}) {
  const t = useTranslations('attachment');
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [zoom, setZoom] = useState(false);

  async function upload(file: File | null | undefined) {
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) return setError(t('invalidType'));
    if (file.size > MAX_BYTES) return setError(t('tooLarge'));
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(uploadUrl, { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        return setError(json?.error === 'too_large' ? t('tooLarge') : t('invalidType'));
      }
      onChange?.(json.attachment as UploadedAttachment);
    } catch {
      setError(t('invalidType'));
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    void upload(e.dataTransfer.files?.[0]);
  }
  function onPaste(e: ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (item) void upload(item.getAsFile());
  }
  function onPick(e: ChangeEvent<HTMLInputElement>) {
    void upload(e.target.files?.[0]);
    e.target.value = '';
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setZoom(true)} aria-label="Expand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value.path}
              alt={value.originalName}
              className="h-24 w-24 rounded-md object-cover ring-1 ring-graphite/20"
            />
          </button>
          <button
            type="button"
            onClick={() => onChange?.(null)}
            className="text-sm text-red-600 hover:underline"
          >
            ✕
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
          }}
          onPaste={onPaste}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex h-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors ${
            dragOver ? 'border-accent bg-accent/5' : 'border-graphite/25 hover:border-graphite/40'
          }`}
        >
          {busy ? t('uploading') : t('drop')}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onPick} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {zoom && value && (
        <Lightbox src={value.path} alt={value.originalName} onClose={() => setZoom(false)} />
      )}
    </div>
  );
}
