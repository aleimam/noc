-- DropForeignKey
ALTER TABLE `PropertyType` DROP FOREIGN KEY `PropertyType_groupId_fkey`;
ALTER TABLE `PropertyGroup` DROP FOREIGN KEY `PropertyGroup_categoryId_fkey`;
ALTER TABLE `Listing` DROP FOREIGN KEY `Listing_propertyTypeId_fkey`;

-- DropTable (the short-lived Category/Group layer, superseded by classifiers)
DROP TABLE `PropertyGroup`;
DROP TABLE `PropertyCategory`;

-- AlterTable: PropertyType loses its group link (now a dormant legacy table)
DROP INDEX `PropertyType_groupId_order_idx` ON `PropertyType`;
ALTER TABLE `PropertyType` DROP COLUMN `groupId`;

-- AlterTable: Listing — propertyTypeId becomes optional + three classifier links
ALTER TABLE `Listing` MODIFY `propertyTypeId` VARCHAR(191) NULL;
ALTER TABLE `Listing`
  ADD COLUMN `typeOptionId` VARCHAR(191) NULL,
  ADD COLUMN `purposeOptionId` VARCHAR(191) NULL,
  ADD COLUMN `conditionOptionId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Classifier` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `nameEn` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Classifier_key_key`(`key`),
    INDEX `Classifier_order_idx`(`order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClassifierOption` (
    `id` VARCHAR(191) NOT NULL,
    `classifierId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `nameEn` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ClassifierOption_classifierId_order_idx`(`classifierId`, `order`),
    UNIQUE INDEX `ClassifierOption_classifierId_key_key`(`classifierId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttributeClassifier` (
    `id` VARCHAR(191) NOT NULL,
    `attributeId` VARCHAR(191) NOT NULL,
    `optionId` VARCHAR(191) NOT NULL,

    INDEX `AttributeClassifier_optionId_idx`(`optionId`),
    UNIQUE INDEX `AttributeClassifier_attributeId_optionId_key`(`attributeId`, `optionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Listing_typeOptionId_idx` ON `Listing`(`typeOptionId`);
CREATE INDEX `Listing_purposeOptionId_idx` ON `Listing`(`purposeOptionId`);
CREATE INDEX `Listing_conditionOptionId_idx` ON `Listing`(`conditionOptionId`);

-- AddForeignKey
ALTER TABLE `ClassifierOption` ADD CONSTRAINT `ClassifierOption_classifierId_fkey` FOREIGN KEY (`classifierId`) REFERENCES `Classifier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AttributeClassifier` ADD CONSTRAINT `AttributeClassifier_attributeId_fkey` FOREIGN KEY (`attributeId`) REFERENCES `Attribute`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AttributeClassifier` ADD CONSTRAINT `AttributeClassifier_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `ClassifierOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Listing` ADD CONSTRAINT `Listing_propertyTypeId_fkey` FOREIGN KEY (`propertyTypeId`) REFERENCES `PropertyType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Listing` ADD CONSTRAINT `Listing_typeOptionId_fkey` FOREIGN KEY (`typeOptionId`) REFERENCES `ClassifierOption`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Listing` ADD CONSTRAINT `Listing_purposeOptionId_fkey` FOREIGN KEY (`purposeOptionId`) REFERENCES `ClassifierOption`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Listing` ADD CONSTRAINT `Listing_conditionOptionId_fkey` FOREIGN KEY (`conditionOptionId`) REFERENCES `ClassifierOption`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
