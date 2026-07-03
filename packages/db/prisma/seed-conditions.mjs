// Seed the "اشتراطات البناء" (building conditions) reference pages from the ALSWARY
// sheets (209/276/350/400/450/500 m²). Idempotent — upserts by slug.
import { prisma } from './db-client.mjs';

const UNITS = [
  { label: 'أرض 209 متر', setbacks: { front: '1.6', rear: '2.6', side: '3 متر من جانب واحد' }, rows: [ { label: 'أبعاد الأرض', front: '11', depth: '19', area: '209 متر', ratio: '-' }, { label: 'البدروم (اختياري)', front: '11', depth: '19', area: '118 أو 209 متر', ratio: '57% / 100%' }, { label: 'الدور الأرضي', front: '8', depth: '14.8', area: '118 متر', ratio: '0.57' }, { label: '3 أدوار متكرر', front: '8.6', depth: '15.8', area: '136 متر', ratio: '0.65' } ], aptTitle: 'صافي مساحة الشقة (شقة واحدة)', floorsHeader: ['الدور الأرضي', 'الدور الأول', 'الدور الثاني', 'الدور الثالث', 'غرف السطح'], floorsValues: ['103', '121', '121', '121', '-'] },
  { label: 'أرض 276 متر', setbacks: { front: '2', rear: '3', side: '3 متر من جانب واحد' }, rows: [ { label: 'أبعاد الأرض', front: '12', depth: '23', area: '276 متر', ratio: '-' }, { label: 'البدروم (اختياري)', front: '12', depth: '23', area: '161 أو 276 متر', ratio: '59% أو 100%' }, { label: 'الدور الأرضي', front: '9', depth: '18', area: '161 متر', ratio: '0.59' }, { label: '3 أدوار متكرر', front: '9.6', depth: '19', area: '182 متر', ratio: '0.66' } ], aptTitle: 'صافي مساحة الشقة (شقة واحدة)', floorsHeader: ['الدور الأرضي', 'الدور الأول', 'الدور الثاني', 'الدور الثالث', 'الروف'], floorsValues: ['147', '167', '167', '167', '-'] },
  { label: 'أرض 350 متر', setbacks: { front: '2', rear: '3', side: '3 متر من الجانبين' }, rows: [ { label: 'أبعاد الأرض', front: '14', depth: '25', area: '350 متر', ratio: '-' }, { label: 'البدروم (اختياري)', front: '14', depth: '25', area: '180 أو 350 متر', ratio: '50% - 100%' }, { label: 'الدور الأرضي', front: '9', depth: '20', area: '180 متر', ratio: '0.51' }, { label: '3 أدوار متكرر', front: '9.6', depth: '21', area: '202 متر', ratio: '0.58' } ], aptTitle: 'صافي مساحة الشقة (شقة واحدة)', floorsHeader: ['الدور الأرضي', 'الدور الأول', 'الدور الثاني', 'الدور الثالث', 'الروف'], floorsValues: ['165', '187', '187', '187', '-'] },
  { label: 'أرض 400 متر', setbacks: { front: '2.5', rear: '3', side: '3 متر من الجانبين' }, rows: [ { label: 'أبعاد الأرض', front: '16', depth: '25', area: '400 متر', ratio: '-' }, { label: 'البدروم (اختياري)', front: '16', depth: '25', area: '200 أو 400 متر', ratio: '50% - 100%' }, { label: 'الدور الأرضي', front: '10.5', depth: '19', area: '200 متر', ratio: '0.5' }, { label: '3 أدوار متكرر', front: '10.5', depth: '21', area: '220 متر', ratio: '0.55' } ], aptTitle: 'صافي مساحة الشقة (شقة واحدة)', floorsHeader: ['الدور الأرضي', 'الدور الأول', 'الدور الثاني', 'الدور الثالث', 'الروف'], floorsValues: ['185', '205', '205', '205', '-'] },
  { label: 'أرض 450 متر', setbacks: { front: '3', rear: '3', side: '3 متر من الجانبين' }, rows: [ { label: 'أبعاد الأرض', front: '18', depth: '25', area: '450 متر', ratio: '-' }, { label: 'البدروم (اختياري)', front: '18', depth: '25', area: '228 أو 450 متر', ratio: '50% - 100%' }, { label: 'الدور الأرضي', front: '12', depth: '19', area: '228 متر', ratio: '0.5' }, { label: '3 أدوار متكرر', front: '13', depth: '19.4', area: '252 متر', ratio: '0.56' } ], aptTitle: 'صافي مساحة الشقة (شقتين)', floorsHeader: ['الدور الأرضي', 'الدور الأول', 'الدور الثاني', 'الدور الثالث', 'الروف'], floorsValues: ['106', '118', '118', '118', '-'] },
  { label: 'أرض 500 متر', setbacks: { front: '3', rear: '4', side: '3 متر من الجانبين' }, rows: [ { label: 'أبعاد الأرض', front: '20', depth: '25', area: '500 متر', ratio: '-' }, { label: 'البدروم (اختياري)', front: '20', depth: '25', area: '252 أو 500 متر', ratio: '50% - 100%' }, { label: 'الدور الأرضي', front: '14', depth: '18', area: '252 متر', ratio: '0.5' }, { label: '3 أدوار متكرر', front: '16', depth: '18', area: '288 متر', ratio: '0.55' }, { label: 'الروف', front: '75% من مساحة المبنى', depth: '', area: '189 متر', ratio: '0.38' } ], aptTitle: 'صافي مساحة الشقة (شقتين)', floorsHeader: ['الدور الأرضي', 'الدور الأول', 'الدور الثاني', 'الدور الثالث', 'الروف'], floorsValues: ['118', '136', '136', '136', '189'] },
];

