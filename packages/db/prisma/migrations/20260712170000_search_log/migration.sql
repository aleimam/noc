-- Search Intelligence: one row per public search (market/storefront/rationing).
CREATE TABLE `SearchLog` (
  `id` VARCHAR(191) NOT NULL,
  `site` VARCHAR(191) NOT NULL,
  `surface` VARCHAR(191) NOT NULL,
  `sessionId` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NULL,
  `query` TEXT NOT NULL,
  `normalized` VARCHAR(191) NOT NULL,
  `resultsCount` INTEGER NOT NULL DEFAULT 0,
  `zeroResult` BOOLEAN NOT NULL DEFAULT false,
  `usedFastSearch` BOOLEAN NOT NULL DEFAULT false,
  `selectedListingId` VARCHAR(191) NULL,
  `converted` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `SearchLog_site_createdAt_idx` (`site`, `createdAt`),
  INDEX `SearchLog_normalized_idx` (`normalized`),
  INDEX `SearchLog_zeroResult_createdAt_idx` (`zeroResult`, `createdAt`),
  INDEX `SearchLog_selectedListingId_idx` (`selectedListingId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
