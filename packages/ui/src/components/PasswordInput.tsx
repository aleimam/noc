'use client';

import { useState } from 'react';

/** Password box with a show/hide eye toggle — the house standard for EVERY password field
 *  (owner request 2026-07-19). The value stays dir="ltr" (passwords are Latin) with the eye on
 *  the physical right; `pe-12` keeps both the typed text and the (RTL-rendered) Arabic
 *  placeholder clear of the button. Pass your usual input classes via `className`. */
export function PasswordInput({
  value,
  onChange,
  className = '',
  placeholder,
  autoComplete,
  locale = 'ar',
}: {
  value: string;
  onChange: (v: string) => void;
  /** Classes applied to the <input> (your usual `inp` style). */
  className?: string;
  placeholder?: string;
  autoComplete?: string;
  locale?: 'ar' | 'en';
}) {
  const [show, setShow] = useState(false);
  const label = show
    ? locale === 'ar' ? 'إخفاء كلمة المرور' : 'Hide password'
    : locale === 'ar' ? 'إظهار كلمة المرور' : 'Show password';
  return (
    <span className="relative block">
      <input
        type={show ? 'text' : 'password'}
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`${className} pe-12`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={label}
        title={label}
        aria-pressed={show}
        className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-md text-xl leading-none hover:bg-graphite/10"
      >
        {show ? '🙈' : '👁'}
      </button>
    </span>
  );
}
