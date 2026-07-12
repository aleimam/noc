'use client';

import { useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Lightbox } from './Lightbox';
import { compressImage } from '../lib/compress';

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
  stampCategory,
  nameHint,
}: {
  value?: UploadedAttachment | null;
  onChange?: (a: UploadedAttachment | null) => void;
  uploadUrl?: string;
  stampCategory?: string; // tags the upload's stamping category/module (e.g. 'listing', 'none')
  nameHint?: string; // descriptive slug hint → keyword-rich saved filename (image SEO)
}) {
  const t = useTranslations('attachment');
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [zoom, setZoom] = useState(false);

  async function upload(input: File | null | undefined) {
    if (!input) return;
    setError('');
    // iPhone HEIC/HEIF photos can't be decoded by browsers or our pipeline — catch up front.
    if (input.type.startsWith('image/hei') || /\.(heic|heif)$/i.test(input.name)) {
      return setError(t('heicUnsupported'));
    }
    if (!input.type.startsWith('image/')) return setError(t('invalidType'));
    setBusy(true);
    try {
      const file = await compressImage(input);
      if (file.size > MAX_BYTES) {
        setBusy(false);
        return setError(t('tooLarge'));
      }
      const fd = new FormData();
      fd.append('file', file);
      const params = new URLSearchParams();
      if (stampCategory) params.set('stamp', stampCategory);
      if (nameHint?.trim()) params.set('name', nameHint.trim());
      const qs = params.toString();
      const url = qs ? `${uploadUrl}${uploadUrl.includes('?') ? '&' : '?'}${qs}` : uploadUrl;
      const res = await fetch(url, { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        return setError(
          json?.error === 'too_large' ? t('tooLarge')
          : json?.error === 'rate_limited' ? t('rateLimited')
          : json?.error === 'invalid_type' ? t('invalidType')
          : t('failed'),
        );
      }
      onChange?.(json.attachment as UploadedAttachment);
    } catch {
      setError(t('failed'));
    } finally {
      setBusy(false);
    }
  }

  async function uploadMany(list: Iterable<File>) {
    for (const f of list) await upload(f);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    void uploadMany(Array.from(e.dataTransfer.files ?? []));
  }
  function onPaste(e: ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (item) void upload(item.getAsFile());
  }
  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    void uploadMany(files);
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
            aria-label={t('remove')}
            className="flex h-10 w-10 items-center justify-center rounded-full text-lg text-red-600 hover:bg-red-600/10"
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
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={onPick} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {zoom && value && (
        <Lightbox src={value.path} alt={value.originalName} onClose={() => setZoom(false)} />
      )}
    </div>
  );
}
