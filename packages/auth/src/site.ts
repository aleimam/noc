/** The single brand/site this app process serves, taken from the NOC_SITE env (default
 *  'newobour'). It's server-trusted — never derived from the request — so a partner can't
 *  spoof which site they're logging into. Each app sets NOC_SITE in its runtime env. */
export type Site = 'newobour' | 'alsawarey';

export function currentSite(): Site {
  return process.env.NOC_SITE === 'alsawarey' ? 'alsawarey' : 'newobour';
}

/** Does an owner's site-access allow the given site? */
export function ownerAllowsSite(owner: { siteNewObour: boolean; siteAlsawary: boolean } | null | undefined, site: Site): boolean {
  if (!owner) return false;
  return site === 'alsawarey' ? owner.siteAlsawary : owner.siteNewObour;
}
