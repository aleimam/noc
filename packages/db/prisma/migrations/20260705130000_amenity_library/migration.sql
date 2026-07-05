-- Amenities become a reusable GLOBAL library: built once, attached to many places
-- (neighborhood / district / listing) via AmenityPlacement. Category now comes from a
-- Shared Option List item. The old per-neighborhood Amenity + bespoke AmenityType are
-- dropped (both tables were emptied first, so no data is lost).

-- DropTable (Amenity references AmenityType via RESTRICT, so drop Amenity first)
DROP TABLE `Amenity`;
DROP TABLE `AmenityType`;

-- CreateTable
CREATE TABLE `Amenity` (
    `id` VARCHAR(191) NOT NULL,
    `categoryItemId` VARCHAR(191) NULL,
    `titleAr` VARCHAR(191) NOT NULL,
    `titleEn` VARCHAR(191) NULL,
    `detailsAr` TEXT NULL,
    `detailsEn` TEXT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Amenity_isActive_order_idx`(`isActive`, `order`),
    INDEX `Amenity_categoryItemId_idx`(`categoryItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AmenityPlacement` (
    `id` VARCHAR(191) NOT NULL,
    `amenityId` VARCHAR(191) NOT NULL,
    `neighborhoodId` VARCHAR(191) NULL,
    `districtId` VARCHAR(191) NULL,
    `listingId` VARCHAR(191) NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AmenityPlacement_amenityId_idx`(`amenityId`),
    INDEX `AmenityPlacement_neighborhoodId_idx`(`neighborhoodId`),
    INDEX `AmenityPlacement_districtId_idx`(`districtId`),
    INDEX `AmenityPlacement_listingId_idx`(`listingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Amenity` ADD CONSTRAINT `Amenity_categoryItemId_fkey` FOREIGN KEY (`categoryItemId`) REFERENCES `OptionListItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AmenityPlacement` ADD CONSTRAINT `AmenityPlacement_amenityId_fkey` FOREIGN KEY (`amenityId`) REFERENCES `Amenity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AmenityPlacement` ADD CONSTRAINT `AmenityPlacement_neighborhoodId_fkey` FOREIGN KEY (`neighborhoodId`) REFERENCES `Neighborhood`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AmenityPlacement` ADD CONSTRAINT `AmenityPlacement_districtId_fkey` FOREIGN KEY (`districtId`) REFERENCES `District`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AmenityPlacement` ADD CONSTRAINT `AmenityPlacement_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `Listing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
