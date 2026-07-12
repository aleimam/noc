-- Search Intelligence S3c: zero-result lead capture. When a market/storefront search returns
-- nothing, the visitor can leave a phone + note; staff work these leads from the search dashboard.
CREATE TABLE `SearchLead` (
  `id` VARCHAR(191) NOT NULL,
  `site` VARCHAR(191) NOT NULL,
  `surface` VARCHAR(191) NOT NULL,
  `query` TEXT NOT NULL,
  `normalized` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(32) NOT NULL,
  `name` VARCHAR(191) NULL,
  `note` TEXT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'NEW',
  `userId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `handledAt` DATETIME(3) NULL,

  PRIMARY KEY (`id`),
  INDEX `SearchLead_status_createdAt_idx` (`status`, `createdAt`),
  INDEX `SearchLead_site_createdAt_idx` (`site`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
