-- Staff-confirmed "not a duplicate" marker for a dedupeKey group (reversible).
CREATE TABLE `DedupeReview` (
  `id` VARCHAR(191) NOT NULL,
  `dedupeKey` VARCHAR(191) NOT NULL,
  `reviewedById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DedupeReview_dedupeKey_key`(`dedupeKey`),
  INDEX `DedupeReview_createdAt_idx`(`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
