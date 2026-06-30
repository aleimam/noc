-- Owner allocated number (2-digit code for ad numbers) + Listing public ad reference.
ALTER TABLE `Owner` ADD COLUMN `ownerNo` INTEGER NULL;
ALTER TABLE `Listing` ADD COLUMN `adNumber` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Owner_ownerNo_key` ON `Owner`(`ownerNo`);
CREATE UNIQUE INDEX `Listing_adNumber_key` ON `Listing`(`adNumber`);
