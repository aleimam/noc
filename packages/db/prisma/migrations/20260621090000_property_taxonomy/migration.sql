-- AlterTable: extend the AttrType enum with DATE / PHOTOS / DOCUMENTS
ALTER TABLE `Attribute` MODIFY `type` ENUM('TEXT', 'TEXTAREA', 'NUMBER', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'DATE', 'PHOTOS', 'DOCUMENTS') NOT NULL;

-- AlterTable: per-property attachment link (null = main listing gallery)
ALTER TABLE `Attachment` ADD COLUMN `attributeId` VARCHAR(191) NULL;

-- AlterTable: a PropertyType now belongs to a PropertyGroup
ALTER TABLE `PropertyType` ADD COLUMN `groupId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `PropertyCategory` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `nameEn` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PropertyCategory_key_key`(`key`),
    INDEX `PropertyCategory_isActive_order_idx`(`isActive`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PropertyGroup` (
    `id` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `nameEn` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PropertyGroup_categoryId_order_idx`(`categoryId`, `order`),
    UNIQUE INDEX `PropertyGroup_categoryId_key_key`(`categoryId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `PropertyType_groupId_order_idx` ON `PropertyType`(`groupId`, `order`);

-- AddForeignKey
ALTER TABLE `PropertyGroup` ADD CONSTRAINT `PropertyGroup_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `PropertyCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PropertyType` ADD CONSTRAINT `PropertyType_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `PropertyGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
