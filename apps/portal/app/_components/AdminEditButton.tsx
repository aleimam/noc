import { auth, hasPermission } from '@noc/auth';

/** Admin-only «✎ تعديل» pill shown on public pages (listing / geo) that deep-links to the
 *  matching backend edit page. Renders nothing for visitors and for staff lacking the section
 *  permission. Server component — the pages that use it are already dynamic, so this is free. */
export async function AdminEditButton({ href, section, action = 'UPDATE', label = 'تعديل (إدارة)' }: { href: string; section: string; action?: string; label?: string }) {
  const session = await auth();
  const u = session?.user;
  if (!u || u.type !== 'STAFF' || !hasPermission(u.perms ?? [], section, action)) return null;
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border-2 border-gold bg-navy px-4 py-1.5 text-sm font-bold text-gold shadow-sm hover:bg-navy/90"
    >
      ✎ {label}
    </a>
  );
}
