-- Offerings + owner-code redesign. Additive & data-preserving.

-- 1) Classifier nesting (Type → Purpose → Status) + Al-Sawarey allow-list on Type/Purpose.
ALTER TABLE `ClassifierOption` ADD COLUMN `parentOptionId` VARCHAR(191) NULL;
ALTER TABLE `ClassifierOption` ADD COLUMN `allowedOnAlsawarey` BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX `ClassifierOption_parentOptionId_idx` ON `ClassifierOption`(`parentOptionId`);
ALTER TABLE `ClassifierOption` ADD CONSTRAINT `ClassifierOption_parentOptionId_fkey`
  FOREIGN KEY (`parentOptionId`) REFERENCES `ClassifierOption`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 2) Owner ad-number codes → child table (replaces the single Owner.ownerNo).
CREATE TABLE `OwnerCode` (
  `id` VARCHAR(191) NOT NULL,
  `ownerId` VARCHAR(191) NOT NULL,
  `code` INTEGER NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `OwnerCode_code_key`(`code`),
  INDEX `OwnerCode_ownerId_idx`(`ownerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `OwnerCode` ADD CONSTRAINT `OwnerCode_ownerId_fkey`
  FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate each existing single code into a code row, then drop the old column + index.
INSERT INTO `OwnerCode` (`id`, `ownerId`, `code`)
  SELECT UUID(), `id`, `ownerNo` FROM `Owner` WHERE `ownerNo` IS NOT NULL;
DROP INDEX `Owner_ownerNo_key` ON `Owner`;
ALTER TABLE `Owner` DROP COLUMN `ownerNo`;

-- 3) Rename OwnerType OWNER → PERSONAL (add value, migrate rows on both tables, finalize).
ALTER TABLE `Owner` MODIFY COLUMN `type` ENUM('OWNER','COMPANY','BROKER','US','PERSONAL') NOT NULL DEFAULT 'OWNER';
ALTER TABLE `Listing` MODIFY COLUMN `ownerType` ENUM('OWNER','COMPANY','BROKER','US','PERSONAL') NULL;
UPDATE `Owner` SET `type` = 'PERSONAL' WHERE `type` = 'OWNER';
UPDATE `Listing` SET `ownerType` = 'PERSONAL' WHERE `ownerType` = 'OWNER';
ALTER TABLE `Owner` MODIFY COLUMN `type` ENUM('PERSONAL','COMPANY','BROKER','US') NOT NULL DEFAULT 'PERSONAL';
ALTER TABLE `Listing` MODIFY COLUMN `ownerType` ENUM('PERSONAL','COMPANY','BROKER','US') NULL;
