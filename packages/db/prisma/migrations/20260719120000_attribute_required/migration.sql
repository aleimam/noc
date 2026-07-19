-- Admin-configurable required/optional flag per listing attribute (detail). Publish-time
-- mandatory when true. Default false = optional, so no existing attribute changes behaviour.
-- Backfill: keep the city mandatory (matches the previous hard-coded REQUIRED_LISTING_ATTR_KEYS)
-- so current behaviour is preserved exactly; the admin sets everything else from the UI.
-- AlterTable
ALTER TABLE `Attribute`
  ADD COLUMN `required` BOOLEAN NOT NULL DEFAULT false;

-- Preserve today's only mandatory detail.
UPDATE `Attribute` SET `required` = true WHERE `key` = 'city';
