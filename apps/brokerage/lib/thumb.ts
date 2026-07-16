/** Rewrite an /uploads/... image path to its on-demand thumbnail URL (see app/thumb route).
 *  Non-upload paths (brand assets, external) pass through untouched. */
export function thumbUrl(p: string, w: 320 | 480 | 640 | 960 = 480): string {
  if (!p.startsWith('/uploads/')) return p;
  return `/thumb/w${w}${p.slice('/uploads'.length)}`;
}
