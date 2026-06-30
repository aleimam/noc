'use client';

import { useEffect } from 'react';

// Global "Enter submits the form" helper. Mounted once per app. When the user presses
// Enter inside a single-line text input that is NOT already inside a native <form>, it
// finds the nearest primary action button (Save / Search / Add / Login / …) and clicks
// it — while never triggering a destructive/secondary button (Delete / Cancel / Close).
// Textareas, selects, and rich editors (contenteditable) are ignored so Enter behaves
// normally there.

const POSITIVE = /(save|search|add|submit|send|login|sign|verify|confirm|next|continue|publish|update|حفظ|بحث|إضاف|أضف|إرسال|أرسل|دخول|تسجيل|تحقق|تأكيد|متابعة|التالي|اعتمد|نشر|إنشاء)/i;
const NEGATIVE = /(cancel|delete|remove|close|clear|back|reject|إلغاء|حذف|إزال|إغلاق|مسح|رجوع|رفض|السابق|تجاهل)/i;
const OK_TYPES = new Set(['text', 'search', 'tel', 'email', 'number', 'password', 'url', '']);

export function EnterToSubmit() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const el = e.target as HTMLElement | null;
      if (!el || el.tagName !== 'INPUT') return;
      const input = el as HTMLInputElement;
      if (!OK_TYPES.has((input.type || '').toLowerCase())) return;
      if (input.closest('form')) return; // native forms submit on Enter by themselves

      // Walk up to the nearest container that holds button(s) — the field's own group.
      let node: HTMLElement | null = input.parentElement;
      let buttons: HTMLButtonElement[] = [];
      for (let depth = 0; node && depth < 8; depth++) {
        const found = Array.from(node.querySelectorAll('button:not([disabled])')) as HTMLButtonElement[];
        if (found.length) {
          buttons = found;
          break;
        }
        node = node.parentElement;
      }
      if (!buttons.length) return;

      const label = (b: HTMLButtonElement) => `${b.innerText || ''} ${b.getAttribute('aria-label') || ''}`.toLowerCase();
      const safe = buttons.filter((b) => !NEGATIVE.test(label(b)));
      const primary = safe.find((b) => POSITIVE.test(label(b))) || (safe.length === 1 ? safe[0] : null);
      if (primary) {
        e.preventDefault();
        primary.click();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return null;
}
