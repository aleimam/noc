-- Customer self-managed lands (account "my lands" with get-updates / for-sale toggles).
CREATE TABLE `UserLand` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NULL,
  `districtId` VARCHAR(191) NULL,
  `neighborhoodId` VARCHAR(191) NULL,
  `blockNo` VARCHAR(191) NULL,
  `plotNo` VARCHAR(191) NULL,
  `area` DECIMAL(10, 2) NULL,
  `notes` TEXT NULL,
  `getUpdates` BOOLEAN NOT NULL DEFAULT false,
  `forSale` BOOLEAN NOT NULL DEFAULT false,
  `landFollowId` VARCHAR(191) NULL,
  `landOfferId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `UserLand_userId_idx`(`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `UserLand` ADD CONSTRAINT `UserLand_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