const NOTES = [
  'جميع الأرقام والنسب تقريبية وقابلة للتعديل من قبل جهاز المدينة',
  'المساحات البنائية يمكن أن تقل ولا يمكن أن تزيد',
  'ارتفاع المبنى 13.2 متر',
  'يتم استخدام البدروم كجراج انتظار للسيارات',
  'يتم توفير انتظار سيارات داخل حدود قطعة الأرض (سيارة / وحدة) طبقاً للكود المصري للجراجات وتعديلاته',
  'يتم الالتزام بقيود الارتفاع المسموح بها بالمنطقة طبقاً لموافقة وزارة الدفاع',
  'ارتفاع سقف البدروم 1.20 م من ظهر بلاطة الخرسانة للدور الأرضي',
];
const NOTES_EN = [
  'All figures and ratios are approximate and subject to adjustment by the City Authority',
  'Built areas may decrease but must not increase',
  'Building height 13.2 m',
  'The basement is used as a car parking garage',
  'Provide car parking within the plot boundaries (one car per unit) per the Egyptian garage code and its amendments',
  'Comply with the height limits allowed in the area per Ministry of Defense approval',
  'Basement ceiling height is 1.20 m above the back of the ground-floor concrete slab',
];

// Top-line building ratio (النسبة البنائية) per area bracket — from the official اشتراطات sheet.
const RATIO = {
  '209': { ar: 'طبقاً للنموذج المعتمد (صفحة 14، 15)', en: 'Per the approved model (pp. 14–15)' },
  '276': { ar: 'طبقاً للنموذج المعتمد (صفحة 16، 17، 18، 19)', en: 'Per the approved model (pp. 16–19)' },
  '350': { ar: '50% من إجمالي مساحة الأرض', en: '50% of total land area' },
  '400': { ar: '50% من إجمالي مساحة الأرض', en: '50% of total land area' },
  '450': { ar: '50% من إجمالي مساحة الأرض', en: '50% of total land area' },
  '500': { ar: '50% من إجمالي مساحة الأرض', en: '50% of total land area' },
};

const pct = (v) => { const n = Number(v); return !Number.isNaN(n) && n > 0 && n <= 1 ? `${Math.round(n * 100)}%` : v; };
const en = (s) =>
  s.replace('متر', 'm²').replace('أو', 'or').replace('من الجانبين', 'on both sides').replace('من جانب واحد', 'on one side').replace('من مساحة المبنى', 'of building area').trim();
