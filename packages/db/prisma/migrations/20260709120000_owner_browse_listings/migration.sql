-- Partner-portal: per-partner flag for browsing (view-only) all published sell offers.
ALTER TABLE `Owner` ADD COLUMN `canBrowseListings` BOOLEAN NOT NULL DEFAULT true;
