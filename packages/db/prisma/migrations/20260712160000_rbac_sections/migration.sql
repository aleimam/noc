-- RBAC section restructure (2026-07). Splits the two god-sections into purpose-built keys
-- and merges the content trio. Zero-lockout: every role/user grant on an old section is
-- copied to the new section(s) BEFORE the old Permission rows are deleted.
--
--   marketplace → listings + catalog + owners + storefront
--   settings    → appearance, analytics   (settings keeps its own rows — system-only now)
--   news/guide/pages → content
--   deleted outright (never wired to real pages): homepage, media, districts, commissions, partners
--
-- Permission.id has no DB default (cuid comes from the Prisma client), so new rows get
-- readable literal ids: perm_<section>_<ACTION>. INSERT IGNORE relies on the
-- Permission_section_action_key unique index for idempotency.

-- 1) New Permission rows: 6 new sections × 5 actions ('owners' already exists since init).
INSERT IGNORE INTO `Permission` (`id`, `section`, `action`) VALUES
    ('perm_listings_VIEW',   'listings',   'VIEW'),
    ('perm_listings_CREATE', 'listings',   'CREATE'),
    ('perm_listings_UPDATE', 'listings',   'UPDATE'),
    ('perm_listings_DELETE', 'listings',   'DELETE'),
    ('perm_listings_MANAGE', 'listings',   'MANAGE'),
    ('perm_catalog_VIEW',    'catalog',    'VIEW'),
    ('perm_catalog_CREATE',  'catalog',    'CREATE'),
    ('perm_catalog_UPDATE',  'catalog',    'UPDATE'),
    ('perm_catalog_DELETE',  'catalog',    'DELETE'),
    ('perm_catalog_MANAGE',  'catalog',    'MANAGE'),
    ('perm_storefront_VIEW',   'storefront', 'VIEW'),
    ('perm_storefront_CREATE', 'storefront', 'CREATE'),
    ('perm_storefront_UPDATE', 'storefront', 'UPDATE'),
    ('perm_storefront_DELETE', 'storefront', 'DELETE'),
    ('perm_storefront_MANAGE', 'storefront', 'MANAGE'),
    ('perm_content_VIEW',    'content',    'VIEW'),
    ('perm_content_CREATE',  'content',    'CREATE'),
    ('perm_content_UPDATE',  'content',    'UPDATE'),
    ('perm_content_DELETE',  'content',    'DELETE'),
    ('perm_content_MANAGE',  'content',    'MANAGE'),
    ('perm_appearance_VIEW',   'appearance', 'VIEW'),
    ('perm_appearance_CREATE', 'appearance', 'CREATE'),
    ('perm_appearance_UPDATE', 'appearance', 'UPDATE'),
    ('perm_appearance_DELETE', 'appearance', 'DELETE'),
    ('perm_appearance_MANAGE', 'appearance', 'MANAGE'),
    ('perm_analytics_VIEW',   'analytics', 'VIEW'),
    ('perm_analytics_CREATE', 'analytics', 'CREATE'),
    ('perm_analytics_UPDATE', 'analytics', 'UPDATE'),
    ('perm_analytics_DELETE', 'analytics', 'DELETE'),
    ('perm_analytics_MANAGE', 'analytics', 'MANAGE');

-- 2) Copy grants: any role/user holding <old section, action X> also gets <new section, action X>.
--    INSERT IGNORE dedupes against the composite primary keys.

-- marketplace → listings, catalog, owners, storefront (roles)
INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT rp.`roleId`, np.`id`
FROM `RolePermission` rp
JOIN `Permission` op ON op.`id` = rp.`permissionId` AND op.`section` = 'marketplace'
JOIN `Permission` np ON np.`action` = op.`action` AND np.`section` IN ('listings', 'catalog', 'owners', 'storefront');

-- settings → appearance, analytics (roles; settings keeps its own rows)
INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT rp.`roleId`, np.`id`
FROM `RolePermission` rp
JOIN `Permission` op ON op.`id` = rp.`permissionId` AND op.`section` = 'settings'
JOIN `Permission` np ON np.`action` = op.`action` AND np.`section` IN ('appearance', 'analytics');

-- news/guide/pages → content (roles)
INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT rp.`roleId`, np.`id`
FROM `RolePermission` rp
JOIN `Permission` op ON op.`id` = rp.`permissionId` AND op.`section` IN ('news', 'guide', 'pages')
JOIN `Permission` np ON np.`action` = op.`action` AND np.`section` = 'content';

-- Same three copies for direct user grants (User.directPerms).
INSERT IGNORE INTO `UserPermission` (`userId`, `permissionId`)
SELECT up.`userId`, np.`id`
FROM `UserPermission` up
JOIN `Permission` op ON op.`id` = up.`permissionId` AND op.`section` = 'marketplace'
JOIN `Permission` np ON np.`action` = op.`action` AND np.`section` IN ('listings', 'catalog', 'owners', 'storefront');

INSERT IGNORE INTO `UserPermission` (`userId`, `permissionId`)
SELECT up.`userId`, np.`id`
FROM `UserPermission` up
JOIN `Permission` op ON op.`id` = up.`permissionId` AND op.`section` = 'settings'
JOIN `Permission` np ON np.`action` = op.`action` AND np.`section` IN ('appearance', 'analytics');

INSERT IGNORE INTO `UserPermission` (`userId`, `permissionId`)
SELECT up.`userId`, np.`id`
FROM `UserPermission` up
JOIN `Permission` op ON op.`id` = up.`permissionId` AND op.`section` IN ('news', 'guide', 'pages')
JOIN `Permission` np ON np.`action` = op.`action` AND np.`section` = 'content';

-- 3) Delete the retired sections: join rows first (explicit — independent of FK cascade), then the permissions.
DELETE rp FROM `RolePermission` rp
JOIN `Permission` p ON p.`id` = rp.`permissionId`
WHERE p.`section` IN ('homepage', 'media', 'districts', 'commissions', 'partners', 'marketplace', 'news', 'guide', 'pages');

DELETE up FROM `UserPermission` up
JOIN `Permission` p ON p.`id` = up.`permissionId`
WHERE p.`section` IN ('homepage', 'media', 'districts', 'commissions', 'partners', 'marketplace', 'news', 'guide', 'pages');

DELETE FROM `Permission`
WHERE `section` IN ('homepage', 'media', 'districts', 'commissions', 'partners', 'marketplace', 'news', 'guide', 'pages');
