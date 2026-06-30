-- Manual "featured" promotion flag for storefront listings.
ALTER TABLE `Listing` ADD COLUMN `featured` BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX `Listing_featured_idx` ON `Listing`(`featured`);
