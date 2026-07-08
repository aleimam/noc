-- Per-Type-option rendering marks for attribute groups on the generated images.
-- NOTE: table names are PascalCase — the production MySQL is case-sensitive.
CREATE TABLE `CategorySectionRender` (
    `id` VARCHAR(191) NOT NULL,
    `optionId` VARCHAR(191) NOT NULL,
    `sectionId` VARCHAR(191) NOT NULL,
    `makeCard` BOOLEAN NOT NULL DEFAULT true,
    `onPoster` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `CategorySectionRender_optionId_sectionId_key`(`optionId`, `sectionId`),
    INDEX `CategorySectionRender_sectionId_idx`(`sectionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CategorySectionRender` ADD CONSTRAINT `CategorySectionRender_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `ClassifierOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CategorySectionRender` ADD CONSTRAINT `CategorySectionRender_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `AttributeSection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
