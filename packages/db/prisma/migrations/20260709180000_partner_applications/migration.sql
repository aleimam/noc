-- Public "become a partner" applications, reviewed by staff.
CREATE TABLE `PartnerApplication` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `businessName` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NULL,
  `businessType` VARCHAR(191) NULL,
  `areas` VARCHAR(191) NULL,
  `message` TEXT NULL,
  `status` ENUM('PENDING', 'REVIEWING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `reviewNote` TEXT NULL,
  `reviewedById` VARCHAR(191) NULL,
  `reviewedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `PartnerApplication_status_createdAt_idx` (`status`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
