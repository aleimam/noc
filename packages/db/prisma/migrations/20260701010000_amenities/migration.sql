-- Public-realm amenities: admin taxonomy + per-neighborhood entries.
CREATE TABLE `AmenityType` (
    `id` VARCHAR(191) NOT NULL,
    `titleAr` VARCHAR(191) NOT NULL,
    `titleEn` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AmenityType_isActive_order_idx`(`isActive`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Amenity` (
    `id` VARCHAR(191) NOT NULL,
    `neighborhoodId` VARCHAR(191) NOT NULL,
    `typeId` VARCHAR(191) NOT NULL,
    `titleAr` VARCHAR(191) NOT NULL,
    `titleEn` VARCHAR(191) NULL,
    `detailsAr` TEXT NULL,
    `detailsEn` TEXT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Amenity_neighborhoodId_idx`(`neighborhoodId`),
    INDEX `Amenity_typeId_idx`(`typeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Amenity` ADD CONSTRAINT `Amenity_neighborhoodId_fkey` FOREIGN KEY (`neighborhoodId`) REFERENCES `Neighborhood`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Amenity` ADD CONSTRAINT `Amenity_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `AmenityType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
