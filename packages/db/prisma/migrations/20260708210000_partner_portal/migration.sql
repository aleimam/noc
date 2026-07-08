-- Partner portal foundations: partner login link on User, per-owner category grants,
-- and public view counters for partner analytics.
-- NOTE: table names are PascalCase — the production MySQL is case-sensitive.

ALTER TABLE `User`
    ADD COLUMN `username` VARCHAR(191) NULL,
    ADD COLUMN `ownerId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `User_username_key` ON `User`(`username`);
CREATE UNIQUE INDEX `User_ownerId_key` ON `User`(`ownerId`);
ALTER TABLE `User` ADD CONSTRAINT `User_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `OwnerAllowedCategory` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `optionId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `OwnerAllowedCategory_ownerId_optionId_key`(`ownerId`, `optionId`),
    INDEX `OwnerAllowedCategory_optionId_idx`(`optionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OwnerAllowedCategory` ADD CONSTRAINT `OwnerAllowedCategory_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `OwnerAllowedCategory` ADD CONSTRAINT `OwnerAllowedCategory_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `ClassifierOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Listing` ADD COLUMN `views` INTEGER NOT NULL DEFAULT 0;

CREATE TABLE `ListingViewDay` (
    `id` VARCHAR(191) NOT NULL,
    `listingId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `ListingViewDay_listingId_date_key`(`listingId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ListingViewDay` ADD CONSTRAINT `ListingViewDay_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `Listing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
