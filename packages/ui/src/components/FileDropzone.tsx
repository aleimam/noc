'use client';

import { useRef, useState, type ClipboardEvent, type DragEvent } from 'react';

/**
 * Presentational uploader: an obvious "choose" button + drag & drop + paste, for any
 * file type. It doesn't upload — it hands selected File(s) to `onFiles`, so each caller
 * wires its own handling (client parse, server action, /api/upload, …).
 */
export function FileDropzone({
  accept,
  multiple = false,
  onFiles,
  label,
  hint,
  selectedName,
  busy = false,
  disabled = false,
}: {
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  label: string; // button text, localized by the caller
  hint?: string; // small hint under the button
  selectedName?: string; // chosen file name(s) to display
  busy?: boolean;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const emit = (list: FileList | null | undefined) => {
    if (!list || list.length === 0) return;
    onFiles(multiple ? Array.from(list) : [list[0]!]);
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onPaste={(e: ClipboardEvent) => {
        if (disabled) return;
        const files = Array.from(e.clipboardData.files);
        if (files.length) {
          e.preventDefault();
          onFiles(multiple ? files : [files[0]!]);
        }
      }}
      onDragOver={(e: DragEvent) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (!disabled) emit(e.dataTransfer.files);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
        dragOver ? 'border-accent bg-accent/5' : 'border-graphite/30 hover:border-accent/60'
      } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    >
      <span className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-base font-bold text-soft">
        <span aria-hidden>⬆</span> {busy ? `${label} …` : label}
      </span>
      {hint && <span className="text-xs opacity-60">{hint}</span>}
      {selectedName && <span className="mt-1 break-all text-sm font-medium text-primary">{selectedName}</span>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
