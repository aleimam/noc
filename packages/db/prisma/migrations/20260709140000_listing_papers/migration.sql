-- Official papers on a listing (internal, admin-managed): whether we hold each document
-- and the date we obtained it. Photos are stored separately as Attachment rows
-- (ownerType='ListingPaper', stampCategory='allocation_letter'/'sale_mandate').
ALTER TABLE `Listing`
  ADD COLUMN `hasAllocationLetter` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `allocationLetterDate` VARCHAR(191) NULL,
  ADD COLUMN `hasSaleMandate` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `saleMandateDate` VARCHAR(191) NULL;
