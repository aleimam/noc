-- CreateTable
CREATE TABLE `RationingSheet` (
    `id` VARCHAR(191) NOT NULL,
    `numberInSheet` VARCHAR(191) NULL,
    `ownerName` VARCHAR(191) NOT NULL,
    `sheetNotes` TEXT NULL,
    `sheetDate` DATETIME(3) NULL,
    `paymentDate` DATETIME(3) NULL,
    `company` VARCHAR(191) NULL,
    `originalPiece` VARCHAR(191) NULL,
    `originalLocation` VARCHAR(191) NULL,
    `originalMember` VARCHAR(191) NULL,
    `batchId` VARCHAR(191) NULL,
    `uploadedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RationingSheet_ownerName_idx`(`ownerName`),
    INDEX `RationingSheet_originalPiece_idx`(`originalPiece`),
    INDEX `RationingSheet_originalLocation_idx`(`originalLocation`),
    INDEX `RationingSheet_company_idx`(`company`),
    INDEX `RationingSheet_batchId_idx`(`batchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SheetImportBatch` (
    `id` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `rowCount` INTEGER NOT NULL DEFAULT 0,
    `note` VARCHAR(191) NULL,
    `uploadedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SheetImportBatch_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InquiryRequest` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('FOUND_FOLLOW', 'NOT_FOUND_WATCH') NOT NULL,
    `status` ENUM('OPEN', 'MATCHED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `ownerName` VARCHAR(191) NOT NULL,
    `company` VARCHAR(191) NULL,
    `originalPiece` VARCHAR(191) NULL,
    `originalLocation` VARCHAR(191) NULL,
    `originalMember` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `userId` VARCHAR(191) NULL,
    `matchedSheetId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InquiryRequest_status_kind_idx`(`status`, `kind`),
    INDEX `InquiryRequest_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SheetSearchLog` (
    `id` VARCHAR(191) NOT NULL,
    `query` VARCHAR(191) NOT NULL,
    `resultsCount` INTEGER NOT NULL DEFAULT 0,
    `matched` BOOLEAN NOT NULL DEFAULT false,
    `userId` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SheetSearchLog_createdAt_idx`(`createdAt`),
    INDEX `SheetSearchLog_matched_idx`(`matched`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RationingSheet` ADD CONSTRAINT `RationingSheet_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `SheetImportBatch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RationingSheet` ADD CONSTRAINT `RationingSheet_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SheetImportBatch` ADD CONSTRAINT `SheetImportBatch_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InquiryRequest` ADD CONSTRAINT `InquiryRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InquiryRequest` ADD CONSTRAINT `InquiryRequest_matchedSheetId_fkey` FOREIGN KEY (`matchedSheetId`) REFERENCES `RationingSheet`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SheetSearchLog` ADD CONSTRAINT `SheetSearchLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
