-- GeoUpdate: title + notified marker for follower SMS blasts.
ALTER TABLE `GeoUpdate` ADD COLUMN `title` TEXT NULL;
ALTER TABLE `GeoUpdate` ADD COLUMN `notifiedAt` DATETIME(3) NULL;

-- Location / masterplan maps (clean original + per-brand stamped copies).
CREATE TABLE `AreaMap` (
    `id` VARCHAR(191) NOT NULL,
    `level` VARCHAR(191) NOT NULL,
    `areaId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `cleanPath` TEXT NOT NULL,
    `alswareyPath` TEXT NULL,
    `newobourPath` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AreaMap_level_areaId_kind_key`(`level`, `areaId`, `kind`),
    INDEX `AreaMap_level_areaId_idx`(`level`, `areaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Reciprocal adjacency (both directions stored).
CREATE TABLE `DistrictLink` (
    `id` VARCHAR(191) NOT NULL,
    `fromId` VARCHAR(191) NOT NULL,
    `toId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `DistrictLink_fromId_toId_key`(`fromId`, `toId`),
    INDEX `DistrictLink_fromId_idx`(`fromId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `NeighborhoodLink` (
    `id` VARCHAR(191) NOT NULL,
    `fromId` VARCHAR(191) NOT NULL,
    `toId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `NeighborhoodLink_fromId_toId_key`(`fromId`, `toId`),
    INDEX `NeighborhoodLink_fromId_idx`(`fromId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DistrictLink` ADD CONSTRAINT `DistrictLink_fromId_fkey` FOREIGN KEY (`fromId`) REFERENCES `District`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DistrictLink` ADD CONSTRAINT `DistrictLink_toId_fkey` FOREIGN KEY (`toId`) REFERENCES `District`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `NeighborhoodLink` ADD CONSTRAINT `NeighborhoodLink_fromId_fkey` FOREIGN KEY (`fromId`) REFERENCES `Neighborhood`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `NeighborhoodLink` ADD CONSTRAINT `NeighborhoodLink_toId_fkey` FOREIGN KEY (`toId`) REFERENCES `Neighborhood`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
