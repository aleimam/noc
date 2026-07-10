-- Per-partner site access: which sites a partner may sign in to, and (restrict-to-site) where
-- their own listings appear. Both default on, so existing partners get access to both sites.

ALTER TABLE `Owner`
  ADD COLUMN `siteNewObour` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `siteAlsawary` BOOLEAN NOT NULL DEFAULT true;
