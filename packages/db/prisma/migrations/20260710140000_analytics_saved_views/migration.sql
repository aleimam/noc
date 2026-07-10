-- Saved analytics-dashboard filter presets (staff-shared): a named (days, site) combination.

CREATE TABLE `AnalyticsSavedView` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `days` INT NOT NULL DEFAULT 30,
  `site` VARCHAR(191) NOT NULL DEFAULT 'all',
  `createdById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `AnalyticsSavedView_createdAt_idx` (`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
