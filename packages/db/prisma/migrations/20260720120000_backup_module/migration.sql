-- Off-site backup module: tiered, scheduled archives pushed to a remote SFTP target.
-- Portable spec: C:\Claude\YeldnIN\BACKUP.md. Additive only — the existing local
-- backup (ops/backup.sh, cron 02:30) and its alerts are untouched and keep running.

-- CreateTable
CREATE TABLE `BackupConfig` (
  `id`              VARCHAR(191) NOT NULL,
  `singleton`       VARCHAR(191) NOT NULL DEFAULT 'BACKUP',
  `enabled`         BOOLEAN      NOT NULL DEFAULT false,
  `protocol`        VARCHAR(191) NOT NULL DEFAULT 'SFTP',
  `host`            VARCHAR(191) NULL,
  `port`            INTEGER      NOT NULL DEFAULT 23,
  `username`        VARCHAR(191) NULL,
  `passwordEnc`     TEXT         NULL,
  `remotePath`      VARCHAR(191) NOT NULL DEFAULT '/home',
  `notifyOnFailure` BOOLEAN      NOT NULL DEFAULT true,
  `lastTestAt`      DATETIME(3)  NULL,
  `lastTestOk`      BOOLEAN      NULL,
  `lastTestMessage` TEXT         NULL,
  `lastRunAt`       DATETIME(3)  NULL,
  `updatedAt`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `BackupConfig_singleton_key`(`singleton`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BackupTier` (
  `id`         VARCHAR(191) NOT NULL,
  `key`        VARCHAR(191) NOT NULL,
  `label`      VARCHAR(191) NOT NULL DEFAULT '',
  `enabled`    BOOLEAN      NOT NULL DEFAULT true,
  `frequency`  VARCHAR(191) NOT NULL DEFAULT 'DAILY',
  `everyN`     INTEGER      NOT NULL DEFAULT 1,
  `hourUtc`    INTEGER      NOT NULL DEFAULT 2,
  `weekday`    INTEGER      NOT NULL DEFAULT 0,
  `dayOfMonth` INTEGER      NOT NULL DEFAULT 1,
  `contents`   VARCHAR(191) NOT NULL DEFAULT 'FULL',
  `remotePath` VARCHAR(191) NOT NULL DEFAULT '/home',
  `keepLast`   INTEGER      NOT NULL DEFAULT 7,
  `sortOrder`  INTEGER      NOT NULL DEFAULT 0,
  `lastRunAt`  DATETIME(3)  NULL,
  `updatedAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `BackupTier_key_key`(`key`),
  INDEX `BackupTier_sortOrder_idx`(`sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BackupRun` (
  `id`         VARCHAR(191) NOT NULL,
  `tierKey`    VARCHAR(191) NULL,
  `startedAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finishedAt` DATETIME(3)  NULL,
  `status`     VARCHAR(191) NOT NULL,
  `trigger`    VARCHAR(191) NOT NULL,
  `contents`   VARCHAR(191) NOT NULL DEFAULT '',
  `fileName`   VARCHAR(191) NULL,
  `sizeBytes`  BIGINT       NULL,
  `error`      TEXT         NULL,
  INDEX `BackupRun_startedAt_idx`(`startedAt`),
  INDEX `BackupRun_tierKey_startedAt_idx`(`tierKey`, `startedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed the single config row (disabled until the owner enters credentials).
INSERT INTO `BackupConfig` (`id`, `singleton`, `enabled`, `protocol`, `port`, `remotePath`, `updatedAt`)
VALUES ('bkcfg_singleton', 'BACKUP', false, 'SFTP', 23, '/home', CURRENT_TIMESTAMP(3));

-- Seed the four tiers. Each gets its OWN folder — sharing one would make each
-- tier's retention prune the other's archives (spec §2.2 rule 3).
-- MANUAL uses frequency 'OFF' so it is never *due*; only the button writes there,
-- which stops an ad-hoc backup from consuming a scheduled retention slot (§1).
INSERT INTO `BackupTier`
  (`id`, `key`, `label`, `enabled`, `frequency`, `everyN`, `hourUtc`, `weekday`, `dayOfMonth`, `contents`, `remotePath`, `keepLast`, `sortOrder`, `updatedAt`)
VALUES
  ('bktier_hourly', 'HOURLY', 'كل ساعة — قاعدة البيانات فقط', true, 'HOURLY', 1, 2, 0, 1, 'DB',   '/home/hourly', 12, 1, CURRENT_TIMESTAMP(3)),
  ('bktier_daily',  'DAILY',  'يومي — كامل',                      true, 'DAILY',  1, 2, 0, 1, 'FULL', '/home/daily',   7, 2, CURRENT_TIMESTAMP(3)),
  ('bktier_weekly', 'WEEKLY', 'أسبوعي — كامل',                    true, 'WEEKLY', 1, 2, 0, 1, 'FULL', '/home/weekly',  8, 3, CURRENT_TIMESTAMP(3)),
  ('bktier_manual', 'MANUAL', 'يدوي — عند الطلب',                 true, 'OFF',    1, 2, 0, 1, 'FULL', '/home/manual', 10, 4, CURRENT_TIMESTAMP(3));
