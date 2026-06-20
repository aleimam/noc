-- AlterTable
ALTER TABLE `Listing` ADD COLUMN `neighborhoodId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `District` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `nameEn` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `District_key_key`(`key`),
    INDEX `District_isActive_order_idx`(`isActive`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Neighborhood` (
    `id` VARCHAR(191) NOT NULL,
    `districtId` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `nameEn` VARCHAR(191) NOT NULL,
    `hasBlocks` BOOLEAN NOT NULL DEFAULT false,
    `assortedAreas` BOOLEAN NOT NULL DEFAULT false,
    `areas` JSON NULL,
    `buildingTypes` JSON NULL,
    `mainRoads` JSON NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Neighborhood_districtId_order_idx`(`districtId`, `order`),
    INDEX `Neighborhood_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Block` (
    `id` VARCHAR(191) NOT NULL,
    `neighborhoodId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Block_neighborhoodId_order_idx`(`neighborhoodId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Land` (
    `id` VARCHAR(191) NOT NULL,
    `landType` ENUM('SHEETS', 'ALLOCATED') NOT NULL,
    `neighborhoodId` VARCHAR(191) NULL,
    `blockId` VARCHAR(191) NULL,
    `pieceNo` VARCHAR(191) NULL,
    `sheetLocation` VARCHAR(191) NULL,
    `area` DECIMAL(10, 2) NULL,
    `allocationDate` DATETIME(3) NULL,
    `utilitiesStatus` VARCHAR(191) NULL,
    `price` DECIMAL(14, 2) NULL,
    `ownerKind` ENUM('BROKER', 'OWNER', 'PERSONAL') NULL,
    `ownerId` VARCHAR(191) NULL,
    `details` TEXT NULL,
    `status` ENUM('DRAFT', 'REFINED', 'READY', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `createdById` VARCHAR(191) NULL,
    `listingId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Land_listingId_key`(`listingId`),
    INDEX `Land_status_idx`(`status`),
    INDEX `Land_neighborhoodId_idx`(`neighborhoodId`),
    INDEX `Land_blockId_idx`(`blockId`),
    INDEX `Land_landType_idx`(`landType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GeoUpdate` (
    `id` VARCHAR(191) NOT NULL,
    `districtId` VARCHAR(191) NULL,
    `neighborhoodId` VARCHAR(191) NULL,
    `blockId` VARCHAR(191) NULL,
    `landId` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `happenedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GeoUpdate_districtId_happenedAt_idx`(`districtId`, `happenedAt`),
    INDEX `GeoUpdate_neighborhoodId_happenedAt_idx`(`neighborhoodId`, `happenedAt`),
    INDEX `GeoUpdate_blockId_happenedAt_idx`(`blockId`, `happenedAt`),
    INDEX `GeoUpdate_landId_happenedAt_idx`(`landId`, `happenedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Advantage` (
    `id` VARCHAR(191) NOT NULL,
    `districtId` VARCHAR(191) NULL,
    `neighborhoodId` VARCHAR(191) NULL,
    `textAr` TEXT NOT NULL,
    `textEn` TEXT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Advantage_districtId_order_idx`(`districtId`, `order`),
    INDEX `Advantage_neighborhoodId_order_idx`(`neighborhoodId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LandFollow` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NOT NULL,
    `landId` VARCHAR(191) NULL,
    `blockId` VARCHAR(191) NULL,
    `neighborhoodId` VARCHAR(191) NULL,
    `districtId` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LandFollow_phone_idx`(`phone`),
    INDEX `LandFollow_userId_idx`(`userId`),
    INDEX `LandFollow_landId_idx`(`landId`),
    INDEX `LandFollow_neighborhoodId_idx`(`neighborhoodId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Listing_neighborhoodId_idx` ON `Listing`(`neighborhoodId`);

-- AddForeignKey
ALTER TABLE `Listing` ADD CONSTRAINT `Listing_neighborhoodId_fkey` FOREIGN KEY (`neighborhoodId`) REFERENCES `Neighborhood`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Neighborhood` ADD CONSTRAINT `Neighborhood_districtId_fkey` FOREIGN KEY (`districtId`) REFERENCES `District`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Block` ADD CONSTRAINT `Block_neighborhoodId_fkey` FOREIGN KEY (`neighborhoodId`) REFERENCES `Neighborhood`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Land` ADD CONSTRAINT `Land_neighborhoodId_fkey` FOREIGN KEY (`neighborhoodId`) REFERENCES `Neighborhood`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Land` ADD CONSTRAINT `Land_blockId_fkey` FOREIGN KEY (`blockId`) REFERENCES `Block`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Land` ADD CONSTRAINT `Land_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Land` ADD CONSTRAINT `Land_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Land` ADD CONSTRAINT `Land_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `Listing`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeoUpdate` ADD CONSTRAINT `GeoUpdate_districtId_fkey` FOREIGN KEY (`districtId`) REFERENCES `District`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeoUpdate` ADD CONSTRAINT `GeoUpdate_neighborhoodId_fkey` FOREIGN KEY (`neighborhoodId`) REFERENCES `Neighborhood`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeoUpdate` ADD CONSTRAINT `GeoUpdate_blockId_fkey` FOREIGN KEY (`blockId`) REFERENCES `Block`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeoUpdate` ADD CONSTRAINT `GeoUpdate_landId_fkey` FOREIGN KEY (`landId`) REFERENCES `Land`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeoUpdate` ADD CONSTRAINT `GeoUpdate_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Advantage` ADD CONSTRAINT `Advantage_districtId_fkey` FOREIGN KEY (`districtId`) REFERENCES `District`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Advantage` ADD CONSTRAINT `Advantage_neighborhoodId_fkey` FOREIGN KEY (`neighborhoodId`) REFERENCES `Neighborhood`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LandFollow` ADD CONSTRAINT `LandFollow_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LandFollow` ADD CONSTRAINT `LandFollow_landId_fkey` FOREIGN KEY (`landId`) REFERENCES `Land`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LandFollow` ADD CONSTRAINT `LandFollow_blockId_fkey` FOREIGN KEY (`blockId`) REFERENCES `Block`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LandFollow` ADD CONSTRAINT `LandFollow_neighborhoodId_fkey` FOREIGN KEY (`neighborhoodId`) REFERENCES `Neighborhood`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LandFollow` ADD CONSTRAINT `LandFollow_districtId_fkey` FOREIGN KEY (`districtId`) REFERENCES `District`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
