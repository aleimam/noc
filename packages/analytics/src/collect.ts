import crypto from 'node:crypto';
import { prisma, Prisma } from '@noc/db';
import { parseUa } from './ua';
import { lookupGeo } from './geo';
import { classifySource } from './source';

export type CollectSite = 'newobour' | 'alsawarey';

export type CollectInput = {
  site: CollectSite;
  vid: string; // visitor anon id (first-party, client-generated)
  sid: string; // session id (client-generated)
  type: 'pageview' | 'pageleave' | 'event';
  pvId?: string; // client id for the page view (correlates leave → view)
  path?: string;
  title?: string;
  ref?: string; // external referrer only (client suppresses same-origin)
  utm?: { source?: string; medium?: string; campaign?: string };
  screen?: string;
  lang?: string;
  loadMs?: number;
  durationSec?: number;
  scrollPct?: number;
  eventType?: string;
  label?: string;
  value?: number;
  meta?: unknown;
};

const cap = (s: string | null | undefined, n: number): string | null => (s == null ? null : String(s).slice(0, n));
const clampInt = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === 'number' ? Math.round(v) : NaN;
  return Number.isNaN(n) ? null : Math.max(min, Math.min(max, n));
};

const IP_SALT = process.env.ANALYTICS_IP_SALT || process.env.AUTH_SECRET || 'noc-analytics-salt';
const hashIp = (ip: string | null): string | null => (ip ? crypto.createHash('sha256').update(`${IP_SALT}:${ip}`).digest('hex') : null);
const secsSince = (start: Date): number => Math.max(0, Math.round((Date.now() - start.getTime()) / 1000));

/** Ingest one beacon: upsert the visitor + session (enriching on first sight), then record
 *  the pageview / leave / event. Best-effort — never throws to the caller. */
export async function handleCollect(
  input: CollectInput,
  ctx: { ip: string | null; ua: string | null; userId?: string | null; site: CollectSite },
): Promise<void> {
  // The brand is decided by the ROUTE (each app process serves exactly one site), never by the
  // payload. `input.site` used to pick it, so a script could POST `site:'alsawarey'` to the
  // portal origin and pollute the other brand's sessions, rollups and conversion attribution
  // while every request still returned the expected 204.
  const site: CollectSite = ctx.site;
  const vid = cap(input.vid, 64);
  const sid = cap(input.sid, 64);
  if (!vid || !sid) return;
  const userId = cap(ctx.userId, 191); // linked when same-origin auth is present

  const visitor = await prisma.visitor.upsert({
    where: { site_anonId: { site, anonId: vid } },
    create: { site, anonId: vid, userId },
    update: { lastSeen: new Date(), ...(userId ? { userId } : {}) },
  });

  let session = await prisma.visitSession.findUnique({ where: { site_clientSid: { site, clientSid: sid } } });
  if (!session) {
    const ua = parseUa(ctx.ua);
    const geo = lookupGeo(ctx.ip);
    const { source } = classifySource(input.ref, input.utm);
    session = await prisma.visitSession.create({
      data: {
        site, clientSid: sid, visitorId: visitor.id, userId,
        entryPath: cap(input.path, 512), exitPath: cap(input.path, 512),
        referrer: cap(input.ref, 2000), source,
        utmSource: cap(input.utm?.source, 191), utmMedium: cap(input.utm?.medium, 191), utmCampaign: cap(input.utm?.campaign, 191),
        device: ua.device, os: ua.os, browser: ua.browser,
        screen: cap(input.screen, 32), language: cap(input.lang, 32),
        country: geo.country, region: geo.region, city: geo.city, ipHash: hashIp(ctx.ip),
      },
    });
    await prisma.visitor.update({
      where: { id: visitor.id },
      data: {
        sessionsCount: { increment: 1 },
        country: geo.country, region: geo.region, city: geo.city,
        device: ua.device, os: ua.os, browser: ua.browser,
      },
    });
  }

  if (input.type === 'pageview') {
    const pvId = cap(input.pvId, 191);
    const data = { sessionId: session.id, site, path: cap(input.path, 512) || '/', title: cap(input.title, 500), loadMs: clampInt(input.loadMs, 0, 600000) };
    if (pvId) await prisma.pageView.upsert({ where: { id: pvId }, create: { id: pvId, ...data }, update: {} });
    else await prisma.pageView.create({ data });
    const nextCount = session.pageviews + 1;
    await prisma.visitSession.update({
      where: { id: session.id },
      data: { pageviews: { increment: 1 }, lastEventAt: new Date(), exitPath: cap(input.path, 512), isBounce: nextCount <= 1, durationSec: secsSince(session.startedAt) },
    });
    await prisma.visitor.update({ where: { id: visitor.id }, data: { pageviews: { increment: 1 } } });
  } else if (input.type === 'pageleave' && input.pvId) {
    const pvId = cap(input.pvId, 191)!;
    // Scope the update to THIS session + site. Keyed on the client-supplied id alone, a caller
    // could replay any known page-view id and write fabricated duration/scroll onto another
    // visitor's row — per-page engagement is reported straight from these fields.
    await prisma.pageView
      .updateMany({
        where: { id: pvId, sessionId: session.id, site },
        data: { durationSec: clampInt(input.durationSec, 0, 86400), scrollPct: clampInt(input.scrollPct, 0, 100) },
      })
      .catch(() => {});
    await prisma.visitSession.update({ where: { id: session.id }, data: { lastEventAt: new Date(), durationSec: secsSince(session.startedAt) } }).catch(() => {});
  } else if (input.type === 'event' && input.eventType) {
    await prisma.analyticsEvent.create({
      data: {
        sessionId: session.id, site, type: cap(input.eventType, 64)!, path: cap(input.path, 512),
        label: cap(input.label, 500), value: typeof input.value === 'number' ? input.value : null,
        meta: input.meta && typeof input.meta === 'object' ? (input.meta as Prisma.InputJsonValue) : undefined,
      },
    });
    await prisma.visitSession.update({ where: { id: session.id }, data: { lastEventAt: new Date(), isBounce: false } }).catch(() => {});
  }
}
