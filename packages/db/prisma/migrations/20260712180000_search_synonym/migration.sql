-- Search Intelligence S3: admin-managed synonym dictionary. One row = one equivalence group of
-- interchangeable terms; a search token matching any normalized term expands to match all of them.
CREATE TABLE `SearchSynonym` (
  `id` VARCHAR(191) NOT NULL,
  `site` VARCHAR(191) NULL,
  `surface` VARCHAR(191) NULL,
  `terms` TEXT NOT NULL,
  `normalized` TEXT NOT NULL,
  `note` VARCHAR(191) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `SearchSynonym_site_surface_idx` (`site`, `surface`),
  INDEX `SearchSynonym_isActive_idx` (`isActive`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
