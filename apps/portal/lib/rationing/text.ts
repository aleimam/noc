// Arabic text normalization + applicant-name expansion for the rationing module.
// Pure functions (no DB/Next imports) so they can run in import, search, and tests.

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'; // U+0660..0669
const EXT_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹'; // U+06F0..06F9 (Persian/Urdu)

/** Convert Arabic-Indic (and Persian) digits to Latin 0-9. */
export function toLatinDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (d) => {
    const a = ARABIC_INDIC.indexOf(d);
    if (a !== -1) return String(a);
    return String(EXT_ARABIC_INDIC.indexOf(d));
  });
}

/**
 * Normalize an Arabic string for forgiving ("soft") matching:
 *  - Latinize digits
 *  - strip tashkeel (harakat) and tatweel
 *  - unify alef forms (أ إ آ ٱ → ا), ya (ى ئ → ي), ta marbuta (ة → ه), hamza variants (ؤ → و)
 *  - drop standalone hamza (ء)
 *  - collapse all whitespace and punctuation, lowercase Latin
 * The result is letters/digits only — spaces do NOT affect matching.
 */
export function normalizeArabic(input: string | null | undefined): string {
  if (!input) return '';
  let s = toLatinDigits(String(input));
  // remove tashkeel (U+064B..065F, U+0670) and tatweel (U+0640)
  s = s.replace(/[ً-ٰٟـ]/g, '');
  // unify letters
  s = s
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىئ]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ء/g, '');
  // keep only Arabic letters + Latin alphanumerics; drop everything else (spaces, punctuation)
  s = s.toLowerCase().replace(/[^ء-ي0-9a-z]/g, '');
  return s;
}

/** Levenshtein edit distance (iterative, O(n·m)). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    prev = curr;
  }
  return prev[b.length]!;
}

/** Similarity in [0,1] from edit distance, length-normalized. */
export function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - editDistance(a, b) / max;
}

/**
 * Expand a raw applicant cell into the list of real people it names.
 *
 * A cell may hold several people separated by ، , + . The longest segment is the
 * "base" full name; each SHORTER segment is treated as a given-name prefix that
 * borrows the base's trailing surname tokens. Segments already as long as the base
 * are kept as standalone full names.
 *
 *   "محمد، أحمد منصور علي"  → ["محمد منصور علي", "أحمد منصور علي"]
 *   "علاء، مصطفى عبدالحفيظ فرغلى محمد" → ["علاء عبدالحفيظ فرغلى محمد", "مصطفى عبدالحفيظ فرغلى محمد"]
 *   "عشرى كامل رضا، عزه سيد صالح" → ["عشرى كامل رضا", "عزه سيد صالح"]  (both already full)
 *
 * The raw cell is always preserved by the caller; this only produces searchable aliases.
 */
export function expandApplicantNames(raw: string | null | undefined): string[] {
  const cell = (raw ?? '').trim();
  if (!cell) return [];

  // Split on Arabic comma, Latin comma, plus, and period — keep order.
  const segments = cell
    .split(/[،,+.]/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length <= 1) return uniq([cell]);

  const tokens = segments.map((s) => s.split(/\s+/).filter(Boolean));
  // Base = the segment with the most tokens (last one wins ties — usually the fullest).
  let baseIdx = 0;
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i]!.length >= tokens[baseIdx]!.length) baseIdx = i;
  }
  const base = tokens[baseIdx]!;
  const out: string[] = [];

  // A segment with 3+ tokens is a plausible full Egyptian name → keep standalone.
  // Only a short prefix (1-2 tokens, e.g. a lone given name) borrows the base's surname.
  const fullNameFloor = Math.min(base.length, 3);

  segments.forEach((_seg, i) => {
    const t = tokens[i]!;
    if (i === baseIdx || t.length >= fullNameFloor) {
      // already a full name
      out.push(t.join(' '));
    } else {
      // borrow the base's trailing surname: replace base's first t.length tokens
      const borrowed = base.slice(t.length);
      out.push([...t, ...borrowed].join(' '));
    }
  });

  return uniq(out);
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
}

/** Build the canonical merged plot reference, e.g. "قطعة 2094 - مربع 2". */
export function buildPlotFullRef(plotNo: string, blockNo: string): string {
  const plot = plotNo?.trim();
  const block = blockNo?.trim();
  if (plot && block) return `قطعة ${plot} - مربع ${block}`;
  if (plot) return `قطعة ${plot}`;
  return block ? `مربع ${block}` : '';
}

/** Duplicate key: normalized applicantName | plotNo | blockNo. */
export function dedupeKey(applicantName: string, plotNo: string, blockNo: string): string {
  return [normalizeArabic(applicantName), normalizeArabic(plotNo), normalizeArabic(blockNo)].join('|');
}
