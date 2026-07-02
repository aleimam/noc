-- Price-per unit and negotiable flag on listings.
ALTER TABLE `Listing`
  ADD COLUMN `priceUnit` ENUM('TOTAL','UNIT','SQM') NOT NULL DEFAULT 'TOTAL',
  ADD COLUMN `priceNegotiable` BOOLEAN NOT NULL DEFAULT false;
