-- Fixed "actual area" (م²) on every listing, independent of the pool area attributes.
ALTER TABLE `Listing` ADD COLUMN `area` DECIMAL(14, 2) NULL;
