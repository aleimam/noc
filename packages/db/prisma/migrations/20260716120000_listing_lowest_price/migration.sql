-- Internal "lowest / walk-away price" on listings — visible to admins & the listing owner
-- in the edit form only; NEVER rendered on any public listing page.
-- AlterTable
ALTER TABLE `Listing`
  ADD COLUMN `lowestPrice` DECIMAL(14, 2) NULL;
