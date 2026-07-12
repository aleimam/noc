# SEO registration checklist (owner / operator runbook)

One-time registration of **both** sites with the search engines and directories.
Everything code-side is already live (SEO Phase 1): verification meta tags render from
admin Settings, `/sitemap.xml` + `/robots.txt` exist on both domains, and **IndexNow
instant indexing** pings Bing/Yandex automatically whenever a listing is approved, a news
item / custom page is first published, or a geo update is posted (key auto-generates on
first ping and is served at `/indexnow-key.txt` on both domains).

The two sites are registered **separately** — repeat each numbered section once for
`https://newobour.com` and once for `https://alsawarey.com` unless marked otherwise.

All verification tokens are pasted in ONE admin page:
**newobour.com/admin → الإعدادات (Settings) → التحليلات والتتبّع (Analytics & tracking)**.

---

## 1. Google Search Console (do FIRST — Bing imports from it)

Do this twice: once per domain.

1. Open https://search.google.com/search-console → sign in with the owner's Google account.
2. Click **Add property** → choose **URL prefix** (NOT Domain — we verify by meta tag, not DNS)
   → enter `https://newobour.com` (then later `https://alsawarey.com`) → **Continue**.
3. In the verification dialog pick **HTML tag**. Copy ONLY the long token inside
   `content="…"` — not the whole `<meta>` line.
4. In the admin: **Settings → التحليلات والتتبّع** → paste the token into
   **العبور الجديد — Google verification** (or **الصواري — Google verification** for
   alsawarey.com) → **حفظ (Save)**.
5. Back in Search Console click **Verify**. (If it fails, hard-refresh the site home page
   once and retry — the layout renders the tag immediately after save.)
6. Submit the sitemap: left menu **Sitemaps** → enter `sitemap.xml` → **Submit**.
   Status should turn to Success within a day.
7. Request indexing of the key pages by hand (much faster first crawl): top search bar
   (**URL inspection**) → paste each URL → **Request indexing**:
   - newobour.com: `/` , `/market` , `/explore` , `/rationing`
   - alsawarey.com: `/` , `/listings`

## 2. Bing Webmaster Tools (import — no separate verification needed)

1. Open https://www.bing.com/webmasters → **Sign in** (Microsoft account, or continue
   with the same Google account).
2. Choose **Import your sites from GSC** → authorize the Google account used in step 1 →
   select BOTH properties → **Import**. Verification, sitemaps and (eventually) traffic
   import automatically.
3. Only if Import is unavailable: **Add site manually** → pick **HTML Meta Tag** →
   copy the `msvalidate.01` token → paste into the admin field
   **تحقق Bing (msvalidate.01)** for that site → Save → **Verify**.
4. Note: Bing consumes our IndexNow pings automatically — no extra setup.

## 3. Yandex Webmaster (optional but free reach; also consumes IndexNow)

1. Open https://webmaster.yandex.com → sign in / create a Yandex account.
2. **Add site** → enter the domain → choose the **Meta tag** verification method.
3. Copy the token from `content="…"` → paste into the admin field **تحقق Yandex**
   for that site → Save → back in Yandex click **Check**.
4. **Indexing → Sitemap files** → add `https://<domain>/sitemap.xml`.

## 4. Google Analytics 4

1. Open https://analytics.google.com → **Admin** (gear) → **Create → Property**.
2. Name it after the site (e.g. `New Obour portal`), time zone **Egypt**, currency **EGP**.
3. **Data streams → Add stream → Web** → enter the domain → copy the
   **Measurement ID** (`G-XXXXXXXXXX`).
4. Paste it in the admin: **Settings → التحليلات والتتبّع → … GA4 Measurement ID** → Save.
   (The GA script loads only after the visitor accepts cookies — that's by design.)
5. Repeat for the second site (separate property, separate `G-…` ID).

## 5. Google Business Profile — الصواري only

Al Sawarey is a real commercial business; New Obour is a community portal (skip it).

1. Open https://business.google.com → **Manage now** → **Add your business**.
2. Name: **الصواري للاستثمار العقاري** (Al Sawarey Real-estate Investment).
3. Category: **Real Estate Agency** (وكالة عقارات).
4. Add the service area (New Obour City / العبور الجديدة, Qalyubia), phone number and
   website `https://alsawarey.com`.
5. Complete Google's verification (phone/SMS or video — whatever it offers).
6. Once live: add the logo (`Identity/1000X1000.png`), working hours, and a couple of
   land photos. Reviews here directly boost local search ranking.

## 6. Social pages + `sameAs`

1. Create (or claim) the Facebook page for each brand — Facebook is the dominant
   channel for this audience. Instagram optional; a YouTube channel helps for
   masterplan/walkthrough videos later.
2. Put the site link in each social profile, and post the site link occasionally —
   these are legitimate backlinks.
3. **Note:** SEO Phase 3 will add a `sameAs` admin setting so the social URLs feed the
   sites' Organization/RealEstateAgent structured data. Until then just keep a list of
   the final profile URLs — you'll paste them into the admin when the field ships.

## 7. Egyptian real-estate portals (backlinks + direct leads) — الصواري

Register a (free) agent/company account and cross-post a few flagship listings on:

1. **Aqarmap** — https://aqarmap.com.eg
2. **OLX Egypt (dubizzle)** — https://www.dubizzle.com.eg
3. **Property Finder Egypt** — https://www.propertyfinder.eg

In every profile and listing description include the site URL (`https://alsawarey.com`)
— the backlink matters as much as the listing itself. Keep prices/status in sync manually
(or let the posts expire; don't leave stale SOLD land up).

## 8. Skipped on purpose

- **Google Merchant Center** — unsuitable: it's for physical retail products with fixed
  prices/shipping; land listings don't qualify and the feed would be rejected. Real-estate
  reach comes from Search/Business Profile + the portals above instead.

---

### After this phase is done

- IndexNow (Bing/Yandex) pings are automatic — nothing to operate.
- GSC/Bing dashboards start filling with impressions in ~1–2 weeks; check
  **Search Console → Performance** monthly.
- Verification tokens live in the DB (Setting keys `gsc_*`, `bing_*`, `yandex_*`) and are
  covered by the nightly backups — a restore keeps all verifications intact.
