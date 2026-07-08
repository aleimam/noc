-- Card Title: staff-entered marketing headline shown on the generated listing cards.
-- NOTE: table names are PascalCase — the production MySQL is case-sensitive.
ALTER TABLE `Listing` ADD COLUMN `cardTitle` VARCHAR(191) NULL;
