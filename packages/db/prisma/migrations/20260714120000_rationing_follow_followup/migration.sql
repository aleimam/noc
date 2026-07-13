-- Follow-up workflow on WATCH follows: curated congratulations SMS + phone-contact (Done) tracking.
-- AlterTable
ALTER TABLE `RationingFollow`
  ADD COLUMN `congratsAt` DATETIME(3) NULL,
  ADD COLUMN `contactedAt` DATETIME(3) NULL,
  ADD COLUMN `contactedBy` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `RationingFollow_contactedAt_idx` ON `RationingFollow`(`contactedAt`);
