-- Expand the value-type list for listing details, and add per-type config JSON.
ALTER TABLE `Attribute`
  MODIFY `type` ENUM(
    'TEXT','TEXTAREA','NUMBER','BOOLEAN','SELECT','MULTI_SELECT','DATE','PHOTOS','DOCUMENTS',
    'URL','PHONE','DATE_FULL','MONEY','MONEY_THOUSANDS','AREA_ORIGINAL','AREA_ALLOCATED','YESNO'
  ) NOT NULL;

ALTER TABLE `Attribute` ADD COLUMN `config` JSON NULL;
