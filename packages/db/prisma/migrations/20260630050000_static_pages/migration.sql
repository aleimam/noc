-- Admin-managed static pages (per-brand, bilingual, rich HTML).
CREATE TABLE `Page` (
    `id` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `titleAr` VARCHAR(191) NOT NULL,
    `titleEn` VARCHAR(191) NULL,
    `bodyAr` TEXT NOT NULL,
    `bodyEn` TEXT NULL,
    `published` BOOLEAN NOT NULL DEFAULT false,
    `footerOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Page_brand_slug_key`(`brand`, `slug`),
    INDEX `Page_brand_published_footerOrder_idx`(`brand`, `published`, `footerOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
