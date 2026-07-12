'use client';

import { useEffect, useState } from 'react';
import { waPhone } from '@noc/config';

/**
 * Floating WhatsApp contact button — fixed to the bottom-end corner (logical, so it sits
 * bottom-left in RTL Arabic and bottom-right in LTR). Big, single-tap, WhatsApp green with a
 * white glyph (Golden Rule: biggest/simplest for low-tech mobile users). Opens a wa.me chat in
 * a new tab, optionally pre-filled with `message`. Renders nothing when no number is set, so a
 * caller can pass the raw admin value without guarding.
 */
export function FloatingWhatsApp({ phone, message, label }: { phone: string; message?: string; label: string }) {
  const [shown, setShown] = useState(false);
  // Subtle enter animation (fade + rise) once mounted on the client.
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!phone || !phone.trim()) return null;
  const href = `https://wa.me/${waPhone(phone)}${message && message.trim() ? `?text=${encodeURIComponent(message)}` : ''}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={`fixed bottom-4 end-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg outline-none ring-offset-2 transition duration-300 hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[#25D366] ${shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8" aria-hidden="true">
        <path d="M12.04 2A9.9 9.9 0 0 0 2.1 11.9c0 1.75.46 3.45 1.34 4.96L2 22l5.3-1.39a9.96 9.96 0 0 0 4.74 1.2h.01a9.9 9.9 0 0 0 9.94-9.9A9.83 9.83 0 0 0 19.07 4.9 9.9 9.9 0 0 0 12.04 2Zm0 18.13h-.01a8.24 8.24 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38 8.23 8.23 0 0 1 8.26-8.2 8.2 8.2 0 0 1 5.83 2.42 8.15 8.15 0 0 1 2.41 5.8 8.23 8.23 0 0 1-8.24 8.22Zm4.52-6.15c-.25-.13-1.47-.72-1.69-.8-.23-.09-.4-.13-.56.12-.17.25-.64.8-.79.97-.14.16-.29.19-.53.06a6.7 6.7 0 0 1-1.98-1.22 7.4 7.4 0 0 1-1.37-1.7c-.14-.25-.02-.38.11-.5.11-.12.25-.3.37-.44.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.47c-.17 0-.44.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.9 2.4 1.02 2.57.12.16 1.74 2.65 4.23 3.72.59.25 1.05.4 1.41.52.6.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.28Z" />
      </svg>
    </a>
  );
}
