-- City-level geo updates (الدليل الجغرافي): GeoUpdate gains an optional cityId so admins
-- can post updates at the city level; they inherit down per the Setting `geo.inheritance`.
ALTER TABLE `GeoUpdate` ADD COLUMN `cityId` VARCHAR(191) NULL;
ALTER TABLE `GeoUpdate` ADD CONSTRAINT `GeoUpdate_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `City` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX `GeoUpdate_cityId_happenedAt_idx` ON `GeoUpdate` (`cityId`, `happenedAt`);
