-- First-party web analytics: anonymous visitors, sessions, pageviews, events.

CREATE TABLE `Visitor` (
  `id` VARCHAR(191) NOT NULL,
  `anonId` VARCHAR(191) NOT NULL,
  `site` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `firstSeen` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastSeen` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `sessionsCount` INT NOT NULL DEFAULT 0,
  `pageviews` INT NOT NULL DEFAULT 0,
  `country` VARCHAR(191) NULL,
  `region` VARCHAR(191) NULL,
  `city` VARCHAR(191) NULL,
  `device` VARCHAR(191) NULL,
  `os` VARCHAR(191) NULL,
  `browser` VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Visitor_site_anonId_key` (`site`, `anonId`),
  INDEX `Visitor_site_lastSeen_idx` (`site`, `lastSeen`),
  INDEX `Visitor_userId_idx` (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VisitSession` (
  `id` VARCHAR(191) NOT NULL,
  `clientSid` VARCHAR(191) NOT NULL,
  `visitorId` VARCHAR(191) NOT NULL,
  `site` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastEventAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `durationSec` INT NOT NULL DEFAULT 0,
  `pageviews` INT NOT NULL DEFAULT 0,
  `isBounce` BOOLEAN NOT NULL DEFAULT true,
  `entryPath` VARCHAR(512) NULL,
  `exitPath` VARCHAR(512) NULL,
  `referrer` TEXT NULL,
  `source` VARCHAR(191) NULL,
  `utmSource` VARCHAR(191) NULL,
  `utmMedium` VARCHAR(191) NULL,
  `utmCampaign` VARCHAR(191) NULL,
  `device` VARCHAR(191) NULL,
  `os` VARCHAR(191) NULL,
  `browser` VARCHAR(191) NULL,
  `screen` VARCHAR(191) NULL,
  `language` VARCHAR(191) NULL,
  `country` VARCHAR(191) NULL,
  `region` VARCHAR(191) NULL,
  `city` VARCHAR(191) NULL,
  `ipHash` VARCHAR(64) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `VisitSession_site_clientSid_key` (`site`, `clientSid`),
  INDEX `VisitSession_site_startedAt_idx` (`site`, `startedAt`),
  INDEX `VisitSession_visitorId_idx` (`visitorId`),
  INDEX `VisitSession_userId_idx` (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PageView` (
  `id` VARCHAR(191) NOT NULL,
  `sessionId` VARCHAR(191) NOT NULL,
  `site` VARCHAR(191) NOT NULL,
  `path` VARCHAR(512) NOT NULL,
  `title` TEXT NULL,
  `ts` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `durationSec` INT NULL,
  `scrollPct` INT NULL,
  `loadMs` INT NULL,
  PRIMARY KEY (`id`),
  INDEX `PageView_site_ts_idx` (`site`, `ts`),
  INDEX `PageView_sessionId_idx` (`sessionId`),
  INDEX `PageView_path_idx` (`path`(180))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AnalyticsEvent` (
  `id` VARCHAR(191) NOT NULL,
  `sessionId` VARCHAR(191) NOT NULL,
  `site` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `path` VARCHAR(512) NULL,
  `label` TEXT NULL,
  `value` DOUBLE NULL,
  `meta` JSON NULL,
  `ts` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `AnalyticsEvent_site_type_ts_idx` (`site`, `type`, `ts`),
  INDEX `AnalyticsEvent_sessionId_idx` (`sessionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `VisitSession` ADD CONSTRAINT `VisitSession_visitorId_fkey` FOREIGN KEY (`visitorId`) REFERENCES `Visitor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PageView` ADD CONSTRAINT `PageView_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `VisitSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AnalyticsEvent` ADD CONSTRAINT `AnalyticsEvent_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `VisitSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
