-- Non-destructive stamping: keep a pure original + a stamp category per photo.
ALTER TABLE `Attachment` ADD COLUMN `originalPath` TEXT NULL;
ALTER TABLE `Attachment` ADD COLUMN `stampCategory` VARCHAR(191) NULL;

-- Existing files are all pure (stamping was dormant) → they ARE their own original.
UPDATE `Attachment` SET `originalPath` = `path` WHERE `originalPath` IS NULL;
