// Seed the marketplace catalog: property types, attribute sections, attributes
// (+ options) and the type↔attribute mapping. Idempotent (upsert by key).
// Admins can edit all of this in /admin/marketplace afterward.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── property type keys + groups ──────────────────────────────────────────────
const T = {
  land: 'land', apartment: 'apartment', villa: 'villa', duplex: 'duplex',
  building: 'building', roof: 'roof', shop: 'shop', office: 'office',
  warehouse: 'warehouse', clinic: 'clinic', pharmacy: 'pharmacy', chalet: 'chalet',
  studio: 'studio', townhouse: 'townhouse', factory: 'factory',
};
const ALL = Object.values(T);
const RES = [T.apartment, T.villa, T.duplex, T.studio, T.chalet, T.roof, T.townhouse];

// ── shared option sets ───────────────────────────────────────────────────────
const CONN = [
  { key: 'connected', ar: 'متوصلة', en: 'Connected' },
  { key: 'nearby', ar: 'قريبة', en: 'Nearby' },
  { key: 'none', ar: 'غير متوفرة', en: 'Not available' },
];

const TYPES = [
  { key: T.land, ar: 'أرض', en: 'Land' },
  { key: T.apartment, ar: 'شقة', en: 'Apartment' },
  { key: T.villa, ar: 'فيلا', en: 'Villa' },
  { key: T.duplex, ar: 'دوبلكس', en: 'Duplex' },
  { key: T.building, ar: 'عمارة / مبنى', en: 'Building' },
  { key: T.roof, ar: 'روف / سطح', en: 'Roof' },
  { key: T.shop, ar: 'محل تجاري', en: 'Shop' },
  { key: T.office, ar: 'مكتب إداري', en: 'Office' },
  { key: T.warehouse, ar: 'مخزن / مستودع', en: 'Warehouse' },
  { key: T.clinic, ar: 'عيادة', en: 'Clinic' },
  { key: T.pharmacy, ar: 'صيدلية', en: 'Pharmacy' },
  { key: T.chalet, ar: 'شاليه', en: 'Chalet' },
  { key: T.studio, ar: 'استوديو', en: 'Studio' },
  { key: T.townhouse, ar: 'تاون هاوس', en: 'Townhouse' },
  { key: T.factory, ar: 'مصنع', en: 'Factory' },
];

// ── Category → Group → Type taxonomy. Organizes the types above into a 3-level
//    tree (admins can rearrange / extend it in /admin/marketplace). `types` lists
//    the PropertyType keys that belong to each group. ────────────────────────────
const CATEGORIES = [
  { key: 'cat_land', ar: 'أراضٍ', en: 'Land', groups: [
    { key: 'grp_plots', ar: 'قطع أراضٍ', en: 'Plots', types: [T.land] },
  ] },
  { key: 'cat_residential', ar: 'سكني', en: 'Residential', groups: [
    { key: 'grp_apartments', ar: 'شقق', en: 'Apartments', types: [T.apartment, T.studio, T.duplex, T.roof] },
    { key: 'grp_houses', ar: 'فيلات ومنازل', en: 'Houses & Villas', types: [T.villa, T.townhouse, T.chalet] },
  ] },
  { key: 'cat_commercial', ar: 'تجاري وإداري', en: 'Commercial & Admin', groups: [
    { key: 'grp_retail', ar: 'محلات', en: 'Retail', types: [T.shop, T.pharmacy] },
    { key: 'grp_offices', ar: 'مكاتب وعيادات', en: 'Offices & Clinics', types: [T.office, T.clinic] },
  ] },
  { key: 'cat_industrial', ar: 'صناعي وتخزين', en: 'Industrial & Storage', groups: [
    { key: 'grp_industrial', ar: 'مصانع ومخازن', en: 'Factories & Warehouses', types: [T.warehouse, T.factory] },
  ] },
  { key: 'cat_buildings', ar: 'مبانٍ كاملة', en: 'Whole Buildings', groups: [
    { key: 'grp_buildings', ar: 'عمارات', en: 'Buildings', types: [T.building] },
  ] },
];

const SECTIONS = [
  { key: 'location', ar: 'الموقع', en: 'Location' },
  { key: 'specs', ar: 'المواصفات', en: 'Specifications' },
  { key: 'utilities', ar: 'المرافق', en: 'Utilities' },
  { key: 'payment', ar: 'السعر والسداد', en: 'Price & Payment' },
  { key: 'legal', ar: 'الأوضاع القانونية', en: 'Legal & Documents' },
  { key: 'advantages', ar: 'المميزات', en: 'Advantages' },
  { key: 'delivery', ar: 'التسليم والإتاحة', en: 'Delivery & Availability' },
  { key: 'listing_info', ar: 'معلومات الإعلان', en: 'Listing Info' },
];

