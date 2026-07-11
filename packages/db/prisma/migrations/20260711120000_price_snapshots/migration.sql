-- Monthly per-district price snapshots for the /price-index trend.
-- History accumulates from deploy day; it cannot be backfilled.
CREATE TABLE `PriceSnapshot` (
  `id` VARCHAR(191) NOT NULL,
  `districtId` VARCHAR(191) NOT NULL,
  `month` VARCHAR(191) NOT NULL,
  `avgPerM` INTEGER NOT NULL,
  `listingCount` INTEGER NOT NULL,
  `volume` DECIMAL(18, 2) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `PriceSnapshot_districtId_month_key` (`districtId`, `month`),
  INDEX `PriceSnapshot_month_idx` (`month`),
  CONSTRAINT `PriceSnapshot_districtId_fkey` FOREIGN KEY (`districtId`) REFERENCES `District` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
