-- "Sell your land" submissions from the alsawarey storefront.
CREATE TABLE `LandOffer` (
    `id` VARCHAR(191) NOT NULL,
    `mode` ENUM('SHEET', 'ALLOCATED') NOT NULL,
    `ownerName` VARCHAR(191) NOT NULL,
    `phone1` VARCHAR(191) NOT NULL,
    `phone2` VARCHAR(191) NULL,
    `area` DECIMAL(10, 2) NULL,
    `originalArea` DECIMAL(10, 2) NULL,
    `cityId` VARCHAR(191) NULL,
    `districtId` VARCHAR(191) NULL,
    `neighborhoodId` VARCHAR(191) NULL,
    `blockNo` VARCHAR(191) NULL,
    `plotNo` VARCHAR(191) NULL,
    `requiredPrice` DECIMAL(14, 2) NULL,
    `details` TEXT NULL,
    `status` ENUM('NEW', 'REVIEWING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'NEW',
    `note` TEXT NULL,
    `userId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LandOffer_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LandOffer` ADD CONSTRAINT `LandOffer_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `RationingCity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LandOffer` ADD CONSTRAINT `LandOffer_districtId_fkey` FOREIGN KEY (`districtId`) REFERENCES `District`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LandOffer` ADD CONSTRAINT `LandOffer_neighborhoodId_fkey` FOREIGN KEY (`neighborhoodId`) REFERENCES `Neighborhood`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LandOffer` ADD CONSTRAINT `LandOffer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