// Attribute: { s(section), key, ar, en, type, unit?, filt?, opts?, to(applies-to: ALL or [..]) }
const ATTRS = [
  // ── A · Location ──
  { s: 'location', key: 'city', ar: 'المدينة', en: 'City', type: 'SELECT', filt: true, to: 'ALL', opts: [
    { key: 'new_obour', ar: 'العبور الجديدة', en: 'New Obour' },
    { key: 'old_obour', ar: 'العبور القديمة', en: 'Old Obour' },
    { key: 'new_cairo', ar: 'القاهرة الجديدة', en: 'New Cairo' },
    { key: 'shorouk', ar: 'الشروق', en: 'El Shorouk' },
    { key: 'badr', ar: 'بدر', en: 'Badr' },
  ] },
  { s: 'location', key: 'district', ar: 'الحي / المنطقة', en: 'District', type: 'SELECT', filt: true, to: 'ALL', opts: [
    { key: 'first', ar: 'الأول', en: 'First' }, { key: 'second', ar: 'الثاني', en: 'Second' },
    { key: 'third', ar: 'الثالث', en: 'Third' }, { key: 'fourth', ar: 'الرابع', en: 'Fourth' },
    { key: 'fifth', ar: 'الخامس', en: 'Fifth' }, { key: 'sixth', ar: 'السادس', en: 'Sixth' },
    { key: 'seventh', ar: 'السابع', en: 'Seventh' }, { key: 'eighth', ar: 'الثامن', en: 'Eighth' },
    { key: 'ninth', ar: 'التاسع', en: 'Ninth' }, { key: 'tenth', ar: 'العاشر', en: 'Tenth' },
    { key: 'craftsmen', ar: 'الحرفيين', en: 'Craftsmen' },
    { key: 'industrial', ar: 'الصناعية', en: 'Industrial' },
    { key: 'south_industrial', ar: 'جنوب الصناعية', en: 'South Industrial' },
    { key: 'services', ar: 'الخدمات', en: 'Services' },
  ] },
  { s: 'location', key: 'neighborhood_block', ar: 'المجاورة / البلوك', en: 'Block / Neighborhood', type: 'TEXT', to: 'ALL' },
  { s: 'location', key: 'street_name', ar: 'اسم / رقم الشارع', en: 'Street', type: 'TEXT', to: 'ALL' },
  { s: 'location', key: 'main_axis', ar: 'المحور الرئيسي', en: 'Main Axis', type: 'SELECT', filt: true,
    to: [T.land, T.apartment, T.villa, T.shop, T.office, T.building, T.warehouse, T.factory], opts: [
    { key: 'r2', ar: 'R2', en: 'R2' }, { key: 'r3', ar: 'R3', en: 'R3' }, { key: 'r4', ar: 'R4', en: 'R4' },
    { key: 'r5', ar: 'R5', en: 'R5' }, { key: 'r6', ar: 'R6', en: 'R6' },
  ] },
  { s: 'location', key: 'road_access', ar: 'الطريق المجاور', en: 'Adjacent Road', type: 'MULTI_SELECT', filt: true,
    to: [T.land, T.villa, T.warehouse, T.factory, T.shop, T.building], opts: [
    { key: 'ring', ar: 'الطريق الدائري', en: 'Ring Road' },
    { key: 'middle_ring', ar: 'الدائري الأوسطي', en: 'Middle Ring' },
    { key: 'ismailia', ar: 'طريق إسماعيلية', en: 'Ismailia Rd' },
    { key: 'belbees', ar: 'طريق بلبيس', en: 'Belbees Rd' },
    { key: 'suez', ar: 'طريق السويس', en: 'Suez Rd' },
  ] },
  { s: 'location', key: 'on_main_street', ar: 'على شارع رئيسي', en: 'On Main Street', type: 'BOOLEAN', filt: true, to: 'ALL' },
  { s: 'location', key: 'corner', ar: 'ناصية', en: 'Corner', type: 'BOOLEAN', filt: true, to: [T.land, T.apartment, T.villa, T.shop, T.building] },
  { s: 'location', key: 'open_views_count', ar: 'عدد الواجهات المفتوحة', en: 'Open Frontages', type: 'NUMBER', unit: 'واجهة', filt: true, to: [T.land, T.villa, T.building, T.warehouse] },
  { s: 'location', key: 'facing', ar: 'الاتجاه / الواجهة', en: 'Facing', type: 'SELECT', filt: true, to: [...RES, T.office], opts: [
    { key: 'n', ar: 'بحري', en: 'North' }, { key: 's', ar: 'قبلي', en: 'South' },
    { key: 'e', ar: 'شرقي', en: 'East' }, { key: 'w', ar: 'غربي', en: 'West' },
    { key: 'ne', ar: 'بحري شرقي', en: 'North-East' }, { key: 'nw', ar: 'بحري غربي', en: 'North-West' },
    { key: 'se', ar: 'قبلي شرقي', en: 'South-East' }, { key: 'sw', ar: 'قبلي غربي', en: 'South-West' },
  ] },
  { s: 'location', key: 'near_landmark', ar: 'قريب من', en: 'Near', type: 'MULTI_SELECT', to: 'ALL', opts: [
    { key: 'mosque', ar: 'مسجد', en: 'Mosque' }, { key: 'school', ar: 'مدرسة', en: 'School' },
    { key: 'club', ar: 'نادي', en: 'Club' }, { key: 'mall', ar: 'مول', en: 'Mall' },
    { key: 'hospital', ar: 'مستشفى', en: 'Hospital' }, { key: 'gas', ar: 'محطة وقود', en: 'Gas Station' },
    { key: 'transit', ar: 'مواصلات', en: 'Transit' }, { key: 'park', ar: 'حديقة', en: 'Park' },
  ] },
  { s: 'location', key: 'distance_to_main_rd', ar: 'المسافة للطريق الرئيسي', en: 'Distance to Main Rd', type: 'NUMBER', unit: 'م', to: [T.land, T.villa, T.warehouse, T.factory] },
  { s: 'location', key: 'map_url', ar: 'رابط الموقع (خريطة)', en: 'Map Link', type: 'TEXT', to: 'ALL' },

  // ── B · Specifications ──
  { s: 'specs', key: 'land_area', ar: 'مساحة الأرض', en: 'Land Area', type: 'NUMBER', unit: 'م²', filt: true, to: [T.land, T.villa, T.building, T.warehouse, T.factory, T.townhouse] },
  { s: 'specs', key: 'area_preset', ar: 'المساحة (شائعة)', en: 'Area (preset)', type: 'SELECT', unit: 'م²', filt: true, to: [T.land],
    opts: ['209', '276', '350', '400', '450', '500', '624', '682', '777'].map((n) => ({ key: n, ar: n, en: n })) },
  { s: 'specs', key: 'built_area', ar: 'المساحة المبنية', en: 'Built-up Area', type: 'NUMBER', unit: 'م²', filt: true, to: ALL.filter((k) => k !== T.land) },
  { s: 'specs', key: 'net_area', ar: 'المساحة الصافية', en: 'Net Area', type: 'NUMBER', unit: 'م²', to: [T.apartment, T.villa, T.duplex, T.office, T.studio, T.chalet, T.townhouse] },
  { s: 'specs', key: 'land_width', ar: 'عرض الأرض (الواجهة)', en: 'Frontage Width', type: 'NUMBER', unit: 'م', to: [T.land] },
  { s: 'specs', key: 'land_depth', ar: 'عمق الأرض', en: 'Plot Depth', type: 'NUMBER', unit: 'م', to: [T.land] },
  { s: 'specs', key: 'rooms', ar: 'عدد الغرف', en: 'Bedrooms', type: 'NUMBER', unit: 'غرفة', filt: true, to: [T.apartment, T.villa, T.duplex, T.studio, T.chalet, T.roof, T.townhouse] },
  { s: 'specs', key: 'bathrooms', ar: 'عدد الحمامات', en: 'Bathrooms', type: 'NUMBER', unit: 'حمام', filt: true, to: [T.apartment, T.villa, T.duplex, T.office, T.clinic, T.studio, T.chalet, T.roof, T.townhouse] },
  { s: 'specs', key: 'reception_pieces', ar: 'الريسبشن (قطع)', en: 'Reception (pieces)', type: 'NUMBER', unit: 'قطعة', to: [T.apartment, T.villa, T.duplex, T.townhouse] },
  { s: 'specs', key: 'floor_number', ar: 'الدور', en: 'Floor', type: 'NUMBER', filt: true, to: [T.apartment, T.office, T.shop, T.clinic, T.pharmacy, T.studio] },
  { s: 'specs', key: 'total_floors', ar: 'عدد الأدوار بالعقار', en: 'Total Floors', type: 'NUMBER', filt: true, to: [T.apartment, T.villa, T.building, T.office, T.duplex, T.townhouse] },
  { s: 'specs', key: 'units_per_floor', ar: 'وحدات بالدور', en: 'Units / Floor', type: 'NUMBER', to: [T.apartment, T.building] },
  { s: 'specs', key: 'building_age', ar: 'عمر العقار', en: 'Building Age', type: 'SELECT', filt: true,
    to: [T.apartment, T.villa, T.duplex, T.building, T.office, T.shop, T.studio, T.roof, T.townhouse], opts: [
    { key: 'new', ar: 'جديد', en: 'New' }, { key: 'under5', ar: 'أقل من 5 سنوات', en: 'Under 5' },
    { key: '5_10', ar: '5 – 10 سنوات', en: '5–10' }, { key: '10_20', ar: '10 – 20 سنة', en: '10–20' },
    { key: 'over20', ar: 'أكثر من 20 سنة', en: 'Over 20' },
  ] },
  { s: 'specs', key: 'finishing', ar: 'مستوى التشطيب', en: 'Finishing Level', type: 'SELECT', filt: true,
    to: [T.apartment, T.villa, T.duplex, T.shop, T.office, T.clinic, T.pharmacy, T.studio, T.chalet, T.roof, T.townhouse], opts: [
    { key: 'core', ar: 'بدون تشطيب', en: 'Core & Shell' }, { key: 'semi', ar: 'نص تشطيب', en: 'Semi-finished' },
    { key: 'super_lux', ar: 'سوبر لوكس', en: 'Super Lux' }, { key: 'lux', ar: 'لوكس', en: 'Lux' },
    { key: 'premium', ar: 'تشطيب فاخر', en: 'Premium' }, { key: 'furnished', ar: 'مفروش', en: 'Furnished' },
  ] },
  { s: 'specs', key: 'view_type', ar: 'الإطلالة', en: 'View', type: 'SELECT', filt: true,
    to: [T.apartment, T.villa, T.duplex, T.studio, T.chalet, T.roof, T.townhouse, T.office], opts: [
    { key: 'street', ar: 'شارع', en: 'Street' }, { key: 'garden', ar: 'حديقة', en: 'Garden' },
    { key: 'landscape', ar: 'لاند سكيب', en: 'Landscape' }, { key: 'pool', ar: 'حمام سباحة', en: 'Pool' },
    { key: 'open', ar: 'مفتوحة', en: 'Open' }, { key: 'sea', ar: 'بحرية', en: 'Sea' },
  ] },
  { s: 'specs', key: 'ceiling_height', ar: 'ارتفاع السقف', en: 'Ceiling Height', type: 'NUMBER', unit: 'م', to: [T.shop, T.warehouse, T.factory, T.office] },
  { s: 'specs', key: 'shop_frontage', ar: 'واجهة المحل', en: 'Shop Frontage', type: 'NUMBER', unit: 'م', filt: true, to: [T.shop, T.pharmacy] },
  { s: 'specs', key: 'has_mezzanine', ar: 'يوجد ميزانين', en: 'Has Mezzanine', type: 'BOOLEAN', filt: true, to: [T.shop, T.warehouse, T.office] },
  { s: 'specs', key: 'loading_dock', ar: 'رصيف تحميل', en: 'Loading Dock', type: 'BOOLEAN', filt: true, to: [T.warehouse, T.factory] },
  { s: 'specs', key: 'building_status', ar: 'حالة البناء', en: 'Build Status', type: 'SELECT', filt: true,
    to: [T.apartment, T.villa, T.duplex, T.building, T.office, T.shop, T.townhouse], opts: [
    { key: 'offplan', ar: 'على المخطط', en: 'Off-plan' }, { key: 'under_construction', ar: 'تحت الإنشاء', en: 'Under Construction' },
    { key: 'ready', ar: 'جاهز', en: 'Ready' }, { key: 'immediate', ar: 'تسليم فوري', en: 'Immediate' },
  ] },
  { s: 'specs', key: 'buildable_floors', ar: 'الأدوار المسموح بناؤها', en: 'Buildable Floors', type: 'NUMBER', filt: true, to: [T.land] },
  { s: 'specs', key: 'building_ratio', ar: 'نسبة البناء', en: 'Build Ratio', type: 'NUMBER', unit: '%', to: [T.land] },

  // ── C · Utilities ──
  { s: 'utilities', key: 'electricity', ar: 'الكهرباء', en: 'Electricity', type: 'SELECT', filt: true, to: 'ALL', opts: CONN },
  { s: 'utilities', key: 'electricity_meter', ar: 'عداد كهرباء', en: 'Electric Meter', type: 'BOOLEAN', to: [...RES, T.shop, T.office] },
  { s: 'utilities', key: 'water', ar: 'المياه', en: 'Water', type: 'SELECT', filt: true, to: 'ALL', opts: CONN },
  { s: 'utilities', key: 'sewage', ar: 'الصرف الصحي', en: 'Sewage', type: 'SELECT', filt: true, to: 'ALL', opts: [
    { key: 'public', ar: 'شبكة عمومية', en: 'Public Network' }, { key: 'trench', ar: 'ترنش', en: 'Trench' }, { key: 'none', ar: 'غير متوفر', en: 'None' },
  ] },
  { s: 'utilities', key: 'natural_gas', ar: 'الغاز الطبيعي', en: 'Natural Gas', type: 'SELECT', filt: true, to: [...RES, T.building], opts: CONN },
  { s: 'utilities', key: 'telephone_internet', ar: 'تليفون / إنترنت', en: 'Phone / Internet', type: 'BOOLEAN', to: [T.apartment, T.villa, T.duplex, T.office, T.shop, T.studio, T.townhouse] },
  { s: 'utilities', key: 'three_phase_power', ar: 'كهرباء 3 فاز', en: '3-Phase Power', type: 'BOOLEAN', filt: true, to: [T.warehouse, T.factory, T.shop] },
  { s: 'utilities', key: 'elevator', ar: 'أسانسير', en: 'Elevator', type: 'BOOLEAN', filt: true, to: [T.apartment, T.office, T.building, T.duplex, T.clinic, T.pharmacy] },
  { s: 'utilities', key: 'elevators_count', ar: 'عدد الأسانسيرات', en: 'Elevators', type: 'NUMBER', to: [T.building, T.apartment, T.office] },
  { s: 'utilities', key: 'garage_parking', ar: 'جراج / موقف', en: 'Garage / Parking', type: 'SELECT', filt: true,
    to: [T.apartment, T.villa, T.duplex, T.office, T.building, T.clinic, T.townhouse], opts: [
    { key: 'none', ar: 'لا يوجد', en: 'None' }, { key: 'private', ar: 'خاص', en: 'Private' },
    { key: 'shared', ar: 'مشترك', en: 'Shared' }, { key: 'underground', ar: 'أندرجراوند', en: 'Underground' },
    { key: 'covered', ar: 'مظلل', en: 'Covered' },
  ] },
  { s: 'utilities', key: 'parking_spots', ar: 'عدد أماكن الانتظار', en: 'Parking Spots', type: 'NUMBER', to: [T.villa, T.building, T.office, T.warehouse] },
  { s: 'utilities', key: 'water_tank', ar: 'خزان مياه', en: 'Water Tank', type: 'BOOLEAN', to: [T.villa, T.building, T.warehouse, T.factory] },
  { s: 'utilities', key: 'backup_generator', ar: 'مولد كهرباء احتياطي', en: 'Backup Generator', type: 'BOOLEAN', to: [T.building, T.warehouse, T.factory, T.clinic] },

  // ── D · Price & Payment ──
  { s: 'payment', key: 'price_total', ar: 'السعر الإجمالي', en: 'Total Price', type: 'NUMBER', unit: 'ج.م', filt: true, to: 'ALL' },
  { s: 'payment', key: 'price_per_m2', ar: 'سعر المتر', en: 'Price / m²', type: 'NUMBER', unit: 'ج.م', filt: true, to: [T.land, T.apartment, T.villa, T.building, T.warehouse, T.shop, T.office, T.townhouse, T.factory] },
  { s: 'payment', key: 'payment_method', ar: 'طريقة الدفع', en: 'Payment Method', type: 'SELECT', filt: true, to: 'ALL', opts: [
    { key: 'cash', ar: 'كاش', en: 'Cash' }, { key: 'installments', ar: 'تقسيط', en: 'Installments' },
    { key: 'cash_or_inst', ar: 'كاش أو تقسيط', en: 'Cash or Installments' }, { key: 'mortgage', ar: 'تمويل عقاري', en: 'Mortgage' },
  ] },
  { s: 'payment', key: 'negotiable', ar: 'قابل للتفاوض', en: 'Negotiable', type: 'BOOLEAN', filt: true, to: 'ALL' },
  { s: 'payment', key: 'down_payment', ar: 'المقدم', en: 'Down Payment', type: 'NUMBER', unit: 'ج.م', filt: true, to: 'ALL' },
  { s: 'payment', key: 'down_payment_pct', ar: 'نسبة المقدم', en: 'Down Payment %', type: 'NUMBER', unit: '%', to: 'ALL' },
  { s: 'payment', key: 'installment_years', ar: 'مدة التقسيط', en: 'Installment Years', type: 'NUMBER', unit: 'سنة', filt: true, to: 'ALL' },
  { s: 'payment', key: 'monthly_installment', ar: 'القسط الشهري', en: 'Monthly Installment', type: 'NUMBER', unit: 'ج.م', to: 'ALL' },
  { s: 'payment', key: 'installment_provider', ar: 'جهة التقسيط', en: 'Installment Via', type: 'SELECT', to: 'ALL', opts: [
    { key: 'owner', ar: 'المالك', en: 'Owner' }, { key: 'developer', ar: 'مطور', en: 'Developer' }, { key: 'bank', ar: 'بنك', en: 'Bank' },
  ] },
  { s: 'payment', key: 'maintenance_deposit', ar: 'وديعة الصيانة', en: 'Maintenance Deposit', type: 'NUMBER', unit: 'ج.م', to: [T.apartment, T.villa, T.duplex, T.office, T.building, T.townhouse] },
  { s: 'payment', key: 'price_includes', ar: 'السعر يشمل', en: 'Price Includes', type: 'MULTI_SELECT', to: [T.apartment, T.villa, T.duplex, T.studio, T.chalet, T.townhouse], opts: [
    { key: 'meters', ar: 'عداد', en: 'Meters' }, { key: 'kitchen', ar: 'مطبخ', en: 'Kitchen' },
    { key: 'ac', ar: 'تكييفات', en: 'AC Units' }, { key: 'appliances', ar: 'أجهزة', en: 'Appliances' }, { key: 'garage', ar: 'جراج', en: 'Garage' },
  ] },

  // ── E · Legal & Documents ──
  { s: 'legal', key: 'land_type', ar: 'نوع الأرض', en: 'Land Type', type: 'SELECT', filt: true, to: [T.land, T.villa, T.building, T.warehouse, T.factory, T.townhouse], opts: [
    { key: 'allocated', ar: 'تخصيص', en: 'Allocated' }, { key: 'rationing', ar: 'تقنين (كشف)', en: 'Rationing (Kashf)' },
    { key: 'freehold', ar: 'تمليك', en: 'Freehold' }, { key: 'lease', ar: 'إيجار', en: 'Leasehold' },
  ] },
  { s: 'legal', key: 'ownership_type', ar: 'نوع الملكية', en: 'Ownership', type: 'SELECT', filt: true, to: 'ALL', opts: [
    { key: 'freehold', ar: 'تمليك', en: 'Freehold' }, { key: 'old_rent', ar: 'إيجار قديم', en: 'Old Rent' },
    { key: 'new_rent', ar: 'إيجار جديد', en: 'New Rent' }, { key: 'usufruct', ar: 'حق انتفاع', en: 'Usufruct' },
  ] },
  { s: 'legal', key: 'registered', ar: 'مسجل (شهر عقاري)', en: 'Registered', type: 'SELECT', filt: true, to: 'ALL', opts: [
    { key: 'registered', ar: 'مسجل', en: 'Registered' }, { key: 'poa', ar: 'توكيل', en: 'POA' },
    { key: 'preliminary', ar: 'عقد ابتدائي', en: 'Preliminary Contract' }, { key: 'unregistered', ar: 'غير مسجل', en: 'Unregistered' },
  ] },
  { s: 'legal', key: 'document_type', ar: 'نوع المستند', en: 'Document Type', type: 'SELECT', to: 'ALL', opts: [
    { key: 'deed', ar: 'عقد مسجل', en: 'Registered Deed' }, { key: 'preliminary', ar: 'عقد ابتدائي', en: 'Preliminary' },
    { key: 'poa', ar: 'توكيل', en: 'POA' }, { key: 'allocation', ar: 'كشف تخصيص', en: 'Allocation Decision' }, { key: 'court', ar: 'حكم محكمة', en: 'Court Ruling' },
  ] },
  { s: 'legal', key: 'building_permit', ar: 'رخصة بناء', en: 'Building Permit', type: 'BOOLEAN', filt: true, to: [T.land, T.villa, T.building, T.warehouse, T.factory] },
  { s: 'legal', key: 'violations', ar: 'مخالفات بناء', en: 'Build Violations', type: 'BOOLEAN', filt: true, to: [T.apartment, T.villa, T.building, T.duplex, T.shop, T.townhouse] },
  { s: 'legal', key: 'utilities_paid', ar: 'المرافق مسددة', en: 'Utilities Paid Up', type: 'BOOLEAN', to: 'ALL' },
  { s: 'legal', key: 'mortgaged', ar: 'عليه رهن', en: 'Mortgaged', type: 'BOOLEAN', filt: true, to: 'ALL' },
  { s: 'legal', key: 'readiness', ar: 'جاهزية التعاقد', en: 'Contract Readiness', type: 'SELECT', to: 'ALL', opts: [
    { key: 'immediate', ar: 'فوري', en: 'Immediate' }, { key: 'within_month', ar: 'خلال شهر', en: 'Within a Month' }, { key: 'conditional', ar: 'بشروط', en: 'Conditional' },
  ] },

  // ── F · Advantages ──
  { s: 'advantages', key: 'features', ar: 'مميزات إضافية', en: 'Extra Features', type: 'MULTI_SELECT', filt: true, to: [T.apartment, T.villa, T.duplex, T.studio, T.chalet, T.roof, T.townhouse], opts: [
    { key: 'pool', ar: 'حمام سباحة', en: 'Pool' }, { key: 'private_garden', ar: 'حديقة خاصة', en: 'Private Garden' },
    { key: 'private_roof', ar: 'رووف خاص', en: 'Private Roof' }, { key: 'jacuzzi', ar: 'جاكوزي', en: 'Jacuzzi' },
    { key: 'private_lift', ar: 'مصعد خاص', en: 'Private Lift' }, { key: 'maid_room', ar: 'غرفة خادمة', en: 'Maid Room' },
    { key: 'laundry', ar: 'غرفة غسيل', en: 'Laundry Room' }, { key: 'storage', ar: 'مخزن', en: 'Storage' },
    { key: 'balconies', ar: 'شرفات', en: 'Balconies' }, { key: 'dressing', ar: 'دريسنج روم', en: 'Dressing Room' },
  ] },
  { s: 'advantages', key: 'air_conditioning', ar: 'تكييف', en: 'Air Conditioning', type: 'SELECT', filt: true, to: [T.apartment, T.villa, T.duplex, T.office, T.shop, T.clinic, T.studio, T.chalet, T.townhouse], opts: [
    { key: 'none', ar: 'لا يوجد', en: 'None' }, { key: 'central', ar: 'مركزي', en: 'Central' },
    { key: 'split', ar: 'سبليت', en: 'Split' }, { key: 'ac_ready', ar: 'مجهز للتكييف', en: 'AC-ready' },
  ] },
  { s: 'advantages', key: 'kitchen_type', ar: 'المطبخ', en: 'Kitchen', type: 'SELECT', to: [T.apartment, T.villa, T.duplex, T.studio, T.chalet, T.townhouse], opts: [
    { key: 'none', ar: 'بدون', en: 'None' }, { key: 'fitted', ar: 'جاهز', en: 'Fitted' },
    { key: 'open', ar: 'أمريكاني', en: 'Open' }, { key: 'equipped', ar: 'مجهز', en: 'Equipped' },
  ] },
  { s: 'advantages', key: 'furnished', ar: 'مفروش', en: 'Furnished', type: 'SELECT', filt: true, to: [T.apartment, T.villa, T.duplex, T.studio, T.chalet, T.townhouse], opts: [
    { key: 'unfurnished', ar: 'غير مفروش', en: 'Unfurnished' }, { key: 'semi', ar: 'نص مفروش', en: 'Semi' }, { key: 'full', ar: 'مفروش بالكامل', en: 'Fully' },
  ] },
  { s: 'advantages', key: 'security', ar: 'أمن', en: 'Security', type: 'SELECT', filt: true, to: [T.apartment, T.villa, T.duplex, T.building, T.office, T.townhouse, T.chalet], opts: [
    { key: 'none', ar: 'لا يوجد', en: 'None' }, { key: 'doorman', ar: 'بواب', en: 'Doorman' },
    { key: 'guard24', ar: 'أمن 24 ساعة', en: '24h Security' }, { key: 'cctv', ar: 'كاميرات', en: 'CCTV' }, { key: 'gated', ar: 'كومباوند', en: 'Gated' },
  ] },
  { s: 'advantages', key: 'gated_community', ar: 'داخل كومباوند', en: 'In a Compound', type: 'BOOLEAN', filt: true, to: [T.apartment, T.villa, T.duplex, T.townhouse, T.chalet, T.studio] },
  { s: 'advantages', key: 'smart_home', ar: 'سمارت هوم', en: 'Smart Home', type: 'BOOLEAN', to: [T.apartment, T.villa, T.duplex, T.townhouse] },
  { s: 'advantages', key: 'solar_panels', ar: 'ألواح شمسية', en: 'Solar Panels', type: 'BOOLEAN', to: [T.villa, T.building, T.factory, T.warehouse, T.townhouse] },
  { s: 'advantages', key: 'nearby_services', ar: 'خدمات قريبة', en: 'Nearby Services', type: 'MULTI_SELECT', to: 'ALL', opts: [
    { key: 'shops', ar: 'محلات', en: 'Shops' }, { key: 'restaurants', ar: 'مطاعم', en: 'Restaurants' },
    { key: 'pharmacies', ar: 'صيدليات', en: 'Pharmacies' }, { key: 'banks', ar: 'بنوك', en: 'Banks' },
    { key: 'schools', ar: 'مدارس', en: 'Schools' }, { key: 'transit', ar: 'مواصلات', en: 'Transit' },
  ] },
  { s: 'advantages', key: 'commercial_activity', ar: 'النشاط التجاري المسموح', en: 'Permitted Activity', type: 'MULTI_SELECT', filt: true, to: [T.shop, T.office, T.clinic, T.pharmacy, T.warehouse, T.building], opts: [
    { key: 'retail', ar: 'تجاري', en: 'Retail' }, { key: 'office', ar: 'إداري', en: 'Office' },
    { key: 'medical', ar: 'طبي', en: 'Medical' }, { key: 'fnb', ar: 'مطعم', en: 'F&B' },
    { key: 'supermarket', ar: 'سوبر ماركت', en: 'Supermarket' }, { key: 'light_industry', ar: 'صناعي خفيف', en: 'Light Industry' },
  ] },
  { s: 'advantages', key: 'street_width_m', ar: 'عرض الشارع', en: 'Street Width', type: 'NUMBER', unit: 'م', filt: true, to: [T.shop, T.land, T.villa, T.building, T.warehouse] },

  // ── G · Delivery & Availability ──
  { s: 'delivery', key: 'availability', ar: 'الإتاحة', en: 'Availability', type: 'SELECT', filt: true, to: 'ALL', opts: [
    { key: 'available', ar: 'متاح', en: 'Available' }, { key: 'reserved', ar: 'محجوز', en: 'Reserved' }, { key: 'negotiating', ar: 'تحت التفاوض', en: 'Under Negotiation' },
  ] },
  { s: 'delivery', key: 'delivery_date', ar: 'موعد التسليم', en: 'Delivery Date', type: 'TEXT', to: [T.apartment, T.villa, T.duplex, T.building, T.townhouse] },
  { s: 'delivery', key: 'vacant', ar: 'خالي (غير مشغول)', en: 'Vacant', type: 'BOOLEAN', filt: true, to: [T.apartment, T.villa, T.duplex, T.shop, T.office, T.studio, T.townhouse] },
  { s: 'delivery', key: 'current_tenant', ar: 'يوجد مستأجر حالي', en: 'Currently Tenanted', type: 'BOOLEAN', to: [T.apartment, T.shop, T.office, T.building, T.warehouse] },
  { s: 'delivery', key: 'handover_condition', ar: 'حالة التسليم', en: 'Handover Condition', type: 'SELECT', to: [T.apartment, T.villa, T.duplex, T.townhouse], opts: [
    { key: 'plastered', ar: 'على المحارة', en: 'Plastered' }, { key: 'semi', ar: 'نص تشطيب', en: 'Semi' }, { key: 'turnkey', ar: 'كامل التشطيب', en: 'Turnkey' },
  ] },

  // ── H · Listing Info ──
  { s: 'listing_info', key: 'reason_for_sale', ar: 'سبب البيع', en: 'Reason for Sale', type: 'TEXTAREA', to: 'ALL' },
  { s: 'listing_info', key: 'best_contact_time', ar: 'أفضل وقت للتواصل', en: 'Best Contact Time', type: 'SELECT', to: 'ALL', opts: [
    { key: 'morning', ar: 'صباحًا', en: 'Morning' }, { key: 'afternoon', ar: 'ظهرًا', en: 'Afternoon' },
    { key: 'evening', ar: 'مساءً', en: 'Evening' }, { key: 'anytime', ar: 'أي وقت', en: 'Anytime' },
  ] },
  { s: 'listing_info', key: 'commission_note', ar: 'ملاحظة العمولة', en: 'Commission Note', type: 'TEXT', to: 'ALL' },
];

