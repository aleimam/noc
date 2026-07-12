-- Editable per-map title + support for custom titled area photos (kind = 'custom:<cuid>').
-- Fixed maps use it to override the default heading; custom photos always carry a title.
ALTER TABLE `AreaMap` ADD COLUMN `title` VARCHAR(191) NULL;
