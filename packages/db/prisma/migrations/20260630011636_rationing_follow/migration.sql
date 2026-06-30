-- CreateTable
CREATE TABLE `RationingFollow` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kind` ENUM('FOUND', 'WATCH') NOT NULL,
    `applicantName` VARCHAR(191) NOT NULL,
    `nameNorm` VARCHAR(191) NOT NULL,
    `plotNo` VARCHAR(191) NULL,
    `blockNo` VARCHAR(191) NULL,
    `originalOwner` VARCHAR(191) NULL,
    `cityId` VARCHAR(191) NULL,
    `sheetId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `lastNotifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RationingFollow_nameNorm_idx`(`nameNorm`),
    INDEX `RationingFollow_userId_idx`(`userId`),
    INDEX `RationingFollow_status_kind_idx`(`status`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RationingFollow` ADD CONSTRAINT `RationingFollow_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RationingFollow` ADD CONSTRAINT `RationingFollow_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `RationingCity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RationingFollow` ADD CONSTRAINT `RationingFollow_sheetId_fkey` FOREIGN KEY (`sheetId`) REFERENCES `RationingSheet`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