async function main() {
  for (const [i, s] of SECTIONS.entries()) {
    await prisma.attributeSection.upsert({
      where: { key: s.key },
      update: { nameAr: s.ar, nameEn: s.en, order: i },
      create: { key: s.key, nameAr: s.ar, nameEn: s.en, order: i },
    });
  }
  for (const [i, t] of TYPES.entries()) {
    await prisma.propertyType.upsert({
      where: { key: t.key },
      update: { nameAr: t.ar, nameEn: t.en, order: i },
      create: { key: t.key, nameAr: t.ar, nameEn: t.en, order: i },
    });
  }

  // Categories → Groups, then assign each PropertyType to its group.
  let groupCount = 0;
  for (const [ci, c] of CATEGORIES.entries()) {
    const cat = await prisma.propertyCategory.upsert({
      where: { key: c.key },
      update: { nameAr: c.ar, nameEn: c.en, order: ci },
      create: { key: c.key, nameAr: c.ar, nameEn: c.en, order: ci },
    });
    for (const [gi, g] of c.groups.entries()) {
      const grp = await prisma.propertyGroup.upsert({
        where: { categoryId_key: { categoryId: cat.id, key: g.key } },
        update: { nameAr: g.ar, nameEn: g.en, order: gi },
        create: { categoryId: cat.id, key: g.key, nameAr: g.ar, nameEn: g.en, order: gi },
      });
      groupCount++;
      for (const tk of g.types) {
        await prisma.propertyType.update({ where: { key: tk }, data: { groupId: grp.id } }).catch(() => {});
      }
    }
  }

  const typeId = Object.fromEntries((await prisma.propertyType.findMany()).map((t) => [t.key, t.id]));
  const sectionId = Object.fromEntries((await prisma.attributeSection.findMany()).map((s) => [s.key, s.id]));

  let mappings = 0;
  for (const [i, a] of ATTRS.entries()) {
    const attr = await prisma.attribute.upsert({
      where: { key: a.key },
      update: { sectionId: sectionId[a.s], labelAr: a.ar, labelEn: a.en, type: a.type, unit: a.unit ?? null, filterable: !!a.filt, order: i },
      create: { key: a.key, sectionId: sectionId[a.s], labelAr: a.ar, labelEn: a.en, type: a.type, unit: a.unit ?? null, filterable: !!a.filt, order: i },
    });
    for (const [j, o] of (a.opts ?? []).entries()) {
      await prisma.attributeOption.upsert({
        where: { attributeId_key: { attributeId: attr.id, key: o.key } },
        update: { labelAr: o.ar, labelEn: o.en, order: j },
        create: { attributeId: attr.id, key: o.key, labelAr: o.ar, labelEn: o.en, order: j },
      });
    }
    const types = a.to === 'ALL' ? ALL : a.to;
    for (const tk of types) {
      const tid = typeId[tk];
      if (!tid) continue;
      await prisma.propertyTypeAttribute.upsert({
        where: { propertyTypeId_attributeId: { propertyTypeId: tid, attributeId: attr.id } },
        update: {},
        create: { propertyTypeId: tid, attributeId: attr.id },
      });
      mappings++;
    }
  }

  // Central ALSWARY contact (editable in admin) + drop the redundant seller_role
  // attribute (now folded into Owner.type).
  const SETTINGS = [
    { key: 'alswarey_phone', value: '01040810000' },
    { key: 'alswarey_whatsapp', value: '01040810000' },
  ];
  for (const s of SETTINGS) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s });
  }
  await prisma.attribute.deleteMany({ where: { key: 'seller_role' } });

  console.log(`✓ Marketplace catalog: ${CATEGORIES.length} categories, ${groupCount} groups, ${TYPES.length} types, ${SECTIONS.length} sections, ${ATTRS.length} attributes, ${mappings} type-mappings.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
