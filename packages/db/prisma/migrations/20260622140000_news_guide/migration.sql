-- CreateTable
CREATE TABLE `News` (
    `id` VARCHAR(191) NOT NULL,
    `titleAr` VARCHAR(191) NOT NULL,
    `titleEn` VARCHAR(191) NULL,
    `bodyAr` TEXT NOT NULL,
    `bodyEn` TEXT NULL,
    `category` ENUM('FACILITIES', 'ROADS', 'HANDOVERS', 'REGULATIONS', 'GENERAL') NOT NULL DEFAULT 'GENERAL',
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `publishedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `News_publishedAt_idx`(`publishedAt`),
    INDEX `News_category_publishedAt_idx`(`category`, `publishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuideEntry` (
    `id` VARCHAR(191) NOT NULL,
    `section` ENUM('LICENSING', 'HANDOVER', 'COMPANIES', 'COSTS') NOT NULL,
    `titleAr` VARCHAR(191) NOT NULL,
    `titleEn` VARCHAR(191) NULL,
    `bodyAr` TEXT NOT NULL,
    `bodyEn` TEXT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GuideEntry_section_order_idx`(`section`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
