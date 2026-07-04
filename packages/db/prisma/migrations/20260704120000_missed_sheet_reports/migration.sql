-- Visitor reports of rationing sheets missing from the digitized register.
CREATE TABLE `MissedSheetReport` (
  `id` VARCHAR(191) NOT NULL,
  `reporterName` VARCHAR(191) NOT NULL,
  `reporterPhone` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `fbDate` DATETIME(3) NULL,
  `cityId` VARCHAR(191) NULL,
  `originalOwner` VARCHAR(191) NULL,
  `blockNo` VARCHAR(191) NULL,
  `plotNo` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'NEW',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `MissedSheetReport_status_createdAt_idx`(`status`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MissedSheetReport` ADD CONSTRAINT `MissedSheetReport_cityId_fkey`
  FOREIGN KEY (`cityId`) REFERENCES `RationingCity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
