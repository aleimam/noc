import { auth, hasPermission } from '@noc/auth';

/** Admin-only «✎ تعديل» pill shown on public pages (listing / geo) that deep-links to the
 *  matching backend edit page. Renders nothing for visitors and for staff lacking the section
 *  permission. Server component — the pages that use it are already dynamic, so this is free. */
export async function AdminEditButton({ href, section, action = 'UPDATE', label = 'تعديل (إدارة)', compact = false }: { href: string; section: string; action?: string; label?: string; compact?: boolean }) {
  const session = await auth();
  const u = session?.user;
  if (!u || u.type !== 'STAFF' || !hasPermission(u.perms ?? [], section, action)) return null;
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-1 rounded-full border border-gold bg-navy font-bold text-gold shadow-sm hover:bg-navy/90 ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'gap-1.5 border-2 px-4 py-1.5 text-sm'
      }`}
    >
      ✎ {label}
    </a>
  );
}
