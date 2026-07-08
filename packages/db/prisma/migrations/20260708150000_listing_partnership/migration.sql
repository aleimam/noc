-- Plot consolidation & partnerships (تجميع الملاك والشراكات): listing opt-in fields.
-- NOTE: table names are PascalCase — the production MySQL is case-sensitive.
ALTER TABLE `Listing`
    ADD COLUMN `isPartnership` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `partnershipType` ENUM('CONSOLIDATION', 'JOINT_BUILD', 'SHARE_SALE') NULL,
    ADD COLUMN `partnershipNote` VARCHAR(191) NULL;

CREATE INDEX `Listing_isPartnership_status_idx` ON `Listing`(`isPartnership`, `status`);
