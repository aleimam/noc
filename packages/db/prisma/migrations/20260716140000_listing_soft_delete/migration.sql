-- Soft delete for listings: deletedAt marks the row as trashed (hidden from every surface
-- except the admin deleted-listings page); a daily cron purges rows older than 90 days.
-- AlterTable
ALTER TABLE `Listing`
  ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Listing_deletedAt_idx` ON `Listing`(`deletedAt`);
