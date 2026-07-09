-- Pre-aggregated daily analytics rollups (one row per site/day). Written nightly by
-- ops/analytics-rollup.ts so long-term trends survive the raw-data retention prune.

CREATE TABLE `AnalyticsDaily` (
  `id` VARCHAR(191) NOT NULL,
  `site` VARCHAR(191) NOT NULL,
  `day` DATE NOT NULL,
  `visitors` INT NOT NULL DEFAULT 0,
  `newVisitors` INT NOT NULL DEFAULT 0,
  `sessions` INT NOT NULL DEFAULT 0,
  `pageviews` INT NOT NULL DEFAULT 0,
  `events` INT NOT NULL DEFAULT 0,
  `avgDuration` INT NOT NULL DEFAULT 0,
  `bounces` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `AnalyticsDaily_site_day_key` (`site`, `day`),
  INDEX `AnalyticsDaily_site_day_idx` (`site`, `day`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
