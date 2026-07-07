-- City level for the geo hierarchy (City → District → Neighborhood). Districts and area
-- advantages gain an optional city link; AreaMap gains editable annotation shapes + the
-- source masterplan a location map was drawn on (so location maps stay re-editable).

-- CreateTable
CREATE TABLE `City` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `nameEn` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `City_key_key`(`key`),
    INDEX `City_isActive_order_idx`(`isActive`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable: District → City
ALTER TABLE `District` ADD COLUMN `cityId` VARCHAR(191) NULL;
CREATE INDEX `District_cityId_idx` ON `District`(`cityId`);
ALTER TABLE `District` ADD CONSTRAINT `District_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `City`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Advantage → City
ALTER TABLE `Advantage` ADD COLUMN `cityId` VARCHAR(191) NULL;
CREATE INDEX `Advantage_cityId_order_idx` ON `Advantage`(`cityId`, `order`);
ALTER TABLE `Advantage` ADD CONSTRAINT `Advantage_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `City`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: AreaMap editable annotation + source masterplan
ALTER TABLE `AreaMap` ADD COLUMN `annotation` JSON NULL,
    ADD COLUMN `sourcePath` TEXT NULL;

-- Seed the default city (مدينة العبور الجديدة) and link every existing district to it.
INSERT INTO `City` (`id`, `key`, `nameAr`, `nameEn`, `order`, `isActive`, `createdAt`, `updatedAt`)
VALUES ('city_new_obour', 'new-obour', 'مدينة العبور الجديدة', 'New Obour City', 0, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
UPDATE `District` SET `cityId` = 'city_new_obour' WHERE `cityId` IS NULL;
