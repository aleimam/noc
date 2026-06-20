-- AlterTable
ALTER TABLE `Listing` ADD COLUMN `ownerId` VARCHAR(191) NULL,
    ADD COLUMN `ownerName` VARCHAR(191) NULL,
    ADD COLUMN `ownerType` ENUM('OWNER', 'COMPANY', 'BROKER', 'US') NULL,
    ADD COLUMN `showOnBrokerage` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `Owner` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('OWNER', 'COMPANY', 'BROKER', 'US') NOT NULL DEFAULT 'OWNER',
    `phone1` VARCHAR(191) NULL,
    `phone1Whatsapp` BOOLEAN NOT NULL DEFAULT false,
    `phone2` VARCHAR(191) NULL,
    `phone2Whatsapp` BOOLEAN NOT NULL DEFAULT false,
    `details` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Owner_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Listing_showOnBrokerage_status_idx` ON `Listing`(`showOnBrokerage`, `status`);

-- AddForeignKey
ALTER TABLE `Listing` ADD CONSTRAINT `Listing_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
