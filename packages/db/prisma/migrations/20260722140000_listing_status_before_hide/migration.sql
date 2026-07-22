-- Remember what a listing was before it was hidden, so un-hiding a SOLD listing restores SOLD
-- instead of silently reverting it to «متاح». `Listing.status` is a single column, so that
-- information had nowhere to live. Written when entering ARCHIVED, consumed + cleared on exit.
-- Nullable with no default: existing rows (prod currently has ZERO ARCHIVED listings) keep
-- today's behaviour — un-hide restores PUBLISHED.
ALTER TABLE `Listing` ADD COLUMN `statusBeforeHide` VARCHAR(191) NULL;
