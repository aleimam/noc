-- Building-conditions ("اشتراطات البناء") reference pages + listing attach.
CREATE TABLE `BuildingCondition` (
  `id` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `unitLabelAr` VARCHAR(191) NOT NULL,
  `unitLabelEn` VARCHAR(191) NOT NULL,
  `titleAr` VARCHAR(191) NOT NULL,
  `titleEn` VARCHAR(191) NOT NULL,
  `bodyAr` TEXT NOT NULL,
  `bodyEn` TEXT NOT NULL,
  `images` JSON NULL,
  `order` INTEGER NOT NULL DEFAULT 0,
  `published` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `BuildingCondition_slug_key`(`slug`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ListingBuildingCondition` (
  `id` VARCHAR(191) NOT NULL,
  `listingId` VARCHAR(191) NOT NULL,
  `conditionId` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ListingBuildingCondition_listingId_conditionId_key`(`listingId`, `conditionId`),
  INDEX `ListingBuildingCondition_conditionId_idx`(`conditionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ListingBuildingCondition`
  ADD CONSTRAINT `ListingBuildingCondition_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `Listing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ListingBuildingCondition_conditionId_fkey` FOREIGN KEY (`conditionId`) REFERENCES `BuildingCondition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
