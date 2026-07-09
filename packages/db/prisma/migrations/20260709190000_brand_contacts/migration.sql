-- Per-brand contacts (phone / whatsapp / email / website / address / social) that feed the
-- photo-stamp footer bar and can be reused elsewhere.
CREATE TABLE `BrandContact` (
  `id` VARCHAR(191) NOT NULL,
  `brand` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `value` VARCHAR(191) NOT NULL,
  `order` INT NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `BrandContact_brand_order_idx` (`brand`, `order`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
