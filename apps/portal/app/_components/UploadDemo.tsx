'use client';

import { useState } from 'react';
import { ImageAttachment, type UploadedAttachment } from '@noc/ui';

export function UploadDemo() {
  const [att, setAtt] = useState<UploadedAttachment | null>(null);
  return (
    <div className="max-w-sm space-y-2">
      <ImageAttachment value={att} onChange={setAtt} />
      {att && <p className="break-all text-xs opacity-60">id: {att.id}</p>}
    </div>
  );
}
