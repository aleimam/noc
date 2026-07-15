// Client-safe stamping types + constants (NO node:/sharp imports) so client components
// (the admin editor) can import the category lists without pulling sharp into the bundle.
// The server engine (stamp.ts) imports and re-exports everything here.

export type StampPosition = 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right';

export type StampConfig = {
  enabled: boolean; // category on/off (gated further by the global master switch)
  logoEnabled: boolean;
  logoPath: string | null; // optional override; else the category's brand logo
  position: StampPosition;
  opacity: number; // 0..1
  scale: number; // logo width as % of the photo width
  footerEnabled: boolean;
  footerLine1: string;
  footerLine2: string;
};

// Every photo-bearing module is a category; 'other' catches any uncategorized upload.
// Maps are stamped as two per-site copies: 'map' = Al Sawarey copy, 'map-newobour' = New Obour
// copy — each with its own logo + format so the two sites' map watermarks are independent.
export type StampCategory = 'listing' | 'map' | 'map-newobour' | 'amenity' | 'area-update' | 'rationing-scan' | 'other';
export const STAMP_CATEGORIES: StampCategory[] = ['listing', 'map', 'map-newobour', 'amenity', 'area-update', 'rationing-scan', 'other'];
// Baked into the file on upload / re-stamp (Attachment-based). 'map' uses AreaMap copies;
// 'rationing-scan' uses a live view overlay — both handled separately, not baked here.
export const BAKED_CATEGORIES: StampCategory[] = ['listing', 'amenity', 'area-update', 'other'];

// Optional per-listing-category overrides: keyed by the listing Type option id, each a full
// StampConfig that replaces the base 'listing' config for listings of that Type. Applied by
// re-stamping a listing's photos when it is saved (the Type isn't known at upload time).
export type StampSettings = {
  global: boolean;
  categories: Record<StampCategory, StampConfig>;
  listingTypeOverrides: Record<string, StampConfig>;
};

export const DEFAULT_CONFIG: StampConfig = {
  enabled: false,
  logoEnabled: false,
  logoPath: null,
  position: 'bottom-right',
  opacity: 0.55,
  scale: 18,
  footerEnabled: false,
  footerLine1: '',
  footerLine2: '',
};

export const DEFAULT_SETTINGS: StampSettings = {
  global: false,
  categories: Object.fromEntries(STAMP_CATEGORIES.map((c) => [c, { ...DEFAULT_CONFIG }])) as Record<StampCategory, StampConfig>,
  listingTypeOverrides: {},
};
