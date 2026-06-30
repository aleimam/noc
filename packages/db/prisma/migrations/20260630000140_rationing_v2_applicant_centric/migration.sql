/*
  Warnings:

  - You are about to drop the column `company` on the `rationingsheet` table. All the data in the column will be lost.
  - You are about to drop the column `numberInSheet` on the `rationingsheet` table. All the data in the column will be lost.
  - You are about to drop the column `originalLocation` on the `rationingsheet` table. All the data in the column will be lost.
  - You are about to drop the column `originalMember` on the `rationingsheet` table. All the data in the column will be lost.
  - You are about to drop the column `originalPiece` on the `rationingsheet` table. All the data in the column will be lost.
  - You are about to drop the column `ownerName` on the `rationingsheet` table. All the data in the column will be lost.
  - You are about to drop the column `paymentDate` on the `rationingsheet` table. All the data in the column will be lost.
  - You are about to drop the column `sheetDate` on the `rationingsheet` table. All the data in the column will be lost.
  - You are about to drop the column `sheetNotes` on the `rationingsheet` table. All the data in the column will be lost.
  - Added the required column `applicantName` to the `RationingSheet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `blockNo` to the `RationingSheet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dedupeKey` to the `RationingSheet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `plotNo` to the `RationingSheet` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `RationingSheet_company_idx` ON `rationingsheet`;

-- DropIndex
DROP INDEX `RationingSheet_originalLocation_idx` ON `rationingsheet`;

-- DropIndex
DROP INDEX `RationingSheet_originalPiece_idx` ON `rationingsheet`;

-- DropIndex
DROP INDEX `RationingSheet_ownerName_idx` ON `rationingsheet`;

-- AlterTable
ALTER TABLE `rationingsheet` DROP COLUMN `company`,
    DROP COLUMN `numberInSheet`,
    DROP COLUMN `originalLocation`,
    DROP COLUMN `originalMember`,
    DROP COLUMN `originalPiece`,
    DROP COLUMN `ownerName`,
    DROP COLUMN `paymentDate`,
    DROP COLUMN `sheetDate`,
    DROP COLUMN `sheetNotes`,
    ADD COLUMN `applicantName` VARCHAR(191) NOT NULL,
    ADD COLUMN `applicantNo` INTEGER NULL,
    ADD COLUMN `attendanceDate` DATETIME(3) NULL,
    ADD COLUMN `attendanceDay` VARCHAR(191) NULL,
    ADD COLUMN `blockNo` VARCHAR(191) NOT NULL,
    ADD COLUMN `blockNorm` VARCHAR(191) NULL,
    ADD COLUMN `cityId` VARCHAR(191) NULL,
    ADD COLUMN `declarationDetails` TEXT NULL,
    ADD COLUMN `declarationRequired` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `dedupeKey` VARCHAR(191) NOT NULL,
    ADD COLUMN `listDate` DATETIME(3) NULL,
    ADD COLUMN `needsReview` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `originalOwner` VARCHAR(191) NULL,
    ADD COLUMN `ownerNorm` VARCHAR(191) NULL,
    ADD COLUMN `plotFullRef` VARCHAR(191) NULL,
    ADD COLUMN `plotNo` VARCHAR(191) NOT NULL,
    ADD COLUMN `plotNorm` VARCHAR(191) NULL,
    ADD COLUMN `remarks` TEXT NULL,
    ADD COLUMN `reviewedAt` DATETIME(3) NULL,
    ADD COLUMN `sourceFile` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `sheetimportbatch` ADD COLUMN `createdCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `duplicateCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `flaggedCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `updatedCount` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `sheetsearchlog` ADD COLUMN `field` VARCHAR(191) NOT NULL DEFAULT 'all',
    ADD COLUMN `usedSuggestion` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `RationingCity` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameEn` VARCHAR(191) NULL,
    `normalized` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RationingCity_name_key`(`name`),
    UNIQUE INDEX `RationingCity_normalized_key`(`normalized`),
    INDEX `RationingCity_isActive_order_idx`(`isActive`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RationingName` (
    `id` VARCHAR(191) NOT NULL,
    `sheetId` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `normalized` VARCHAR(191) NOT NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,

    INDEX `RationingName_normalized_idx`(`normalized`),
    INDEX `RationingName_sheetId_idx`(`sheetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `RationingSheet_plotNo_blockNo_idx` ON `RationingSheet`(`plotNo`, `blockNo`);

-- CreateIndex
CREATE INDEX `RationingSheet_dedupeKey_idx` ON `RationingSheet`(`dedupeKey`);

-- CreateIndex
CREATE INDEX `RationingSheet_ownerNorm_idx` ON `RationingSheet`(`ownerNorm`);

-- CreateIndex
CREATE INDEX `RationingSheet_plotNorm_idx` ON `RationingSheet`(`plotNorm`);

-- CreateIndex
CREATE INDEX `RationingSheet_blockNorm_idx` ON `RationingSheet`(`blockNorm`);

-- CreateIndex
CREATE INDEX `RationingSheet_cityId_idx` ON `RationingSheet`(`cityId`);

-- CreateIndex
CREATE INDEX `RationingSheet_needsReview_idx` ON `RationingSheet`(`needsReview`);

-- AddForeignKey
ALTER TABLE `RationingSheet` ADD CONSTRAINT `RationingSheet_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `RationingCity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RationingName` ADD CONSTRAINT `RationingName_sheetId_fkey` FOREIGN KEY (`sheetId`) REFERENCES `RationingSheet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
