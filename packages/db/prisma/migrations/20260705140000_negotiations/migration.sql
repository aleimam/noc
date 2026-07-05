-- Peer price negotiations on New Obour /market: a buyer opens a thread against a listing,
-- and buyer/seller exchange price offers (accept / reject / counter / withdraw).

-- CreateTable
CREATE TABLE `Negotiation` (
    `id` VARCHAR(191) NOT NULL,
    `listingId` VARCHAR(191) NOT NULL,
    `buyerId` VARCHAR(191) NOT NULL,
    `status` ENUM('OPEN', 'ACCEPTED', 'REJECTED', 'WITHDRAWN') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Negotiation_listingId_buyerId_key`(`listingId`, `buyerId`),
    INDEX `Negotiation_listingId_idx`(`listingId`),
    INDEX `Negotiation_buyerId_idx`(`buyerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NegotiationOffer` (
    `id` VARCHAR(191) NOT NULL,
    `negotiationId` VARCHAR(191) NOT NULL,
    `byRole` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `NegotiationOffer_negotiationId_idx`(`negotiationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Negotiation` ADD CONSTRAINT `Negotiation_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `Listing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Negotiation` ADD CONSTRAINT `Negotiation_buyerId_fkey` FOREIGN KEY (`buyerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `NegotiationOffer` ADD CONSTRAINT `NegotiationOffer_negotiationId_fkey` FOREIGN KEY (`negotiationId`) REFERENCES `Negotiation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
