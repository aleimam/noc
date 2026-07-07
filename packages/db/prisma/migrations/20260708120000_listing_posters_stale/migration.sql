-- Track whether a listing's generated images (poster / cards / advantages) are out of date
-- vs the listing's own data or its area advantages, so admins see a "regenerate" hint.
ALTER TABLE `Listing` ADD COLUMN `postersStale` BOOLEAN NOT NULL DEFAULT false;
