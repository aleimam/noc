-- The search-intelligence dashboard filters by site + surface + time window together
-- (lib/searchAnalytics.ts scope()). The existing (site, createdAt) index only covers the
-- site-only view; add the three-column composite so the filtered view stays index-served as the
-- log grows. LandFollow.districtId / blockId were also flagged but already carry their FK indexes
-- (LandFollow_blockId_fkey / _districtId_fkey — MySQL auto-creates one per FK), so no index is
-- added for them; a second single-column index would be a pure duplicate.
CREATE INDEX `SearchLog_site_surface_createdAt_idx` ON `SearchLog`(`site`, `surface`, `createdAt`);