const ROW_EN = { 'أبعاد الأرض': 'Land dimensions', 'البدروم (اختياري)': 'Basement (optional)', 'الدور الأرضي': 'Ground floor', '3 أدوار متكرر': '3 repeated floors', 'الروف': 'Roof' };
const FLOOR_EN = { 'الدور الأرضي': 'Ground', 'الدور الأول': 'First', 'الدور الثاني': 'Second', 'الدور الثالث': 'Third', 'غرف السطح': 'Roof', 'الروف': 'Roof' };

function body(u, loc) {
  const T = (ar, enT) => (loc === 'en' ? enT : ar);
  const rowLabel = (l) => (loc === 'en' ? ROW_EN[l] ?? l : l);
  const cell = (v) => (loc === 'en' ? en(v) : v);
  const setHead = `<tr><th>${T('أمامي', 'Front')}</th><th>${T('خلفي', 'Rear')}</th><th>${T('جانبي', 'Side')}</th></tr>`;
  const setRow = `<tr><td>${u.setbacks.front}</td><td>${u.setbacks.rear}</td><td>${cell(u.setbacks.side)}</td></tr>`;
  const bHead = `<tr><th>${T('الجهة', 'Zone')}</th><th>${T('الواجهة', 'Frontage')}</th><th>${T('العمق', 'Depth')}</th><th>${T('المساحة', 'Area')}</th><th>${T('نسبة البناء', 'Build ratio')}</th></tr>`;
  const bRows = u.rows.map((r) => `<tr><td>${rowLabel(r.label)}</td><td>${cell(r.front)}</td><td>${r.depth}</td><td>${cell(r.area)}</td><td>${pct(r.ratio)}</td></tr>`).join('');
  const fHead = `<tr>${u.floorsHeader.map((h) => `<th>${loc === 'en' ? FLOOR_EN[h] ?? h : h}</th>`).join('')}</tr>`;
  const fRow = `<tr>${u.floorsValues.map((v) => `<td>${v || '—'}</td>`).join('')}</tr>`;
  const aptTitle = loc === 'en' ? (u.aptTitle.includes('شقتين') ? 'Net apartment area (two apartments)' : 'Net apartment area (one apartment)') : u.aptTitle;
  const notes = (loc === 'en' ? NOTES_EN : NOTES).map((n) => `<li>${n}</li>`).join('');
  const num = (u.label.match(/\d+/) || ['0'])[0];
  const r = RATIO[num];
  const summary =
    `<p><strong>${T('الارتفاع', 'Height')}:</strong> ${T('أرضي + 3 أدوار (يسمح بإقامة بدروم) — 13.20 م', 'Ground + 3 floors (basement allowed) — 13.20 m')}</p>` +
    (r ? `<p><strong>${T('النسبة البنائية', 'Building ratio')}:</strong> ${T(r.ar, r.en)}</p>` : '');
  return [
    summary,
    `<h3>${T('الردود', 'Setbacks')}</h3><table><tbody>${setHead}${setRow}</tbody></table>`,
    `<h3>${T('مسطحات البناء', 'Building areas')}</h3><table><tbody>${bHead}${bRows}</tbody></table>`,
    `<h3>${aptTitle}</h3><table><tbody>${fHead}${fRow}</tbody></table>`,
    `<ul>${notes}</ul>`,
  ].join('\n');
}

async function main() {
  let i = 0;
  for (const u of UNITS) {
    const num = (u.label.match(/\d+/) || ['0'])[0];
    const slug = `land-${num}`;
    const data = {
      unitLabelAr: u.label,
      unitLabelEn: `${num} m² land`,
      titleAr: `اشتراطات البناء — ${u.label}`,
      titleEn: `Building conditions — ${num} m² land`,
      bodyAr: body(u, 'ar'),
      bodyEn: body(u, 'en'),
      order: i++,
      published: true,
    };
    await prisma.buildingCondition.upsert({ where: { slug }, update: data, create: { slug, ...data } });
  }
  console.log(`✓ Building conditions: ${UNITS.length} unit pages seeded.`);
}

main().finally(() => prisma.$disconnect());
