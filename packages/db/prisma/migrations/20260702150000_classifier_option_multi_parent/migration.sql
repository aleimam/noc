-- Many-to-many nesting for classifier options (a sub-option can have several parents).
CREATE TABLE `ClassifierOptionParent` (
  `id` VARCHAR(191) NOT NULL,
  `childId` VARCHAR(191) NOT NULL,
  `parentId` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ClassifierOptionParent_childId_parentId_key`(`childId`, `parentId`),
  INDEX `ClassifierOptionParent_parentId_idx`(`parentId`),
  INDEX `ClassifierOptionParent_childId_idx`(`childId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ClassifierOptionParent`
  ADD CONSTRAINT `ClassifierOptionParent_childId_fkey` FOREIGN KEY (`childId`) REFERENCES `ClassifierOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ClassifierOptionParent_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `ClassifierOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing single-parent links into the join table.
INSERT INTO `ClassifierOptionParent` (`id`, `childId`, `parentId`)
SELECT CONCAT('cop_', `id`), `id`, `parentOptionId`
FROM `ClassifierOption`
WHERE `parentOptionId` IS NOT NULL;
