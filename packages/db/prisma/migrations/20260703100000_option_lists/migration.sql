-- Reusable, shared option lists for SELECT / MULTI_SELECT attributes.
CREATE TABLE `OptionList` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OptionListItem` (
  `id` VARCHAR(191) NOT NULL,
  `listId` VARCHAR(191) NOT NULL,
  `key` VARCHAR(191) NOT NULL,
  `labelAr` VARCHAR(191) NOT NULL,
  `labelEn` VARCHAR(191) NOT NULL,
  `order` INTEGER NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `OptionListItem_listId_key_key`(`listId`, `key`),
  INDEX `OptionListItem_listId_order_idx`(`listId`, `order`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Attribute` ADD COLUMN `optionListId` VARCHAR(191) NULL;
ALTER TABLE `ListingValue` ADD COLUMN `listItemId` VARCHAR(191) NULL;

-- Import each existing inline option set into a named list (named after the attribute).
INSERT INTO `OptionList` (`id`, `name`, `createdAt`, `updatedAt`)
SELECT CONCAT('ol_', a.`id`), a.`labelAr`, NOW(3), NOW(3)
FROM `Attribute` a
WHERE a.`type` IN ('SELECT','MULTI_SELECT')
  AND EXISTS (SELECT 1 FROM `AttributeOption` o WHERE o.`attributeId` = a.`id`);

INSERT INTO `OptionListItem` (`id`, `listId`, `key`, `labelAr`, `labelEn`, `order`, `isActive`)
SELECT CONCAT('oli_', o.`id`), CONCAT('ol_', o.`attributeId`), o.`key`, o.`labelAr`, o.`labelEn`, o.`order`, o.`isActive`
FROM `AttributeOption` o
JOIN `Attribute` a ON a.`id` = o.`attributeId`
WHERE a.`type` IN ('SELECT','MULTI_SELECT');

UPDATE `Attribute` a
SET a.`optionListId` = CONCAT('ol_', a.`id`)
WHERE a.`type` IN ('SELECT','MULTI_SELECT')
  AND EXISTS (SELECT 1 FROM `AttributeOption` o WHERE o.`attributeId` = a.`id`);

-- Re-point saved values to the imported list items (only where a matching item exists).
UPDATE `ListingValue` v
JOIN `OptionListItem` oli ON oli.`id` = CONCAT('oli_', v.`optionId`)
SET v.`listItemId` = oli.`id`
WHERE v.`optionId` IS NOT NULL;

CREATE INDEX `Attribute_optionListId_idx` ON `Attribute`(`optionListId`);
CREATE INDEX `ListingValue_attributeId_listItemId_idx` ON `ListingValue`(`attributeId`, `listItemId`);

ALTER TABLE `OptionListItem` ADD CONSTRAINT `OptionListItem_listId_fkey` FOREIGN KEY (`listId`) REFERENCES `OptionList`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Attribute` ADD CONSTRAINT `Attribute_optionListId_fkey` FOREIGN KEY (`optionListId`) REFERENCES `OptionList`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ListingValue` ADD CONSTRAINT `ListingValue_listItemId_fkey` FOREIGN KEY (`listItemId`) REFERENCES `OptionListItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
