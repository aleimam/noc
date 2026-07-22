import { describe, it, expect } from 'vitest';
import { resolveAvailabilityTransition as t } from './availability';

describe('availability transitions', () => {
  it('available -> sold records the price', () => {
    expect(t({ status: 'PUBLISHED' }, 'SOLD', 500)).toEqual({
      status: 'SOLD', statusBeforeHide: null, soldPrice: 500,
    });
  });

  it('sold -> available clears the sale price', () => {
    expect(t({ status: 'SOLD' }, 'PUBLISHED', null)).toEqual({
      status: 'PUBLISHED', statusBeforeHide: null, soldPrice: null,
    });
  });

  it('hiding an AVAILABLE listing remembers it as available', () => {
    expect(t({ status: 'PUBLISHED' }, 'ARCHIVED', null)).toEqual({
      status: 'ARCHIVED', statusBeforeHide: 'PUBLISHED',
    });
  });

  it('hiding a SOLD listing remembers the sale', () => {
    expect(t({ status: 'SOLD' }, 'ARCHIVED', null)).toEqual({
      status: 'ARCHIVED', statusBeforeHide: 'SOLD',
    });
  });

  it('hiding never touches soldPrice — the figure survives the pause', () => {
    expect(t({ status: 'SOLD' }, 'ARCHIVED', null)).not.toHaveProperty('soldPrice');
    expect(t({ status: 'PUBLISHED' }, 'ARCHIVED', null)).not.toHaveProperty('soldPrice');
  });

  it('⭐ THE BUG: hide a SOLD listing then show it -> comes back SOLD, not available', () => {
    const hidden = t({ status: 'SOLD' }, 'ARCHIVED', null);
    const shown = t({ status: 'ARCHIVED', statusBeforeHide: hidden.statusBeforeHide }, 'PUBLISHED', null);
    expect(shown.status).toBe('SOLD');
    expect(shown.statusBeforeHide).toBeNull();
    // Price is left alone so the remembered sale keeps its figure.
    expect(shown).not.toHaveProperty('soldPrice');
  });

  it('hide an AVAILABLE listing then show it -> still available', () => {
    const hidden = t({ status: 'PUBLISHED' }, 'ARCHIVED', null);
    const shown = t({ status: 'ARCHIVED', statusBeforeHide: hidden.statusBeforeHide }, 'PUBLISHED', null);
    expect(shown).toEqual({ status: 'PUBLISHED', statusBeforeHide: null, soldPrice: null });
  });

  it('a row hidden BEFORE this column existed restores to available (old behaviour, no regression)', () => {
    expect(t({ status: 'ARCHIVED', statusBeforeHide: null }, 'PUBLISHED', null)).toEqual({
      status: 'PUBLISHED', statusBeforeHide: null, soldPrice: null,
    });
    expect(t({ status: 'ARCHIVED' }, 'PUBLISHED', null).status).toBe('PUBLISHED');
  });

  it('memory is cleared once restored, so a later hide re-records from scratch', () => {
    const shown = t({ status: 'ARCHIVED', statusBeforeHide: 'SOLD' }, 'PUBLISHED', null);
    expect(shown.statusBeforeHide).toBeNull();
    // Now sold -> hidden again remembers SOLD afresh.
    expect(t({ status: 'SOLD', statusBeforeHide: null }, 'ARCHIVED', null).statusBeforeHide).toBe('SOLD');
  });

  it('marking SOLD directly from hidden is not a restore — it takes the requested price', () => {
    expect(t({ status: 'ARCHIVED', statusBeforeHide: 'PUBLISHED' }, 'SOLD', 900)).toEqual({
      status: 'SOLD', statusBeforeHide: null, soldPrice: 900,
    });
  });
});
